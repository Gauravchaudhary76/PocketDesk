import React, { useState, useEffect } from 'react';
import {
  X,
  Laptop,
  KeyRound,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Globe,
  Smartphone,
  ShieldCheck
} from 'lucide-react';
import type { ConnectionMode } from '../types';
import { remoteClient } from '../services/remote';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress: string;
  currentMode: ConnectionMode;
  onConnectLocal: (address: string, pairingPin: string) => Promise<{ success: boolean; error?: string }>;
  onConnectRemote: (
    address: string,
    deviceName: string,
    pairingPin: string | null
  ) => Promise<{ success: boolean; error?: string }>;
  isConnecting: boolean;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  currentAddress,
  currentMode,
  onConnectLocal,
  onConnectRemote,
  isConnecting,
}) => {
  const [mode, setMode] = useState<ConnectionMode>(currentMode);
  const [address, setAddress] = useState<string>(currentAddress);
  const [pin, setPin] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>(() => remoteClient.getDeviceName());
  const [isRePairing, setIsRePairing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const deviceId = remoteClient.getDeviceId();
  const isAlreadyPaired = remoteClient.isDevicePaired();

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setAddress(currentAddress);
      setMode(currentMode);
      setPin('');
      setDeviceName(remoteClient.getDeviceName());
      setIsRePairing(!remoteClient.isDevicePaired());
      setValidationError(null);
      setServerError(null);
    }
  }, [isOpen, currentAddress, currentMode]);

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
      return null;
    } catch {
      return 'Invalid URL format. Example: https://agent.yourdomain.com or http://192.168.1.145:8000';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    let normalized = address.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = mode === 'remote' ? `https://${normalized}` : `http://${normalized}`;
    }

    const addrErr = validateAddress(normalized);
    if (addrErr) {
      setValidationError(addrErr);
      return;
    }

    if (mode === 'local') {
      // Local Mode: Validate 6-digit PIN
      const cleanPin = pin.trim();
      if (!cleanPin || cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
        setValidationError('Please enter a valid 6-digit numeric pairing PIN.');
        return;
      }
      setValidationError(null);
      const res = await onConnectLocal(normalized, cleanPin);
      if (!res.success) {
        setServerError(res.error || 'Connection failed.');
      }
    } else {
      // Remote Mode: Device Pairing or Saved Credential Session
      const effectivePin = isAlreadyPaired && !isRePairing ? null : pin.trim();
      if (effectivePin !== null) {
        if (!effectivePin || effectivePin.length !== 6 || !/^\d{6}$/.test(effectivePin)) {
          setValidationError('Please enter the 6-digit pairing PIN shown on your laptop agent.');
          return;
        }
      }
      setValidationError(null);
      const res = await onConnectRemote(normalized, deviceName, effectivePin);
      if (!res.success) {
        setServerError(res.error || 'Remote connection failed.');
      }
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-modal-title"
      onClick={() => {
        if (!isConnecting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-200 overflow-hidden my-auto"
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
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                {mode === 'remote' ? (
                  <>
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    Stage 6: Secure Remote Internet Access
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    Stage 3: Local Network Device Pairing
                  </>
                )}
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

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-4 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('local');
              setValidationError(null);
              setServerError(null);
            }}
            disabled={isConnecting}
            className={`py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              mode === 'local'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-300" />
            <span>Local Wi-Fi Mode</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('remote');
              setValidationError(null);
              setServerError(null);
            }}
            disabled={isConnecting}
            className={`py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              mode === 'remote'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-300" />
            <span>Remote Internet (Stage 6)</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Agent URL / Address */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="agent-address" className="font-medium text-slate-300">
                {mode === 'remote' ? '1. Remote Agent HTTPS / Reverse Proxy URL:' : '1. Laptop Agent Wi-Fi Address:'}
              </label>
              <div className="flex items-center gap-1.5">
                {isCurrentHostAvailable && (
                  <button
                    type="button"
                    onClick={() => handleSetPreset(`http://${currentHost}:8000`)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                  >
                    Host ({currentHost}:8000)
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
                placeholder={
                  mode === 'remote'
                    ? 'https://pocketdesk.yourdomain.com or https://tunnel.domain'
                    : 'http://192.168.1.145:8000'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono text-xs transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {mode === 'remote'
                ? 'Address of your reverse proxy, Cloudflare tunnel, Tailscale node, or VPN gateway.'
                : "Enter your Windows laptop's Wi-Fi IP address and port 8000 (shown in the laptop terminal)."}
            </p>
          </div>

          {/* Remote Mode: Device Identification */}
          {mode === 'remote' && (
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                  Client Device Identity
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {deviceId.substring(0, 14)}...
                </span>
              </div>

              <div>
                <label htmlFor="device-name-input" className="block text-[11px] text-slate-400 mb-1">
                  Device Friendly Name:
                </label>
                <input
                  id="device-name-input"
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  disabled={isConnecting}
                  maxLength={40}
                  placeholder="e.g. Gaurav's Phone"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {isAlreadyPaired && !isRePairing ? (
                <div className="flex items-center justify-between p-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-emerald-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-semibold block text-[11px]">Paired Device Secret Stored</span>
                      <span className="text-[10px] text-emerald-400/80">
                        Cryptographic secret saved. Re-authentication does not require a PIN.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRePairing(true)}
                    className="text-[10px] text-slate-400 hover:text-white underline whitespace-nowrap ml-2"
                  >
                    Re-pair PIN
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Step 2: 6-Digit Pairing Code (Always for local; conditional for remote) */}
          {(mode === 'local' || !isAlreadyPaired || isRePairing) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="pairing-pin" className="font-medium text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  2. Authorization Pairing PIN:
                </label>
                {mode === 'remote' && isAlreadyPaired && (
                  <button
                    type="button"
                    onClick={() => setIsRePairing(false)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                  >
                    Use Saved Secret
                  </button>
                )}
              </div>
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
                Displayed in the laptop agent terminal upon startup (valid for 5 minutes).
              </p>
            </div>
          )}

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

          {/* Security & Architecture Callout */}
          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
              <span>
                {mode === 'remote'
                  ? 'Stage 6 Remote Access Security Model:'
                  : 'Local Wi-Fi Security & Pairing Requirements:'}
              </span>
            </div>
            {mode === 'remote' ? (
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>End-to-end DTLS-SRTP WebRTC encrypted video and data transport.</li>
                <li>Dynamic STUN/TURN NAT traversal with ephemeral RFC 5766 credentials.</li>
                <li>Cryptographic replay protection via single-use nonces and 60-second validity windows.</li>
                <li>Brute-force protection: 5 failed attempts locks out the client IP for 5 minutes.</li>
              </ul>
            ) : (
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Both phone and laptop must be connected to the same local Wi-Fi.</li>
                <li>Agent must be started on the laptop using <code className="text-slate-300">python run.py --lan</code>.</li>
                <li>Windows Firewall must allow incoming TCP traffic on port 8000 for private networks.</li>
                <li>Pairing tokens are kept in memory and never transmitted in URL parameters.</li>
              </ul>
            )}
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
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {mode === 'remote'
                      ? isAlreadyPaired && !isRePairing
                        ? 'Connect Paired Device'
                        : 'Register & Pair (Remote)'
                      : 'Authorize & Connect (Local)'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
