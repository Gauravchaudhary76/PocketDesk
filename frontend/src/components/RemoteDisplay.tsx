import React, { useRef, useState, useEffect } from 'react';
import {
  MonitorOff,
  Loader2,
  AlertTriangle,
  Play,
  Square,
  Maximize2,
  Minimize2,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Power,
  Sliders,
  Tv,
  Info,
  Keyboard,
  MousePointer,
  Hand
} from 'lucide-react';
import type { ConnectionStatus, StreamResolution } from '../types';
import { StageBadge } from './StageBadge';
import { VirtualKeyboard } from './VirtualKeyboard';
import { mapClientCoordsToNormalized } from '../services/input';

interface RemoteDisplayProps {
  status: ConnectionStatus;
  isStreaming: boolean;
  isStartingStream: boolean;
  streamError: string | null;
  streamFps: number;
  streamResolution: StreamResolution;
  webrtcState: RTCPeerConnectionState | 'disconnected';
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isInputEnabled: boolean;
  isKeyboardOpen: boolean;
  onFpsChange: (fps: number) => void;
  onResolutionChange: (res: StreamResolution) => void;
  onStartStream: () => void;
  onStopStream: () => void;
  onToggleInput: (enabled: boolean) => void;
  onToggleKeyboard: () => void;
  onMouseMove: (normX: number, normY: number) => void;
  onMouseClick: (
    button: 'left' | 'right' | 'middle',
    action?: 'click' | 'double_click' | 'down' | 'up',
    normX?: number,
    normY?: number
  ) => void;
  onMouseScroll: (deltaY: number) => void;
  onSendKey: (key: string, action?: 'press' | 'down' | 'up') => void;
  onSendText: (text: string) => void;
  onSendShortcut: (keys: string[]) => void;
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
}

