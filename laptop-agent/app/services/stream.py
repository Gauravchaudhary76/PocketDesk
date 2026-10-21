import asyncio
import fractions
import logging
import time
from typing import Optional, Tuple

import av
from aiortc import RTCConfiguration, RTCIceServer, RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.mediastreams import MediaStreamError
import mss
from PIL import Image, ImageDraw

from app.services.turn import TurnService

logger = logging.getLogger("pocketdesk.stream")

VIDEO_CLOCK_RATE = 90000
VIDEO_TIME_BASE = fractions.Fraction(1, VIDEO_CLOCK_RATE)

RESOLUTION_MAP = {
    "1080p": (1920, 1080),
    "720p": (1280, 720),
    "540p": (960, 540),
    "480p": (854, 480),
}


class DesktopVideoStreamTrack(VideoStreamTrack):
    """
    WebRTC VideoStreamTrack capturing the active Windows desktop using mss
    and encoding frames at a configurable resolution and frame rate.
    """

    kind = "video"

    def __init__(self, fps: int = 20, resolution: str = "720p"):
        super().__init__()
        self.fps = max(5, min(fps, 60))
        self.resolution_name = resolution
        self.target_width, self.target_height = RESOLUTION_MAP.get(
            resolution, (1280, 720)
        )

        self._sct = None
        self._timestamp = 0
        self._start_time = None
        self._logged_capture_error = False

    async def next_timestamp(self) -> Tuple[int, fractions.Fraction]:
        """Calculates WebRTC PTS and paces frame generation to configured FPS."""
        if self.readyState != "live":
            raise MediaStreamError

        frame_duration = 1.0 / self.fps
        pts_step = int(frame_duration * VIDEO_CLOCK_RATE)

        if hasattr(self, "_timestamp_initialized") and self._timestamp_initialized:
            self._timestamp += pts_step
            elapsed = time.time() - self._start_time
            expected_time = self._timestamp / VIDEO_CLOCK_RATE
            wait = expected_time - elapsed
            if wait > 0:
                await asyncio.sleep(wait)
        else:
            self._start_time = time.time()
            self._timestamp = 0
            self._timestamp_initialized = True

        return self._timestamp, VIDEO_TIME_BASE

    def _render_fallback_frame(self, message: str) -> av.VideoFrame:
        """Render a synthetic informational frame if native screen capture is unavailable."""
        img = Image.new("RGB", (self.target_width, self.target_height), color=(15, 23, 42))
        draw = ImageDraw.Draw(img)

        # Border
        draw.rectangle(
            [12, 12, self.target_width - 12, self.target_height - 12],
            outline=(59, 130, 246),
            width=2,
        )

        # Status text
        title = "PocketDesk Windows Desktop Stream"
        timestamp_str = time.strftime("%Y-%m-%d %H:%M:%S")
        info = f"{self.resolution_name} @ {self.fps} FPS • {timestamp_str}"

        cx = self.target_width // 2
        cy = self.target_height // 2

        draw.text((cx - 150, cy - 30), title, fill=(255, 255, 255))
        draw.text((cx - 150, cy), info, fill=(148, 163, 184))
        draw.text((cx - 150, cy + 30), message, fill=(244, 63, 94))

        return av.VideoFrame.from_image(img)

    def _capture_screen(self) -> av.VideoFrame:
        """Capture active monitor frame via mss or fallback gracefully."""
        try:
            if self._sct is None:
                self._sct = mss.mss()

            monitors = self._sct.monitors
            monitor = monitors[1] if len(monitors) > 1 else monitors[0]

            sct_img = self._sct.grab(monitor)
            img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")

            if img.size != (self.target_width, self.target_height):
                img = img.resize(
                    (self.target_width, self.target_height), Image.BILINEAR
                )

            return av.VideoFrame.from_image(img)
        except Exception as exc:
            if not self._logged_capture_error:
                logger.warning(
                    "Live GDI/desktop capture failed (%s). Emitting status frame (session locked or background service).",
                    exc,
                )
                self._logged_capture_error = True

            return self._render_fallback_frame("Display Unavailable / Screen Locked")

    async def recv(self) -> av.VideoFrame:
        """Pulls next frame for the WebRTC peer connection."""
        pts, time_base = await self.next_timestamp()
        frame = self._capture_screen()
        frame.pts = pts
        frame.time_base = time_base
        return frame

    def stop(self) -> None:
        """Release screen capture resources."""
        super().stop()
        if self._sct:
            try:
                self._sct.close()
            except Exception:
                pass
            self._sct = None


