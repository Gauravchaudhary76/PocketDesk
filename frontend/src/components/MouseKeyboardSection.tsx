import React, { useRef, useState } from 'react';
import {
  Mouse,
  Keyboard,
  Send,
  Touchpad,
  ShieldAlert,
  ShieldCheck,
  Power,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { StageBadge } from './StageBadge';

interface MouseKeyboardSectionProps {
  isInputEnabled: boolean;
  isConnected: boolean;
  onToggleInput: (enabled: boolean) => void;
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
  onMouseMoveRelative: (dx: number, dy: number) => void;
  onMouseClick: (button: 'left' | 'right' | 'middle', action?: 'click' | 'double_click' | 'down' | 'up') => void;
  onMouseScroll: (deltaY: number) => void;
  onSendKey: (key: string, action?: 'press' | 'down' | 'up') => void;
  onSendText: (text: string) => void;
  onSendShortcut: (keys: string[]) => void;
}

export const MouseKeyboardSection: React.FC<MouseKeyboardSectionProps> = ({
  isInputEnabled,
  isConnected,
  onToggleInput,
  onOpenInfo,
  onMouseMoveRelative,
  onMouseClick,
  onMouseScroll,
  onSendKey,
  onSendText,
  onSendShortcut,
}) => {
  const [typedText, setTypedText] = useState<string>('');
  const [isDragLock, setIsDragLock] = useState<boolean>(false);
  const [sensitivity, setSensitivity] = useState<number>(1.2);
  const [showSensitivity, setShowSensitivity] = useState<boolean>(false);

  // Trackpad gesture tracking refs
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchCountRef = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInputEnabled || !isConnected) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    lastTouchRef.current = { x: e.clientX, y: e.clientY };
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    touchStartTimeRef.current = performance.now();
    touchCountRef.current = 1;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInputEnabled || !isConnected || !lastTouchRef.current) return;
    const dx = (e.clientX - lastTouchRef.current.x) * sensitivity;
    const dy = (e.clientY - lastTouchRef.current.y) * sensitivity;
    lastTouchRef.current = { x: e.clientX, y: e.clientY };

    onMouseMoveRelative(dx, dy);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInputEnabled || !isConnected || !lastTouchRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const elapsed = performance.now() - touchStartTimeRef.current;
    const moveDist = Math.hypot(
      e.clientX - touchStartPosRef.current.x,
      e.clientY - touchStartPosRef.current.y
    );

    // Tap detection: short tap with minimal movement (< 6px) triggers left click
    if (elapsed < 280 && moveDist < 6) {
      onMouseClick('left', 'click');
    }

    lastTouchRef.current = null;
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedText.trim()) return;
    onSendText(typedText);
    setTypedText('');
  };

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

  const handleCtrlAltDel = () => {
    onOpenInfo(
      5,
      'Windows Secure Desktop Limitation (Ctrl+Alt+Del & UAC)',
      'Windows User Interface Privilege Isolation (UIPI) forbids standard non-elevated applications from sending synthetic keystrokes to the Secure Desktop (such as the Ctrl+Alt+Del screen or Administrator UAC elevation prompts).',
      [
        'Standard Windows security prevents remote control of the Ctrl+Alt+Del screen.',
        'To respond to Administrator UAC prompts remotely, the PocketDesk agent must be run as Administrator.',
        'Physical access or Windows Service elevation is required to unlock a locked Windows session.'
      ]
    );
  };

  const hotkeys = [
    { label: 'Ctrl+Alt+Del', desc: 'Security Notice', action: handleCtrlAltDel },
    { label: 'Alt+Tab', desc: 'Switch Window', action: () => onSendShortcut(['alt', 'tab']) },
    { label: 'Win + D', desc: 'Show Desktop', action: () => onSendShortcut(['win', 'd']) },
    { label: 'Win + E', desc: 'File Explorer', action: () => onSendShortcut(['win', 'e']) },
    { label: 'Esc', desc: 'Escape Key', action: () => onSendKey('escape') },
    { label: 'Enter', desc: 'Return Key', action: () => onSendKey('enter') },
    { label: 'Tab', desc: 'Next Field', action: () => onSendKey('tab') },
    { label: 'Win + R', desc: 'Run Dialog', action: () => onSendShortcut(['win', 'r']) },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-950/70 border border-blue-800/60 text-blue-400">
            <Mouse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                Mouse & Keyboard Controls
              </h3>
              <StageBadge stage={5} label="Stage 5 Active" variant="filled" />
            </div>
            <p className="text-xs text-slate-400">
              Low-latency virtual trackpad and authenticated Windows input injection
            </p>
          </div>
        </div>

        {/* Remote Input Master Toggle / Emergency Kill Switch */}
        <div className="flex items-center gap-2">
          {isInputEnabled ? (
            <button
              type="button"
              onClick={() => onToggleInput(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-900/40 transition-all cursor-pointer"
              title="Immediately disable remote input and release held keys"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Emergency Disable Input</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!isConnected}
              onClick={() => onToggleInput(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Enable Remote Input</span>
            </button>
          )}
        </div>
      </div>

      {/* Input Safety Banner when disabled */}
      {!isInputEnabled && (
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start gap-2.5 text-xs text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">Remote Input is currently disabled for safety.</span>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Tap <strong>Enable Remote Input</strong> above to authorize your phone to control mouse cursor movement, clicks, and keystrokes on your laptop.
            </p>
          </div>
        </div>
      )}

      {/* Trackpad Simulation Area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-medium text-slate-300 flex items-center gap-1.5">
            <Touchpad className="w-4 h-4 text-cyan-400" />
            Virtual Trackpad Zone
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSensitivity((prev) => !prev)}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3 h-3 text-blue-400" />
              <span>Speed: {sensitivity}x</span>
              {showSensitivity ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Speed Adjustment Slider */}
        {showSensitivity && (
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3 text-xs">
            <span className="text-slate-400 text-[11px]">Sensitivity:</span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500 cursor-pointer"
            />
            <span className="font-mono text-slate-300 text-[11px] w-8">{sensitivity}x</span>
          </div>
        )}

        {/* Trackpad Gesture Surface */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative h-48 sm:h-56 w-full rounded-2xl border-2 flex flex-col items-center justify-center p-4 transition-all touch-none select-none ${
            isInputEnabled && isConnected
              ? 'bg-slate-950 border-slate-700/80 hover:border-blue-500/60 cursor-crosshair active:bg-slate-900/90 shadow-inner'
              : 'bg-slate-950/50 border-dashed border-slate-800/80 cursor-not-allowed opacity-60'
          }`}
          role="region"
          aria-label="Virtual Trackpad"
        >
          {isInputEnabled ? (
            <div className="flex flex-col items-center text-center space-y-1.5 pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-blue-400 shadow-md">
                <Mouse className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-xs font-semibold text-slate-200">
                Trackpad Active • Slide to move cursor
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Tap = Left Click • Double-tap = Double Click • Two fingers = Right Click & Scroll
              </p>
              {isDragLock && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/40">
                  Drag Lock Active (Left Button Down)
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-1.5 pointer-events-none">
              <Mouse className="w-7 h-7 text-slate-600 mb-1" />
              <p className="text-xs font-medium text-slate-400">
                Trackpad Disabled
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs">
                Enable Remote Input to control Windows mouse pointer.
              </p>
            </div>
          )}
        </div>

        {/* Physical-style Mouse Buttons & Drag Lock */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            disabled={!isInputEnabled || !isConnected}
            onClick={() => onMouseClick('left', 'click')}
            className="py-3 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 active:bg-blue-900/50 text-xs font-semibold text-slate-200 transition-all cursor-pointer disabled:opacity-40"
          >
            Left Click
          </button>
          <button
            type="button"
            disabled={!isInputEnabled || !isConnected}
            onClick={toggleDragLock}
            className={`py-3 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 ${
              isDragLock
                ? 'bg-amber-950/80 border-amber-500/80 text-amber-200'
                : 'bg-slate-950 border-slate-800 hover:bg-slate-850 text-slate-300'
            }`}
          >
            {isDragLock ? 'Release Drag' : 'Drag Lock'}
          </button>
          <button
            type="button"
            disabled={!isInputEnabled || !isConnected}
            onClick={() => onMouseClick('right', 'click')}
            className="py-3 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 active:bg-blue-900/50 text-xs font-semibold text-slate-200 transition-all cursor-pointer disabled:opacity-40"
          >
            Right Click
          </button>
        </div>

        {/* Vertical Scroll Wheel Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={!isInputEnabled || !isConnected}
            onClick={() => onMouseScroll(120)}
            className="py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:bg-slate-800 text-xs text-slate-300 transition-colors disabled:opacity-40 cursor-pointer"
          >
            ▲ Scroll Up
          </button>
          <button
            type="button"
            disabled={!isInputEnabled || !isConnected}
            onClick={() => onMouseScroll(-120)}
            className="py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:bg-slate-800 text-xs text-slate-300 transition-colors disabled:opacity-40 cursor-pointer"
          >
            ▼ Scroll Down
          </button>
        </div>
      </div>

      {/* Windows Quick Hotkeys Bar */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-medium text-slate-300 flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-indigo-400" />
            Quick Windows Hotkeys
          </span>
          <span className="text-[11px] font-mono text-slate-500">Live Shortcuts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {hotkeys.map((hk) => (
            <button
              key={hk.label}
              type="button"
              disabled={!isInputEnabled && hk.label !== 'Ctrl+Alt+Del'}
              onClick={hk.action}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-left transition-all group flex flex-col justify-between cursor-pointer disabled:opacity-40"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-xs font-semibold text-slate-200 group-hover:text-blue-400">
                  {hk.label}
                </span>
                <span className="text-[9px] text-emerald-400 font-mono">Stage 5</span>
              </div>
              <span className="text-[10px] text-slate-400 truncate mt-1">
                {hk.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Remote Text Dispatch */}
      <form onSubmit={handleTextSubmit} className="pt-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={typedText}
            disabled={!isInputEnabled || !isConnected}
            onChange={(e) => setTypedText(e.target.value)}
            placeholder={
              isInputEnabled
                ? 'Type text here to type directly into Windows active window...'
                : 'Enable remote input to type text...'
            }
            className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isInputEnabled || !isConnected || !typedText.trim()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/30 shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Text</span>
          </button>
        </div>
      </form>
    </div>
  );
};
