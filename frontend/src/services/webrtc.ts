/**
 * PocketDesk WebRTC Stream Client
 * Manages peer connection negotiation, SDP offer/answer exchange,
 * and media stream attachment over local network.
 */

export interface StreamOptions {
  fps: number;
  resolution: '1080p' | '720p' | '540p' | '480p';
}

export class WebRtcStreamClient {
  private pc: RTCPeerConnection | null = null;
  private agentUrl: string = '';
  private token: string = '';

  /**
   * Start a WebRTC screen-sharing session with the Windows agent.
   */
  async startStream(
    agentUrl: string,
    token: string,
    options: StreamOptions,
    onTrack: (stream: MediaStream) => void,
    onStateChange: (state: RTCPeerConnectionState) => void
  ): Promise<boolean> {
    this.agentUrl = agentUrl;
    this.token = token;

    // Close any prior connection cleanly
    await this.stopStream();

    // Local-only peer connection (empty iceServers prevents third-party leaks)
    const pc = new RTCPeerConnection({
      iceServers: [],
    });
    this.pc = pc;

    // Listen for connection state updates
    pc.onconnectionstatechange = () => {
      onStateChange(pc.connectionState);
    };

    // Receive the video track from the agent
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        onTrack(event.streams[0]);
      }
    };

    // Request receive-only video from agent
    pc.addTransceiver('video', { direction: 'recvonly' });

    // Create SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait briefly for local host ICE candidates to gather into SDP
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 800);
      }
    });

    // Send authenticated SDP offer to agent signaling endpoint
    const response = await fetch(`${agentUrl}/api/stream/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sdp: pc.localDescription?.sdp || offer.sdp,
        type: 'offer',
        fps: options.fps,
        resolution: options.resolution,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const message = errorJson.detail || `Signaling failed with status ${response.status}`;
      throw new Error(message);
    }

    const answer = await response.json();

    // Set remote answer returned by Windows agent
    await pc.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: answer.sdp,
      })
    );

    return true;
  }

  /**
   * Stop the WebRTC stream and notify agent to release capture resources.
   */
  async stopStream(): Promise<void> {
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // Ignore close error
      }
      this.pc = null;
    }

    if (this.agentUrl && this.token) {
      try {
        await fetch(`${this.agentUrl}/api/stream/stop`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          signal: AbortSignal.timeout(2000),
        }).catch(() => {});
      } catch {
        // Ignore unreachability during stop
      }
    }
  }

  /**
   * Return current connection state.
   */
  getConnectionState(): RTCPeerConnectionState | 'uninitialized' {
    return this.pc ? this.pc.connectionState : 'uninitialized';
  }
}

export const streamClient = new WebRtcStreamClient();
