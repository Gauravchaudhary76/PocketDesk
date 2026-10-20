import React from 'react';
import {
  LayoutGrid,
  Terminal,
  FolderTree,
  Activity,
  Globe,
  Code2,
  Settings,
  XCircle
} from 'lucide-react';
import { StageBadge } from './StageBadge';
import type { RunningApplication } from '../types';

interface ApplicationsSectionProps {
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
}

export const ApplicationsSection: React.FC<ApplicationsSectionProps> = ({
  onOpenInfo,
}) => {
  const handleAppClick = (appName: string, details: string[]) => {
    onOpenInfo(
      4,
      `Application Manager: ${appName}`,
      `Starting or terminating processes on your Windows host laptop will be supported in Stage 4.`,
      details
    );
  };

  const quickLaunchApps = [
    { name: 'File Explorer', icon: FolderTree, cmd: 'explorer.exe' },
    { name: 'Terminal / PowerShell', icon: Terminal, cmd: 'wt.exe' },
    { name: 'Web Browser', icon: Globe, cmd: 'chrome.exe' },
    { name: 'VS Code', icon: Code2, cmd: 'code.exe' },
    { name: 'Task Manager', icon: Activity, cmd: 'taskmgr.exe' },
    { name: 'Windows Settings', icon: Settings, cmd: 'ms-settings:' },
  ];

  const runningApps: RunningApplication[] = [
    {
      pid: 14220,
      name: 'chrome.exe',
      windowTitle: 'PocketDesk Development Docs - Google Chrome',
      cpuPercent: 3.4,
      memoryMb: 840,
      iconName: 'browser',
    },
    {
      pid: 8940,
      name: 'Code.exe',
      windowTitle: 'pocketdesk - Visual Studio Code',
      cpuPercent: 1.8,
      memoryMb: 620,
      iconName: 'code',
    },
    {
      pid: 4312,
      name: 'WindowsTerminal.exe',
      windowTitle: 'PowerShell Administrator',
      cpuPercent: 0.2,
      memoryMb: 95,
      iconName: 'terminal',
    },
    {
      pid: 2198,
      name: 'explorer.exe',
      windowTitle: 'Windows Desktop & Shell',
      cpuPercent: 0.8,
      memoryMb: 310,
      iconName: 'folder',
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950/70 border border-cyan-800/60 text-cyan-400">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Applications & Tasks</h3>
            <p className="text-xs text-slate-400">
              Launch installed Windows programs and inspect running background tasks
            </p>
          </div>
        </div>
        <StageBadge stage={4} label="Stage 4 Feature" variant="filled" />
      </div>

      {/* Quick App Launcher */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-medium text-slate-300">Quick App Launcher</span>
          <span className="text-[11px] text-slate-500">Windows Executables</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {quickLaunchApps.map((app) => {
            const Icon = app.icon;
            return (
              <button
                key={app.name}
                type="button"
                onClick={() =>
                  handleAppClick(`Launch ${app.name}`, [
                    `Executable Target: ${app.cmd}`,
                    'Executed on host using Python subprocess with non-elevated user permissions',
                    'Brings launched window directly into foreground focus',
                    'Planned for Stage 4'
                  ])
                }
                className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-2.5 text-left transition-colors group"
              >
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-cyan-400 transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-medium text-slate-200 truncate group-hover:text-white">
                    {app.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    {app.cmd}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Running Tasks Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-medium text-slate-300">Running Processes (Preview)</span>
          <span className="text-[11px] text-slate-500 font-mono">Stage 4 Telemetry</span>
        </div>

        <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60 divide-y divide-slate-800/60 text-xs">
          {runningApps.map((task) => (
            <div
              key={task.pid}
              className="p-3 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
            >
              <div className="overflow-hidden min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-200 truncate">
                    {task.name}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                    PID {task.pid}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {task.windowTitle}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right font-mono text-[11px] hidden sm:block">
                  <div className="text-slate-300">{task.cpuPercent}% CPU</div>
                  <div className="text-slate-500">{task.memoryMb} MB</div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleAppClick(`Kill Process (PID ${task.pid})`, [
                      `Target: ${task.name} (PID: ${task.pid})`,
                      'Requires explicit user confirmation on phone',
                      'Sends SIGTERM / TerminateProcess to laptop agent',
                      'Planned for Stage 4'
                    ])
                  }
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/40 transition-colors"
                  title={`End Task ${task.name} (Stage 4)`}
                  aria-label={`End Task ${task.name}`}
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