export const RemoteDisplay: React.FC<RemoteDisplayProps> = ({
  status,
  isStreaming,
  isStartingStream,
  streamError,
  streamFps,
  streamResolution,
  webrtcState,
  videoRef,
  isInputEnabled,
  isKeyboardOpen,
  onFpsChange,
  onResolutionChange,
  onStartStream,
  onStopStream,
  onToggleInput,
  onToggleKeyboard,
  onMouseMove,
  onMouseClick,
  onMouseScroll,
  onSendKey,
  onSendText,
  onSendShortcut,
  onOpenInfo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Gesture tracking refs
  const pointerDownRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastNormPosRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const touchStartTimeRef = useRef<number>(0);
  const longPressTimerRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Monitor fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Fullscreen blocked by browser policy without direct user gesture
    }
  };

  const getResolutionDimensions = (res: StreamResolution): string => {
    switch (res) {
      case '1080p':
        return '1920 × 1080';
      case '720p':
        return '1280 × 720';
      case '540p':
        return '960 × 540';
      case '480p':
        return '854 × 480';
      default:
        return '1280 × 720';
    }
  };

  // Touch and pointer interaction on the video canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isStreaming || !isInputEnabled || !viewportRef.current) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointerDownRef.current = true;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    touchStartTimeRef.current = performance.now();
    isDraggingRef.current = false;

    const norm = mapClientCoordsToNormalized(e.clientX, e.clientY, viewportRef.current);
    if (norm) {
      lastNormPosRef.current = norm;
      onMouseMove(norm.x, norm.y);

      // Long press detection for Right Click (380ms)
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        if (pointerDownRef.current && !isDraggingRef.current) {
          onMouseClick('right', 'click', norm.x, norm.y);
          pointerDownRef.current = false;
        }
      }, 380);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isStreaming || !isInputEnabled || !pointerDownRef.current || !viewportRef.current) return;

    const moveDist = Math.hypot(
      e.clientX - startPosRef.current.x,
      e.clientY - startPosRef.current.y
    );

    if (moveDist > 6) {
      // Movement detected, cancel long-press right click
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // If user holds down and drags, initiate drag
      if (!isDraggingRef.current && performance.now() - touchStartTimeRef.current > 150) {
        isDraggingRef.current = true;
        onMouseClick('left', 'down', lastNormPosRef.current.x, lastNormPosRef.current.y);
      }
    }

    const norm = mapClientCoordsToNormalized(e.clientX, e.clientY, viewportRef.current);
    if (norm) {
      lastNormPosRef.current = norm;
      onMouseMove(norm.x, norm.y);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isStreaming || !isInputEnabled) return;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const elapsed = performance.now() - touchStartTimeRef.current;
    const moveDist = Math.hypot(
      e.clientX - startPosRef.current.x,
      e.clientY - startPosRef.current.y
    );

    if (isDraggingRef.current) {
      // Release held drag
      onMouseClick('left', 'up', lastNormPosRef.current.x, lastNormPosRef.current.y);
      isDraggingRef.current = false;
    } else if (elapsed < 300 && moveDist < 6) {
      // Quick tap without significant drag triggers Left Click
      onMouseClick('left', 'click', lastNormPosRef.current.x, lastNormPosRef.current.y);
    }

    pointerDownRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isStreaming || !isInputEnabled) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -120 : 120;
    onMouseScroll(delta);
  };

  return (
    <div
      ref={containerRef}
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none bg-black' : ''
      }`}
    >
      {/* Remote display window top bar */}
      <div className="bg-slate-950/95 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isStreaming
                  ? isInputEnabled
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-500 animate-pulse'
                  : status === 'connected'
                  ? 'bg-blue-500'
                  : 'bg-slate-700'
              }`}
            />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700/80" />
          </div>

          <span className="font-mono text-[11px] text-slate-300 ml-1 flex items-center gap-1.5">
            {isStreaming ? (
              <>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  LIVE
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">
                  {getResolutionDimensions(streamResolution)} @ {streamFps} FPS
                </span>
                {isInputEnabled && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <Hand className="w-3 h-3" />
                      INPUT ACTIVE
                    </span>
                  </>
                )}
              </>
            ) : (
              <span>Display 1: Windows Host Virtual Viewport</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Stream telemetry indicator */}
          <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-400 mr-2">
            <span>RTC: {webrtcState}</span>
            <span>FPS: {streamFps}</span>
            <span>Input: {isInputEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>

          {/* Architecture info button */}
          <button
            type="button"
            onClick={() =>
              onOpenInfo(
                5,
                'Stage 5 Remote Input Architecture & Win32 Injection',
                'PocketDesk transmits touch gestures, relative trackpad motions, and keyboard keystrokes to your Windows laptop using low-latency WebSockets and Win32 SendInput.',
                [
                  'Touch-to-Screen Mapping: Client calculates letterbox/pillarbox offsets and normalizes coordinates [0.0, 1.0].',
                  'Win32 Input Injection: ctypes interface to SetCursorPos, mouse_event, and SendInput.',
                  'Unicode Text Support: SendInput KEYEVENTF_UNICODE handles arbitrary international characters.',
                  'Safety Kill Switch: Immediate disable button releases all held keys and mouse buttons.',
                  'UIPI Restriction: Windows Secure Desktop (Ctrl+Alt+Del, UAC prompts) cannot be controlled by non-elevated apps.'
                ]
              )
            }
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Stage 5 Architecture Info"
            aria-label="Architecture Info"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* Stream settings toggle */}
          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors ${
              showSettings ? 'bg-slate-800 text-blue-400' : 'hover:bg-slate-800'
            }`}
            title="Configure Stream Resolution & FPS"
            aria-label="Stream Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Stream Settings Drawer */}
      {showSettings && (
        <div className="bg-slate-950 border-b border-slate-800 p-3 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>WebRTC Stream Configuration</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Resolution:</span>
              <select
                value={streamResolution}
                disabled={isStreaming || isStartingStream}
                onChange={(e) => onResolutionChange(e.target.value as StreamResolution)}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="1080p">1080p (1920×1080 Native)</option>
                <option value="720p">720p (1280×720 Recommended)</option>
                <option value="540p">540p (960×540 Low Bandwidth)</option>
                <option value="480p">480p (854×480 Minimal CPU)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Frame Rate:</span>
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                {[15, 20, 30].map((fps) => (
                  <button
                    key={fps}
                    type="button"
                    disabled={isStreaming || isStartingStream}
                    onClick={() => onFpsChange(fps)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                      streamFps === fps
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    } disabled:opacity-50`}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 16:9 Aspect Ratio Display Viewport & Touch Interaction Surface */}
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className={`relative w-full ${
          isFullscreen ? 'flex-1 h-full' : 'aspect-video'
        } bg-slate-950 flex flex-col items-center justify-center text-center select-none overflow-hidden touch-none ${
          isStreaming && isInputEnabled ? 'cursor-crosshair' : ''
        }`}
      >
        {/* Grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Video Player Canvas */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain bg-black pointer-events-none ${
            isStreaming ? 'block' : 'hidden'
          }`}
        />

        {/* Floating In-Stream Overlay Bar (visible when streaming) */}
        {isStreaming && (
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
            <div className="flex items-center gap-2 pointer-events-auto">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-semibold backdrop-blur-md shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-slate-300 text-[11px] font-mono backdrop-blur-md">
                {streamResolution} • {streamFps} FPS
              </span>
            </div>

            {/* Quick in-stream action buttons */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Virtual Keyboard Toggle */}
              <button
                type="button"
                onClick={onToggleKeyboard}
                className={`p-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md transition-all cursor-pointer ${
                  isKeyboardOpen
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                    : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
                title="Toggle On-Screen Keyboard"
              >
                <Keyboard className="w-4 h-4" />
              </button>

              {/* Input Enable / Emergency Stop Button */}
              {isInputEnabled ? (
                <button
                  type="button"
                  onClick={() => onToggleInput(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 backdrop-blur-md transition-all cursor-pointer"
                  title="Immediately stop mouse and keyboard remote control"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Disable Input</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleInput(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 backdrop-blur-md transition-all cursor-pointer"
                  title="Enable remote touch and keyboard control"
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Enable Input</span>
                </button>
              )}

              {/* Stop Desktop Sharing Button */}
              <button
                type="button"
                onClick={onStopStream}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 backdrop-blur-md transition-all cursor-pointer"
                title="Stop Desktop Screen Sharing"
              >
                <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                <span className="hidden sm:inline">Stop Stream</span>
              </button>
            </div>
          </div>
        )}

        {/* In-Stream Bottom Input Status Pill */}
        {isStreaming && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[11px] backdrop-blur-md flex items-center gap-1.5 pointer-events-none z-20">
            {isInputEnabled ? (
              <>
                <MousePointer className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300 font-medium">Touch to click & drag • Long-press for right-click</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                <span className="text-slate-400">View Only • Enable remote input above to interact</span>
              </>
            )}
          </div>
        )}

        {/* State: NEGOTIATING / STARTING STREAM */}
        {isStartingStream && (
          <div className="max-w-md flex flex-col items-center z-10 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-cyan-500/10 blur-sm -z-10 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-cyan-300">
                Starting Screen Share...
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Initiating authenticated WebRTC handshake with Windows agent and gathering local network ICE candidates.
              </p>
            </div>

            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-pulse w-3/4" />
            </div>

            <button
              type="button"
              onClick={onStopStream}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* State: CONNECTED / READY TO STREAM */}
        {status === 'connected' && !isStreaming && !isStartingStream && (
          <div className="max-w-md flex flex-col items-center z-10 space-y-4 p-6">
            {streamError ? (
              <div className="w-full bg-rose-950/30 border border-rose-800/60 rounded-xl p-3 text-left space-y-1 text-xs text-rose-200">
                <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Screen Streaming Error</span>
                </div>
                <p className="text-slate-300 text-[11px]">{streamError}</p>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-blue-950/40 border border-blue-800/60 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-950/50">
                <Tv className="w-8 h-8" />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-base font-semibold text-white">
                  Windows Desktop Stream Ready
                </h3>
                <StageBadge stage={5} label="Stage 5 Interactive" variant="filled" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Desktop capture starts strictly upon your explicit command. Starting the stream enables viewing and optional touch/mouse input control.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
              <span>Target: <span className="text-slate-200 font-semibold">{streamResolution}</span></span>
              <span>•</span>
              <span>FPS: <span className="text-slate-200 font-semibold">{streamFps} FPS</span></span>
              <span>•</span>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="text-blue-400 hover:text-blue-300 cursor-pointer underline"
              >
                Change
              </button>
            </div>

            <button
              type="button"
              onClick={onStartStream}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Screen Sharing</span>
            </button>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/70 text-[11px] text-slate-400 text-left w-full flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Direct WebRTC peer connection with zero external cloud relays. Remote input requires explicit enablement and can be terminated instantly.
              </span>
            </div>
          </div>
        )}

        {/* State: DISCONNECTED */}
        {status === 'disconnected' && !isStreaming && !isStartingStream && (
          <div className="max-w-md flex flex-col items-center z-10 space-y-3 p-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-inner">
              <MonitorOff className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-base font-semibold text-white">
                  Remote Display Inactive
                </h3>
                <StageBadge stage={5} label="Stage 5" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect and authenticate with your Windows laptop agent over local Wi-Fi to start streaming your desktop and interact via touch controls.
              </p>
            </div>
          </div>
        )}

        {/* State: CONNECTING / PAIRING */}
        {status === 'connecting' && !isStreaming && !isStartingStream && (
          <div className="max-w-md flex flex-col items-center z-10 space-y-4 p-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-cyan-500/10 blur-sm -z-10 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-cyan-300">
                Connecting to Laptop Host...
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verifying agent availability and preparing secure local network session...
              </p>
            </div>
          </div>
        )}

        {/* State: ERROR */}
        {status === 'error' && !isStreaming && !isStartingStream && (
          <div className="max-w-md flex flex-col items-center z-10 space-y-3 p-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/50">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-rose-300">
                Remote Host Unreachable
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Could not establish communication with the Windows laptop agent.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* On-Screen Virtual Keyboard Drawer */}
      <VirtualKeyboard
        isOpen={isKeyboardOpen}
        onClose={onToggleKeyboard}
        onSendKey={onSendKey}
        onSendText={onSendText}
        onSendShortcut={onSendShortcut}
        onOpenInfo={onOpenInfo}
      />
    </div>
  );
};
