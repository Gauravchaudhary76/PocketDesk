import React, { useState, useEffect } from 'react';
import {
  X,
  Laptop,
  KeyRound,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Wifi
} from 'lucide-react';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress: string;
  onConnect: (address: string, pairingPin: string) => Promise<{ success: boolean; error?: string }>;
  isConnecting: boolean;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  currentAddress,
  onConnect,
  isConnecting,
}) => {
  const [address, setAddress] = useState<string>(currentAddress);
  const [pin, setPin] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Sync address when opened or changed
  useEffect(() => {
    if (isOpen) {
      setAddress(currentAddress);
      setPin('');
      setValidationError(null);
      setServerError(null);
    }
  }, [isOpen, currentAddress]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConnecting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, isConnecting, onClose]);

  if (!isOpen) return null;

  const validateAddress = (urlStr: string): string | null => {
    const trimmed = urlStr.trim();
    if (!trimmed) {
      return 'Agent address cannot be empty.';
    }

    let urlToTest = trimmed;
    if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
      urlToTest = `http://${urlToTest}`;
    }

    try {
      const parsed = new URL(urlToTest);
      if (!parsed.hostname) {
        return 'Invalid hostname or IP address.';
      }
      if (!parsed.port) {
        return 'Please specify the agent port (e.g. :8000).';
      }
      return null;
    } catch {
      return 'Invalid URL format. Example: http://192.168.1.145:8000';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Normalize and validate URL
    let normalized = address.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `http://${normalized}`;
    }

    const addrErr = validateAddress(normalized);
    if (addrErr) {
      setValidationError(addrErr);
      return;
    }

    // Validate PIN
    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      setValidationError('Please enter a valid 6-digit numeric pairing PIN.');
      return;
    }

    setValidationError(null);
    const result = await onConnect(normalized, cleanPin);
    if (!result.success) {
      setServerError(result.error || 'Connection failed.');
    }
  };

  const handleSetPreset = (presetUrl: string) => {
    setAddress(presetUrl);
    setValidationError(null);
  };

  const currentHost = window.location.hostname;
  const isCurrentHostAvailable = currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-modal-title"
      onClick={() => {
        if (!isConnecting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500" />

        {/* Modal Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-950/80 border border-blue-800/60 rounded-xl text-blue-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1">
                <Wifi className="w-3 h-3 text-emerald-400" />
                Stage 3: Local Network Device Pairing
              </span>
              <h2 id="connect-modal-title" className="text-lg font-bold text-white">
                Connect to Windows Laptop
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isConnecting}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Step 1: Agent Address */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="agent-address" className="font-medium text-slate-300">
                1. Laptop Agent Address:
              </label>
              <div className="flex items-center gap-1.5">
                {isCurrentHostAvailable && (
                  <button
                    type="button"
                    onClick={() => handleSetPreset(`http://${currentHost}:8000`)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                  >
                    Use Phone Host ({currentHost}:8000)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSetPreset('http://127.0.0.1:8000')}
                  className="text-[10px] text-slate-400 hover:text-slate-300 underline"
                >
                  Localhost
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                id="agent-address"
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setValidationError(null);
                }}
                disabled={isConnecting}
                placeholder="http://192.168.1.145:8000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-xs transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Enter your Windows laptop's Wi-Fi IP address and port 8000 (shown in the laptop terminal).
            </p>
          </div>

          {/* Step 2: 6-Digit Pairing Code */}
          <div className="space-y-1.5">
            <label htmlFor="pairing-pin" className="font-medium text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              2. Authorization Pairing PIN:
            </label>
            <div className="relative">
              <input
                id="pairing-pin"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setValidationError(null);
                }}
                disabled={isConnecting}
                placeholder="Enter 6-digit PIN"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-center tracking-widest text-base font-bold transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Found on your laptop screen when starting: <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300">python run.py --lan</code>
            </p>
          </div>

          {/* Error Message Box */}
          {(validationError || serverError) && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Connection Problem</span>
                <p className="text-[11px] leading-relaxed">
                  {validationError || serverError}
                </p>
              </div>
            </div>
          )}

          {/* Security & Firewall Callout */}
          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
              <span>Local Wi-Fi Security & Pairing Requirements:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Both phone and laptop must be connected to the same local Wi-Fi.</li>
              <li>Agent must be started on the laptop using <code className="text-slate-300">python run.py --lan</code>.</li>
              <li>Windows Firewall must allow incoming TCP traffic on port 8000 for private networks.</li>
              <li>Pairing tokens are kept in memory and never transmitted in URL parameters.</li>
            </ul>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isConnecting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConnecting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authorize & Connect</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
