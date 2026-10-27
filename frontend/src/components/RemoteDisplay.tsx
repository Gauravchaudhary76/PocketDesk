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
  Power,
  Sliders,
  Tv,
  Info,
  Keyboard,
  MousePointer,
  Hand,
  Mouse,
  Touchpad,
  Send,
  Sparkles,
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
  onMouseMoveRelative?: (dx: number, dy: number) => void;
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
  onMouseMoveRelative,
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

  // Input control configuration: 'touch' (direct on video) vs 'trackpad' (dedicated surface below screen)
  const [controlMode, setControlMode] = useState<'touch' | 'trackpad'>('touch');
  const [isDragLock, setIsDragLock] = useState<boolean>(false);
  const [trackpadSensitivity, setTrackpadSensitivity] = useState<number>(1.2);
  const [showSensitivity, setShowSensitivity] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [typedText, setTypedText] = useState<string>('');

  // Direct touch gesture tracking refs (on video viewport)
  const pointerDownRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastNormPosRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const touchStartTimeRef = useRef<number>(0);
  const longPressTimerRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Trackpad gesture tracking refs (on dedicated trackpad area)
  const trackpadLastPosRef = useRef<{ x: number; y: number } | null>(null);
  const trackpadStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const trackpadStartRef = useRef<number>(0);

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

  // Direct touch and pointer interaction on the video canvas
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

  // Trackpad gesture handlers (relative motion on dedicated surface below screen)
  const handleTrackpadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInputEnabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    trackpadLastPosRef.current = { x: e.clientX, y: e.clientY };
    trackpadStartPosRef.current = { x: e.clientX, y: e.clientY };
    trackpadStartRef.current = performance.now();
  };

  const handleTrackpadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInputEnabled || !trackpadLastPosRef.current) return;
    const dx = (e.clientX - trackpadLastPosRef.current.x) * trackpadSensitivity;
    const dy = (e.clientY - trackpadLastPosRef.current.y) * trackpadSensitivity;
    trackpadLastPosRef.current = { x: e.clientX, y: e.clientY };

    if (onMouseMoveRelative) {
      onMouseMoveRelative(dx, dy);
    }
  };

  const handleTrackpadPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInputEnabled || !trackpadLastPosRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const elapsed = performance.now() - trackpadStartRef.current;
    const moveDist = Math.hypot(
      e.clientX - trackpadStartPosRef.current.x,
      e.clientY - trackpadStartPosRef.current.y
    );

    // Tap detection: short tap with minimal movement (< 6px) triggers left click
    if (elapsed < 280 && moveDist < 6) {
      onMouseClick('left', 'click');
    }

    trackpadLastPosRef.current = null;
  };

  // Drag lock toggle
  const toggleDragLock = () => {
    if (!isInputEnabled) return;
    if (!isDragLock) {
      onMouseClick('left', 'down');
      setIsDragLock(true);
    } else {
      onMouseClick('left', 'up');
      setIsDragLock(false);
    }
  };

  // Quick text dispatch
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedText.trim() || !isInputEnabled) return;
    onSendText(typedText);
    setTypedText('');
  };

  const hotkeys = [
    { label: 'Alt+Tab', desc: 'Switch Window', action: () => onSendShortcut(['alt', 'tab']) },
    { label: 'Win + D', desc: 'Show Desktop', action: () => onSendShortcut(['win', 'd']) },
    { label: 'Win + E', desc: 'File Explorer', action: () => onSendShortcut(['win', 'e']) },
    { label: 'Ctrl + C', desc: 'Copy', action: () => onSendShortcut(['ctrl', 'c']) },
    { label: 'Ctrl + V', desc: 'Paste', action: () => onSendShortcut(['ctrl', 'v']) },
    { label: 'Esc', desc: 'Escape', action: () => onSendKey('escape') },
    { label: 'Enter', desc: 'Enter', action: () => onSendKey('enter') },
    { label: 'Tab', desc: 'Next Field', action: () => onSendKey('tab') },
    { label: 'Win + R', desc: 'Run Dialog', action: () => onSendShortcut(['win', 'r']) },
  ];

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
              <span>Windows Host Virtual Viewport</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Stream telemetry indicator */}
          <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-400 mr-2">
            <span>RTC: {webrtcState}</span>
            <span>FPS: {streamFps}</span>
            <span>Input: {isInputEnabled ? 'Active' : 'Disabled'}</span>
          </div>

          {/* Architecture info button */}
          <button
            type="button"
            onClick={() =>
              onOpenInfo(
                5,
                'Remote Input Architecture & Win32 Injection',
                'PocketDesk transmits touch gestures, relative trackpad motions, and keyboard keystrokes to your Windows laptop using low-latency WebSockets and Win32 SendInput.',
                [
                  'Unified Control: View live desktop video while interacting with mouse and keyboard controls on the same screen.',
                  'Direct Touch: Touch directly on the screen to click and drag.',
                  'Virtual Trackpad: Drag on the touchpad surface below the display for high-precision cursor tracking.',
                  'Win32 Input Injection: ctypes interface calling SetCursorPos, mouse_event, and SendInput.',
                  'Safety Kill Switch: Immediate disable button releases all held keys and mouse buttons.'
                ]
              )
            }
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Architecture Info"
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
                <option value="720p">720p (1280×720 HD)</option>
                <option value="540p">540p (960×540 Medium)</option>
                <option value="480p">480p (854×480 Low Bandwidth)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Paced FPS:</span>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                {[15, 20, 30, 60].map((fps) => (
                  <button
                    key={fps}
                    type="button"
                    disabled={isStreaming || isStartingStream}
                    onClick={() => onFpsChange(fps)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                      streamFps === fps
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
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
                Initiating authenticated WebRTC handshake with Windows agent...
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
                <StageBadge stage={5} label="Live Interactive" variant="filled" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Start screen streaming to view your desktop and control your mouse and keyboard simultaneously.
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
                <StageBadge stage={5} label="Remote Input" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect and authenticate with your Windows laptop to stream your screen and control your mouse.
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
                Verifying agent availability and preparing secure session...
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

      {/* ========================================================================= */}
      {/* UNIFIED MOUSE & KEYBOARD CONTROL DECK (Directly Attached Under Viewport)   */}
      {/* ========================================================================= */}
      {!isFullscreen && (
        <div className="bg-slate-950 border-t border-slate-800 p-4 sm:p-5 space-y-4">
          {/* Top Control Bar: Input Mode Selector & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            {/* Input Mode Selector: Direct Screen Touch vs Dedicated Trackpad */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setControlMode('touch')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  controlMode === 'touch'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tap and drag directly on the video screen"
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>Screen Touch</span>
              </button>

              <button
                type="button"
                onClick={() => setControlMode('trackpad')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  controlMode === 'trackpad'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Use trackpad zone below display so fingers do not block your view"
              >
                <Touchpad className="w-3.5 h-3.5" />
                <span>Trackpad Deck</span>
              </button>
            </div>

            {/* Quick Actions: Keyboard, Shortcuts & Sensitivity */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleKeyboard}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  isKeyboardOpen
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                }`}
                title="Toggle On-Screen Virtual Keyboard"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Keyboard</span>
              </button>

              <button
                type="button"
                onClick={() => setShowShortcuts((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  showShortcuts
                    ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                }`}
                title="Toggle Windows Shortcuts"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Shortcuts</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSensitivity((prev) => !prev)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Trackpad Sensitivity"
              >
                <Sliders className="w-4 h-4 text-cyan-400" />
              </button>
            </div>
          </div>

          {/* Sensitivity Slider (Collapsible) */}
          {showSensitivity && (
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-3 text-xs">
              <span className="text-slate-400 text-xs font-medium">Trackpad Speed:</span>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={trackpadSensitivity}
                onChange={(e) => setTrackpadSensitivity(parseFloat(e.target.value))}
                className="flex-1 accent-blue-500 cursor-pointer"
              />
              <span className="font-mono text-cyan-300 font-semibold text-xs w-10">
                {trackpadSensitivity}x
              </span>
            </div>
          )}

          {/* Trackpad Mode Surface (rendered when trackpad mode is selected) */}
          {controlMode === 'trackpad' && (
            <div className="space-y-2">
              <div
                onPointerDown={handleTrackpadPointerDown}
                onPointerMove={handleTrackpadPointerMove}
                onPointerUp={handleTrackpadPointerUp}
                onPointerCancel={handleTrackpadPointerUp}
                className={`relative h-36 sm:h-44 w-full rounded-2xl border-2 flex flex-col items-center justify-center p-4 transition-all touch-none select-none ${
                  isInputEnabled
                    ? 'bg-slate-900/90 border-slate-700/80 hover:border-blue-500/60 cursor-crosshair active:bg-slate-900 shadow-inner'
                    : 'bg-slate-950/60 border-dashed border-slate-800/80 cursor-not-allowed opacity-60'
                }`}
              >
                {isInputEnabled ? (
                  <div className="flex flex-col items-center text-center space-y-1 pointer-events-none">
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shadow-md">
                      <Mouse className="w-5 h-5 animate-pulse" />
                    </div>
                    <p className="text-xs font-semibold text-slate-200">
                      Trackpad Surface Active
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Slide your thumb here to glide the cursor on the screen above • Tap = Left Click
                    </p>
                    {isDragLock && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/40">
                        Drag Lock Active (Left Button Down)
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center space-y-1 pointer-events-none">
                    <Mouse className="w-6 h-6 text-slate-600 mb-1" />
                    <p className="text-xs font-medium text-slate-400">
                      Trackpad Input Disabled
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      Tap "Enable Input" above to authorize mouse control.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tactile Mouse Click Buttons Bar (Left Click, Drag Lock, Middle, Right, Scroll) */}
          <div className="grid grid-cols-6 gap-2">
            {/* Primary Left Click */}
            <button
              type="button"
              disabled={!isInputEnabled}
              onClick={() => onMouseClick('left', 'click')}
              className="col-span-2 py-3 px-3 rounded-xl bg-blue-600/90 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Left Click</span>
            </button>

            {/* Drag Lock */}
            <button
              type="button"
              disabled={!isInputEnabled}
              onClick={toggleDragLock}
              className={`py-3 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center text-center ${
                isDragLock
                  ? 'bg-amber-950/80 border-amber-500/80 text-amber-200 shadow-md shadow-amber-900/30'
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
              }`}
              title="Hold left mouse button down to drag windows or highlight text"
            >
              <span>{isDragLock ? 'Release Drag' : 'Drag Lock'}</span>
            </button>

            {/* Middle Click */}
            <button
              type="button"
              disabled={!isInputEnabled}
              onClick={() => onMouseClick('middle', 'click')}
              className="py-3 px-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 active:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-300 transition-all cursor-pointer text-center"
            >
              <span>Middle</span>
            </button>

            {/* Right Click */}
            <button
              type="button"
              disabled={!isInputEnabled}
              onClick={() => onMouseClick('right', 'click')}
              className="col-span-2 py-3 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 active:bg-slate-800 disabled:opacity-40 text-xs font-bold text-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Right Click</span>
            </button>
          </div>

          {/* Vertical Scroll & Navigation Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!isInputEnabled}
              onClick={() => onMouseScroll(120)}
              className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800/80 text-xs font-medium text-slate-300 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>▲ Scroll Up</span>
            </button>
            <button
              type="button"
              disabled={!isInputEnabled}
              onClick={() => onMouseScroll(-120)}
              className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800/80 text-xs font-medium text-slate-300 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>▼ Scroll Down</span>
            </button>
          </div>

          {/* Quick Windows Shortcuts Bar (Collapsible) */}
          {showShortcuts && (
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Windows Keyboard Shortcuts:
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {hotkeys.map((hk) => (
                  <button
                    key={hk.label}
                    type="button"
                    disabled={!isInputEnabled}
                    onClick={hk.action}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-center transition-all cursor-pointer disabled:opacity-40"
                  >
                    <span className="font-mono text-xs font-bold text-slate-200 block">
                      {hk.label}
                    </span>
                    <span className="text-[9px] text-slate-400 truncate block">
                      {hk.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Text Input Dispatch */}
          <form onSubmit={handleTextSubmit} className="pt-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={typedText}
                disabled={!isInputEnabled}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={
                  isInputEnabled
                    ? 'Type text here to inject directly into active Windows window...'
                    : 'Enable remote input to type...'
                }
                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isInputEnabled || !typedText.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/30 shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </form>
        </div>
      )}

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
