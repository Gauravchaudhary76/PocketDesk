import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  ShieldCheck,
  Trash2,
  X,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { PairedDeviceItem } from '../types';
import { remoteClient } from '../services/remote';

interface DeviceManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentUrl: string;
  token: string | null;
  onDeviceRevoked?: () => void;
}

export const DeviceManagementModal: React.FC<DeviceManagementModalProps> = ({
  isOpen,
  onClose,
  agentUrl,
  token,
  onDeviceRevoked,
}) => {
  const [devices, setDevices] = useState<PairedDeviceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const currentDeviceId = remoteClient.getDeviceId();

  const fetchDevices = async () => {
    if (!token || !agentUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await remoteClient.listDevices(agentUrl, token);
      setDevices(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load devices';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
    }
  }, [isOpen, agentUrl, token]);

  const handleRevoke = async (deviceId: string) => {
    if (!token || !agentUrl) return;
    const confirm = window.confirm(
      `Revoke access for device '${deviceId}'? This device will be permanently banned from connecting until re-paired on the laptop.`
    );
    if (!confirm) return;

    setRevokingId(deviceId);
    try {
      await remoteClient.revokeDevice(agentUrl, token, deviceId);
      await fetchDevices();
      if (onDeviceRevoked && deviceId === currentDeviceId) {
        onDeviceRevoked();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Revocation failed';
      alert(msg);
    } finally {
      setRevokingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-950/70 border border-blue-800/60 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Authorized Paired Devices
              </h3>
              <p className="text-xs text-slate-400">
                Manage trusted devices authorized to access your Windows laptop
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchDevices}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
              title="Refresh Device List"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Current device notice */}
        <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span>Current Browser Device ID:</span>
            <code className="ml-1 text-emerald-400 font-mono text-[11px] block sm:inline">{currentDeviceId}</code>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Devices List */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {devices.length === 0 && !isLoading && (
            <div className="text-center py-6 text-xs text-slate-500">
              No authorized devices registered yet.
            </div>
          )}

          {devices.map((device) => {
            const isCurrent = device.device_id === currentDeviceId;
            return (
              <div
                key={device.device_id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                  device.revoked
                    ? 'bg-slate-950/40 border-slate-900 opacity-50'
                    : isCurrent
                    ? 'bg-blue-950/30 border-blue-800/60'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      device.revoked
                        ? 'bg-slate-900 text-slate-600'
                        : isCurrent
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate">
                        {device.device_name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 shrink-0">
                          This Device
                        </span>
                      )}
                      {device.revoked && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                          Revoked
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                      ID: {device.device_id.slice(0, 16)}... • Paired: {new Date(device.paired_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {!device.revoked && (
                  <button
                    type="button"
                    disabled={revokingId === device.device_id}
                    onClick={() => handleRevoke(device.device_id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/40 transition-colors shrink-0 cursor-pointer disabled:opacity-40"
                    title="Revoke Device Access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Revoking a device invalidates all associated sessions.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