class StreamManager:
    """Manages WebRTC PeerConnection lifecycle and screen-sharing session states."""

    _active_pc: Optional[RTCPeerConnection] = None
    _active_track: Optional[DesktopVideoStreamTrack] = None
    _is_streaming: bool = False
    _started_at: Optional[float] = None
    _client_id: Optional[str] = None
    _fps: int = 20
    _resolution: str = "720p"

    @classmethod
    def is_active(cls) -> bool:
        """Check if a screen sharing session is currently active."""
        return cls._is_streaming and cls._active_pc is not None

    @classmethod
    def get_status(cls) -> dict:
        """Return metadata regarding the current stream session."""
        uptime = (time.time() - cls._started_at) if (cls.is_active() and cls._started_at) else None
        return {
            "is_streaming": cls.is_active(),
            "client_id": cls._client_id if cls.is_active() else None,
            "uptime_seconds": round(uptime, 1) if uptime is not None else None,
            "fps": cls._fps if cls.is_active() else None,
            "resolution": cls._resolution if cls.is_active() else None,
        }

    @classmethod
    def _display_laptop_indicator(cls, active: bool) -> None:
        """Print clear screen-sharing indicator on laptop terminal."""
        if active:
            logger.info("==============================================================")
            logger.info(" [SCREEN SHARING ACTIVE] Windows desktop is now streaming!")
            logger.info(" Client: %s | Settings: %s @ %s FPS", cls._client_id, cls._resolution, cls._fps)
            logger.info(" Laptop Stop Command: POST http://127.0.0.1:8000/api/stream/stop")
            logger.info("==============================================================")
        else:
            logger.info("==============================================================")
            logger.info(" [SCREEN SHARING STOPPED] Stream ended. Resources released.")
            logger.info("==============================================================")

    @classmethod
    async def start_stream(
        cls,
        sdp_offer: str,
        sdp_type: str = "offer",
        fps: int = 20,
        resolution: str = "720p",
        client_id: str = "PocketDesk Web Client",
        mode: str = "local",
    ) -> dict:
        """
        Negotiate WebRTC connection with browser client using SDP offer/answer exchange.
        Terminates any previously existing session to support browser refreshes.
        Configures STUN/TURN ICE servers when running in remote internet mode.
        """
        # Close any prior stale connection cleanly
        await cls.stop_stream()

        cls._fps = max(5, min(fps, 60))
        cls._resolution = resolution if resolution in RESOLUTION_MAP else "720p"
        cls._client_id = client_id

        # Instantiate WebRTC PeerConnection (configured with STUN/TURN if remote mode)
        if mode == "remote":
            ice_config = TurnService.build_ice_server_config(client_id)
            rtc_servers = []
            for s in ice_config.get("ice_servers", []):
                urls = s.get("urls", [])
                if isinstance(urls, str):
                    urls = [urls]
                username = s.get("username")
                credential = s.get("credential")
                if username and credential:
                    rtc_servers.append(RTCIceServer(urls=urls, username=username, credential=credential))
                else:
                    rtc_servers.append(RTCIceServer(urls=urls))
            configuration = RTCConfiguration(iceServers=rtc_servers)
            pc = RTCPeerConnection(configuration=configuration)
        else:
            pc = RTCPeerConnection()

        cls._active_pc = pc

        # Create capture track
        track = DesktopVideoStreamTrack(fps=cls._fps, resolution=cls._resolution)
        cls._active_track = track
        pc.addTrack(track)

        # Connection state monitoring
        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info("WebRTC Connection state changed to: %s", pc.connectionState)
            if pc.connectionState in ("failed", "closed", "disconnected"):
                logger.info("WebRTC connection %s. Cleaning up stream.", pc.connectionState)
                await cls.stop_stream()

        # Set remote offer and generate local answer
        offer = RTCSessionDescription(sdp=sdp_offer, type=sdp_type)
        await pc.setRemoteDescription(offer)

        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        cls._is_streaming = True
        cls._started_at = time.time()
        cls._display_laptop_indicator(True)

        return {
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type,
            "status": "streaming",
            "fps": cls._fps,
            "resolution": cls._resolution,
        }

    @classmethod
    async def stop_stream(cls) -> bool:
        """Terminate active WebRTC stream session and cleanup capture resources."""
        was_active = cls.is_active()

        if cls._active_track:
            cls._active_track.stop()
            cls._active_track = None

        if cls._active_pc:
            pc = cls._active_pc
            cls._active_pc = None
            try:
                await pc.close()
            except Exception as exc:
                logger.debug("Error while closing peer connection: %s", exc)

        cls._is_streaming = False
        cls._started_at = None
        cls._client_id = None

        if was_active:
            cls._display_laptop_indicator(False)

        return was_active
