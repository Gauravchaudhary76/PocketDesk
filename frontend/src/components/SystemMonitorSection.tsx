import React from 'react';
import {
  Activity,
  Cpu,
  Wifi,
  Gauge,
  BatteryCharging,
  Battery,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { StageBadge } from './StageBadge';
import type { SystemInfoResponse } from '../types';

interface SystemMonitorSectionProps {
  systemInfo: SystemInfoResponse | null;
  isConnected: boolean;
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
  onRefresh?: () => void;
}

export const SystemMonitorSection: React.FC<SystemMonitorSectionProps> = ({
  systemInfo,
  isConnected,
  onOpenInfo,
  onRefresh,
}) => {
  const handleMetricClick = (metricName: string, details: string[]) => {
    onOpenInfo(
      3,
      `Hardware Telemetry: ${metricName}`,
      `Real hardware telemetry stream transmitted over authenticated local Wi-Fi from the Windows laptop-agent.`,
      details
    );
  };

  // Extract real numbers if connected
  const cpuPercent = systemInfo?.cpu?.usage_percent ?? 0;
  const cpuModel = systemInfo?.cpu?.model || 'Intel / AMD Processor';
  const cpuCores = systemInfo?.cpu?.cores_logical || 1;
  const cpuFreq = systemInfo?.cpu?.frequency_mhz;

  const ramPercent = systemInfo?.memory?.usage_percent ?? 0;
  const ramUsedGb = systemInfo?.memory
    ? (systemInfo.memory.used_bytes / (1024 * 1024 * 1024)).toFixed(1)
    : '0.0';
  const ramTotalGb = systemInfo?.memory
    ? (systemInfo.memory.total_bytes / (1024 * 1024 * 1024)).toFixed(0)
    : '0';

  const battery = systemInfo?.battery;
  const hasBattery = battery?.present ?? false;
  const batteryPercent = battery?.percent ?? null;
  const isCharging = Boolean(battery?.is_charging || battery?.power_plugged);

  const formatBatteryRuntime = (seconds: number | null): string => {
    if (!seconds || seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-950/70 border border-emerald-800/60 text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">System Monitor</h3>
              {isConnected && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Telemetry
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {isConnected
                ? 'Authenticated hardware resource feed from Windows laptop'
                : 'Connect to laptop agent to stream real-time hardware telemetry'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors"
              title="Refresh Telemetry"
              aria-label="Refresh telemetry"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <StageBadge stage={3} label="Stage 3 Active" variant="filled" />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CPU Usage Card */}
        <div
          onClick={() =>
            handleMetricClick('CPU Utilization', [
              `Hardware Model: ${cpuModel}`,
              `Logical Cores: ${cpuCores}`,
              `Current Utilization: ${cpuPercent.toFixed(1)}%`,
              cpuFreq ? `Frequency: ${cpuFreq} MHz` : 'Frequency: Dynamic scaling',
              'Queried via Python psutil over authenticated local Wi-Fi API'
            ])
          }
          className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 cursor-pointer hover:border-slate-700 transition-colors"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-400" />
              CPU Load
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {isConnected ? `${cpuPercent.toFixed(1)}%` : '-- %'}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: isConnected ? `${Math.min(100, Math.max(0, cpuPercent))}%` : '0%' }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="truncate max-w-[130px]">{cpuModel}</span>
            <span className="text-emerald-400">{cpuCores} Threads</span>
          </div>
        </div>

        {/* RAM Usage Card */}
        <div
          onClick={() =>
            handleMetricClick('Memory Utilization', [
              `Total Physical Memory: ${ramTotalGb} GB`,
              `Utilized RAM: ${ramUsedGb} GB (${ramPercent.toFixed(1)}%)`,
              'Queried via Python psutil.virtual_memory()',
              'Streamed to mobile client over authenticated session'
            ])
          }
          className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 cursor-pointer hover:border-slate-700 transition-colors"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Memory (RAM)
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {isConnected ? `${ramPercent.toFixed(1)}%` : '-- %'}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all duration-500"
              style={{ width: isConnected ? `${Math.min(100, Math.max(0, ramPercent))}%` : '0%' }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{isConnected ? `${ramUsedGb} GB Used` : '-- GB'}</span>
            <span>{isConnected ? `${ramTotalGb} GB Total` : '-- GB Total'}</span>
          </div>
        </div>

        {/* Battery & Power State Card */}
        <div
          onClick={() =>
            handleMetricClick('Battery & Power State', [
              hasBattery ? `Charge Level: ${batteryPercent}%` : 'Power: AC Wall Adapter (Desktop/No battery)',
              isCharging ? 'Power status: Connected to AC Power / Charging' : 'Power status: Running on Battery',
              battery?.seconds_left ? `Estimated Runtime: ${formatBatteryRuntime(battery.seconds_left)}` : 'Runtime: Calculating',
              'Queried via Windows Battery API / psutil.sensors_battery()'
            ])
          }
          className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 cursor-pointer hover:border-slate-700 transition-colors"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              {isCharging ? (
                <BatteryCharging className="w-4 h-4 text-emerald-400" />
              ) : (
                <Battery className="w-4 h-4 text-amber-400" />
              )}
              Power & Battery
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {isConnected
                ? hasBattery
                  ? `${batteryPercent}%`
                  : 'AC Connected'
                : '--'}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCharging ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{
                width: isConnected
                  ? hasBattery
                    ? `${Math.min(100, Math.max(0, batteryPercent ?? 100))}%`
                    : '100%'
                  : '0%',
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{isConnected ? (isCharging ? 'AC Power' : 'On Battery') : 'Standby'}</span>
            <span className="text-emerald-400">
              {isConnected
                ? hasBattery && battery?.seconds_left
                  ? formatBatteryRuntime(battery.seconds_left)
                  : hasBattery
                  ? 'Charging'
                  : 'Desktop'
                : '--'}
            </span>
          </div>
        </div>

        {/* Host OS & Network Telemetry Card */}
        <div
          onClick={() =>
            handleMetricClick('Host System Metadata', [
              `Hostname: ${systemInfo?.os?.hostname || 'Unknown'}`,
              `Operating System: ${systemInfo?.os?.system || 'Windows'} ${systemInfo?.os?.release || ''}`,
              `OS Build: ${systemInfo?.os?.version || ''}`,
              `Architecture: ${systemInfo?.os?.architecture || ''}`,
              'Authentication: Bearer Token via /api/pair PIN authorization'
            ])
          }
          className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 cursor-pointer hover:border-slate-700 transition-colors"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-indigo-400" />
              Host Identity
            </span>
            <span className="text-xs font-mono font-semibold text-slate-200 truncate max-w-[100px]">
              {isConnected ? systemInfo?.os?.hostname : 'Disconnected'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono pt-1">
            <span className="text-slate-300 truncate">
              {isConnected ? `${systemInfo?.os?.system} ${systemInfo?.os?.release}` : 'Waiting for connection...'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{isConnected ? systemInfo?.os?.architecture : 'LAN / Wi-Fi'}</span>
            <span className="text-emerald-400">{isConnected ? 'Authenticated' : 'Pair Required'}</span>
          </div>
        </div>
      </div>

      {/* Security & Transport Notice Banner */}
      <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between flex-wrap gap-2">
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>
            {isConnected
              ? `Connected to agent at ${systemInfo ? 'local endpoint' : ''}. Real-time telemetry refreshed every 2.5s.`
              : 'Pairing authorization via 6-digit PIN on Windows laptop required to access telemetry.'}
          </span>
        </span>
        <span className="text-slate-500 font-mono text-[10px]">Stage 3 Local Prototype</span>
      </div>
    </div>
  );
};
