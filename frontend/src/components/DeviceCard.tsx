import React from 'react';
import { Laptop, Cpu, HardDrive, Wifi, BatteryCharging, Battery, Power, ShieldCheck, Settings2 } from 'lucide-react';
import type { DeviceInfo, ConnectionStatus } from '../types';
import { StatusBadge } from './StatusBadge';

interface DeviceCardProps {
  device: DeviceInfo;
  status: ConnectionStatus;
  onAttemptConnect: () => void;
  onConfigureAddress: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  status,
  onAttemptConnect,
  onConfigureAddress,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
      {/* Decorative gradient corner */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header inside Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center text-blue-400 shrink-0">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-white tracking-tight">
                {device.name}
              </h2>
              {status === 'connected' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Paired & Authorized
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Unpaired
                </span>
              )}
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-slate-400">
              {device.os} • Hostname: <span className="font-mono text-slate-300">{device.hostname}</span>
            </p>
          </div>
        </div>

        {/* Connect / Disconnect Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onConfigureAddress}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Configure Agent Wi-Fi Address"
            aria-label="Configure Agent Wi-Fi Address"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {status === 'connected' ? (
            <button
              type="button"
              onClick={onAttemptConnect}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md bg-slate-900 hover:bg-rose-950/40 text-rose-300 border border-rose-800/40 cursor-pointer active:scale-98"
              aria-label="Disconnect from Windows Laptop Agent"
            >
              <Power className="w-4 h-4 text-rose-400" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onAttemptConnect}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 cursor-pointer active:scale-98 group"
              aria-label="Connect & Pair with Laptop Agent"
            >
              <Power className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
              <span>Connect to Laptop</span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-blue-700 text-blue-200">
                Wi-Fi
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Device Specifications Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 text-xs">
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Wifi className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="overflow-hidden">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Agent Address</div>
              <div className="font-mono text-slate-200 truncate">{device.ipAddress}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onConfigureAddress}
            className="text-[10px] text-blue-400 hover:text-blue-300 underline shrink-0"
          >
            Change
          </button>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 flex items-center gap-2.5">
          {device.isCharging ? (
            <BatteryCharging className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Battery className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Power & Battery</div>
            <div className="font-medium text-slate-200">
              {device.batteryLevel !== null ? `${device.batteryLevel}%` : 'AC Power'}{' '}
              {device.isCharging ? '(Charging)' : '(On Battery)'}
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="overflow-hidden">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Processor</div>
            <div className="font-medium text-slate-200 truncate">{device.cpuModel}</div>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 flex items-center gap-2.5">
          <HardDrive className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">System Memory</div>
            <div className="font-medium text-slate-200">{device.ramTotalGb} GB RAM</div>
          </div>
        </div>
      </div>

      {/* Security & Rule #10 Notice Banner */}
      <div className="mt-4 flex items-center justify-between flex-wrap gap-2 px-3 py-2 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Stage 3: Authenticated Wi-Fi pairing via terminal PIN. Desktop capture & remote input remain safely isolated.</span>
        </div>
        <span className="text-slate-500 font-mono text-[10px]">Local Wi-Fi Only</span>
      </div>
    </div>
  );
};
