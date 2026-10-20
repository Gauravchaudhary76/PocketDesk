import React from 'react';
import {
  Mouse,
  Keyboard,
  Send,
  Touchpad
} from 'lucide-react';
import { StageBadge } from './StageBadge';

interface MouseKeyboardSectionProps {
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
}

export const MouseKeyboardSection: React.FC<MouseKeyboardSectionProps> = ({
  onOpenInfo,
}) => {
  const handleInputClick = (featureName: string, details: string[]) => {
    onOpenInfo(
      4,
      `${featureName} (Input Dispatcher)`,
      `This control will send real-time input events to your Windows laptop in Stage 4. During Stage 1, all input injection is safely disabled.`,
      details
    );
  };

  const hotkeys = [
    { label: 'Ctrl+Alt+Del', desc: 'Windows Security Screen' },
    { label: 'Alt+Tab', desc: 'Switch Active Window' },
    { label: 'Win + D', desc: 'Toggle Show Desktop' },
    { label: 'Win + E', desc: 'Open File Explorer' },
    { label: 'Win + L', desc: 'Lock Windows Session' },
    { label: 'Esc', desc: 'Escape Key' },
    { label: 'Enter', desc: 'Submit / Return' },
    { label: 'Win + R', desc: 'Run Command Prompt' },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-950/70 border border-blue-800/60 text-blue-400">
            <Mouse className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Mouse & Keyboard Controls
            </h3>
            <p className="text-xs text-slate-400">
              Low-latency virtual trackpad and remote Windows keyboard injection
            </p>
          </div>
        </div>
        <StageBadge stage={4} label="Stage 4 Feature" variant="filled" />
      </div>

      {/* Trackpad Simulation Area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-medium text-slate-300 flex items-center gap-1.5">
            <Touchpad className="w-4 h-4 text-cyan-400" />
            Virtual Trackpad Zone
          </span>
          <span className="text-[11px] font-mono text-slate-500">Touch & Gesture Ready</span>
        </div>

        <div
          onClick={() =>
            handleInputClick('Virtual Touchpad', [
              'One-finger drag moves the Windows cursor',
              'Single tap triggers Left Click',
              'Two-finger tap triggers Right Click',
              'Two-finger vertical swipe triggers smooth mouse wheel scrolling',
              'Events will be serialized to binary WebSocket packets with <15ms latency'
            ])
          }
          className="relative h-44 sm:h-52 w-full rounded-xl bg-slate-950 border-2 border-dashed border-slate-800 hover:border-slate-700 flex flex-col items-center justify-center p-4 cursor-pointer group transition-all"
          role="button"
          tabIndex={0}
          aria-label="Virtual Trackpad (Disabled in Stage 1)"
        >
          {/* Subtle cursor illustration */}
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 group-hover:text-blue-400 transition-colors mb-2">
            <Mouse className="w-6 h-6" />
          </div>
          <p className="text-xs font-medium text-slate-300">
            Virtual Trackpad (Planned for Stage 4)
          </p>
          <p className="text-[11px] text-slate-400 text-center max-w-xs mt-1">
            Tap here to inspect how multi-touch gestures and Windows mouse events will be dispatched.
          </p>

          <span className="absolute bottom-2 text-[10px] text-slate-400 font-mono">
            Direct input injection disabled in Stage 1
          </span>
        </div>

        {/* Mouse Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() =>
              handleInputClick('Left Mouse Click', [
                'Dispatches WM_LBUTTONDOWN and WM_LBUTTONUP via Windows SendInput API',
                'Supports click-and-drag selection'
              ])
            }
            className="py-3 px-4 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800/80 text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <span>Left Click</span>
            <span className="text-[10px] text-slate-500 font-mono">(Stage 4)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleInputClick('Right Mouse Click', [
                'Dispatches WM_RBUTTONDOWN and WM_RBUTTONUP for context menus',
                'Simulates secondary click on mobile devices'
              ])
            }
            className="py-3 px-4 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800/80 text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <span>Right Click</span>
            <span className="text-[10px] text-slate-500 font-mono">(Stage 4)</span>
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
          <span className="text-[11px] text-slate-500">System Key Combinations</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {hotkeys.map((hk) => (
            <button
              key={hk.label}
              type="button"
              onClick={() =>
                handleInputClick(`Hotkey: ${hk.label}`, [
                  `Action: ${hk.desc}`,
                  'Transmitted via low-latency WebSocket packet to laptop-agent',
                  'Executed using Windows Virtual-Key code mapping in Python pynput/SendInput'
                ])
              }
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-colors group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-xs font-semibold text-slate-200 group-hover:text-blue-400">
                  {hk.label}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">Stage 4</span>
              </div>
              <span className="text-[10px] text-slate-400 truncate mt-1">
                {hk.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Remote Text Dispatch */}
      <div className="pt-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            placeholder="Type text to send to Windows active window (Stage 4)..."
            className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 placeholder-slate-600 focus:outline-none cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() =>
              handleInputClick('Remote Text Typing', [
                'Buffers typed Unicode strings from mobile keyboard',
                'Simulates keystrokes or pastes directly to Windows clipboard',
                'Planned for Stage 4'
              ])
            }
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-blue-400" />
            <span>Send (Stage 4)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
