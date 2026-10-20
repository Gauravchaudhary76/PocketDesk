import React from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Thermometer,
  Gauge,
  TrendingUp
} from 'lucide-react';
import { StageBadge } from './StageBadge';
import type { SystemMetrics } from '../types';

interface SystemMonitorSectionProps {
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
}

export const SystemMonitorSection: React.FC<SystemMonitorSectionProps> = ({
  onOpenInfo,
}) => {
  const handleMetricClick = (metricName: string, details: string[]) => {
    onOpenInfo(
      3,
      `Hardware Telemetry: ${metricName}`,
      `Hardware telemetry monitoring is scheduled for Stage 3 alongside the Windows laptop-agent deployment.`,
      details
    );
  };

  // Planned sample metrics for dashboard visualization
  const metrics: SystemMetrics = {
    cpuUsagePercent: 18,
    ramUsagePercent: 42,
    ramUsedGb: 13.4,
    diskUsagePercent: 58,
    diskFreeGb: 412,
    networkUpKbps: 120,
    networkDownKbps: 840,
    temperatureC: 48,
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
            <h3 className="text-sm font-semibold text-white">System Monitor</h3>
            <p className="text-xs text-slate-400">
              Live hardware telemetry and resource utilization stats
            </p>
          </div>
        </div>
        <StageBadge stage={3} label="Stage 3 Feature" variant="filled" />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CPU Usage Card */}
        <div
          onClick={() =>
            handleMetricClick('CPU Utilization', [
              'Data source: Python psutil.cpu_percent(interval=1, percpu=True)',
              'Includes per-core utilization and frequency scaling',
              'Streamed over WebSocket telemetry channel every 1000ms',
              'Planned for Stage 3'
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
              {metrics.cpuUsagePercent}%
            </span>
          </div>

          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${metrics.cpuUsagePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Intel Core i7 / AMD Ryzen</span>
            <span className="text-emerald-400">Normal</span>
          </div>
        </div>

        {/* RAM Usage Card */}
        <div
          onClick={() =>
            handleMetricClick('Memory Utilization', [
              'Data source: Python psutil.virtual_memory()',
              'Reports active, cached, and committed memory pages',
              'Alerts if available RAM drops below 1GB threshold',
              'Planned for Stage 3'
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
              {metrics.ramUsagePercent}%
            </span>
          </div>

          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full"
              style={{ width: `${metrics.ramUsagePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{metrics.ramUsedGb} GB Used</span>
            <span>32 GB Total</span>
          </div>
        </div>

        {/* Disk Storage Card */}
        <div
          onClick={() =>
            handleMetricClick('NVMe Storage Health', [
              'Data source: Python psutil.disk_usage("C:\\")',
              'Monitors primary OS drive and secondary external drives',
              'Planned for Stage 3'
            ])
          }
          className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 cursor-pointer hover:border-slate-700 transition-colors"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              System Drive (C:)
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {metrics.diskUsagePercent}%
            </span>
          </div>

          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${metrics.diskUsagePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{metrics.diskFreeGb} GB Free</span>
            <span>1 TB NVMe</span>
          </div>
        </div>

        {/* Network & Thermal Card */}
        <div
          onClick={() =>
            handleMetricClick('Network & Temperature Telemetry', [
              'Data source: psutil.net_io_counters() and hardware sensors',
              'Live throughput graphs with upload/download velocity',
              'Planned for Stage 3'
            ])
          }
          className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 cursor-pointer hover:border-slate-700 transition-colors"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-emerald-400" />
              Network I/O
            </span>
            <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
              {metrics.temperatureC}°C
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono pt-1">
            <span className="text-slate-400">↓ {metrics.networkDownKbps} KB/s</span>
            <span className="text-slate-400">↑ {metrics.networkUpKbps} KB/s</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Wi-Fi 6 (802.11ax)</span>
            <span className="text-emerald-400">Low Latency</span>
          </div>
        </div>
      </div>

      {/* Telemetry Agent Notice */}
      <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between flex-wrap gap-2">
        <span className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Telemetry agent will run as a lightweight background thread using Python <code className="text-slate-300 bg-slate-900 px-1 py-0.5 rounded">psutil</code>.</span>
        </span>
        <span className="text-slate-400 font-mono text-[10px]">1000ms Refresh Rate</span>
      </div>
    </div>
  );
};
