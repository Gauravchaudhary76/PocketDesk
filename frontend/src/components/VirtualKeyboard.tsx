import React, { useState } from 'react';
import {
  Keyboard,
  X,
  Send,
  CornerDownLeft,
  Delete,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface VirtualKeyboardProps {
  isOpen: boolean;
  onClose: () => void;
  onSendKey: (key: string, action?: 'press' | 'down' | 'up') => void;
  onSendText: (text: string) => void;
  onSendShortcut: (keys: string[]) => void;
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  isOpen,
  onClose,
  onSendKey,
  onSendText,
  onSendShortcut,
  onOpenInfo,
}) => {
  const [typedText, setTypedText] = useState<string>('');
  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);
  const [isCtrlActive, setIsCtrlActive] = useState<boolean>(false);
  const [isAltActive, setIsAltActive] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedText.trim()) {
      onSendText(typedText);
      setTypedText('');
    }
  };

  const handleKeyPress = (key: string) => {
    // If modifiers are toggled, execute combined shortcut
    const activeModifiers: string[] = [];
    if (isCtrlActive) activeModifiers.push('ctrl');
    if (isAltActive) activeModifiers.push('alt');
    if (isShiftActive) activeModifiers.push('shift');

    if (activeModifiers.length > 0) {
      onSendShortcut([...activeModifiers, key]);
      // Reset modifiers after shortcut
      setIsCtrlActive(false);
      setIsAltActive(false);
      setIsShiftActive(false);
    } else {
      onSendKey(key, 'press');
    }
  };

  const handleCtrlAltDelClick = () => {
    onOpenInfo(
      5,
      'Windows Secure Desktop Limitation (Ctrl+Alt+Del & UAC)',
      'Windows 10 and 11 deliberately restrict synthetic input to the Secure Desktop (including Ctrl+Alt+Del, Windows Lock Screen, and UAC elevation prompts) due to User Interface Privilege Isolation (UIPI).',
      [
        'Standard non-elevated applications cannot inject keystrokes into the Windows Secure Desktop.',
        'To respond to Administrator UAC prompts remotely, the PocketDesk agent must be run with "Run as Administrator".',
        'Physical access or Windows Service elevation is required to unlock a locked Windows session.'
      ]
    );
  };

  const numberRow = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const row1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const row2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
  const row3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

  return (
    <div className="bg-slate-950/95 border-t border-slate-800 p-3 sm:p-4 text-slate-100 shadow-2xl backdrop-blur-md rounded-b-2xl animate-in slide-in-from-bottom-2 duration-150">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white">On-Screen Keyboard</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
            Direct Keystrokes
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Close Keyboard"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Native Text Input Bar */}
      <form onSubmit={handleTextSubmit} className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder="Type with your phone's native keyboard..."
          className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!typedText.trim()}
          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Text</span>
        </button>
      </form>

      {/* Quick Windows Shortcuts Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none text-[11px]">
        <button
          type="button"
          onClick={() => onSendShortcut(['ctrl', 'c'])}
          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono cursor-pointer shrink-0"
        >
          Ctrl+C (Copy)
        </button>
        <button
          type="button"
          onClick={() => onSendShortcut(['ctrl', 'v'])}
          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono cursor-pointer shrink-0"
        >
          Ctrl+V (Paste)
        </button>
        <button
          type="button"
          onClick={() => onSendShortcut(['ctrl', 'z'])}
          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono cursor-pointer shrink-0"
        >
          Ctrl+Z (Undo)
        </button>
        <button
          type="button"
          onClick={() => onSendShortcut(['alt', 'tab'])}
          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono cursor-pointer shrink-0"
        >
          Alt+Tab
        </button>
        <button
          type="button"
          onClick={() => onSendShortcut(['win', 'd'])}
          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono cursor-pointer shrink-0"
        >
          Win+D
        </button>
        <button
          type="button"
          onClick={() => onSendShortcut(['win', 'e'])}
          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono cursor-pointer shrink-0"
        >
          Win+E
        </button>
        <button
          type="button"
          onClick={handleCtrlAltDelClick}
          className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800/60 hover:bg-rose-900/60 text-rose-300 font-mono cursor-pointer flex items-center gap-1 shrink-0"
          title="Windows Security Screen Notice"
        >
          <ShieldAlert className="w-3 h-3 text-rose-400" />
          <span>Ctrl+Alt+Del</span>
        </button>
      </div>

      {/* Virtual Keypad Rows */}
      <div className="space-y-1.5 select-none font-mono text-xs">
        {/* Numbers Row */}
        <div className="flex gap-1 justify-center">
          <button
            type="button"
            onClick={() => onSendKey('escape')}
            className="flex-1 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 font-semibold text-[11px] cursor-pointer"
          >
            Esc
          </button>
          {numberRow.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleKeyPress(n)}
              className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold cursor-pointer"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSendKey('backspace')}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
            title="Backspace"
          >
            <Delete className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* QWERTY Row 1 */}
        <div className="flex gap-1 justify-center">
          <button
            type="button"
            onClick={() => onSendKey('tab')}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-[11px] cursor-pointer"
          >
            Tab
          </button>
          {row1.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeyPress(isShiftActive ? k.toUpperCase() : k)}
              className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold cursor-pointer"
            >
              {isShiftActive ? k.toUpperCase() : k}
            </button>
          ))}
        </div>

        {/* QWERTY Row 2 */}
        <div className="flex gap-1 justify-center">
          {row2.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeyPress(isShiftActive ? k.toUpperCase() : k)}
              className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold cursor-pointer"
            >
              {isShiftActive ? k.toUpperCase() : k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSendKey('enter')}
            className="flex-[1.4] py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-1 cursor-pointer"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
            <span className="text-[11px]">Enter</span>
          </button>
        </div>

        {/* QWERTY Row 3 + Modifiers */}
        <div className="flex gap-1 justify-center">
          <button
            type="button"
            onClick={() => setIsShiftActive((prev) => !prev)}
            className={`flex-1 py-2 rounded-lg border font-semibold text-[11px] cursor-pointer transition-colors ${
              isShiftActive
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            Shift
          </button>
          {row3.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeyPress(isShiftActive ? k.toUpperCase() : k)}
              className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold cursor-pointer"
            >
              {isShiftActive ? k.toUpperCase() : k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSendKey('delete')}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-[11px] cursor-pointer"
          >
            Del
          </button>
        </div>

        {/* Bottom Navigation & Modifiers Row */}
        <div className="flex gap-1 justify-between items-center pt-1">
          <div className="flex gap-1 flex-1">
            <button
              type="button"
              onClick={() => setIsCtrlActive((prev) => !prev)}
              className={`px-3 py-2 rounded-lg border font-semibold text-[11px] cursor-pointer transition-colors ${
                isCtrlActive
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              Ctrl
            </button>
            <button
              type="button"
              onClick={() => onSendKey('win')}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-[11px] cursor-pointer"
              title="Windows Key"
            >
              Win
            </button>
            <button
              type="button"
              onClick={() => setIsAltActive((prev) => !prev)}
              className={`px-3 py-2 rounded-lg border font-semibold text-[11px] cursor-pointer transition-colors ${
                isAltActive
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              Alt
            </button>
            <button
              type="button"
              onClick={() => onSendKey('space')}
              className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-medium text-[11px] cursor-pointer"
            >
              Space
            </button>
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-1 pl-2">
            <button
              type="button"
              onClick={() => onSendKey('left')}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
              title="Arrow Left"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => onSendKey('up')}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                title="Arrow Up"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onSendKey('down')}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                title="Arrow Down"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => onSendKey('right')}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
              title="Arrow Right"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
