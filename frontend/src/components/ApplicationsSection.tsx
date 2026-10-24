import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutGrid,
  Terminal,
  FolderTree,
  Activity,
  Globe,
  Code2,
  FileText,
  Calculator,
  Palette,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import type { AllowlistedApp, LaunchAppResult } from '../types';
import { appService } from '../services/apps';
import { StageBadge } from './StageBadge';

interface ApplicationsSectionProps {
  agentUrl: string;
  token: string | null;
  isConnected: boolean;
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
}

export const ApplicationsSection: React.FC<ApplicationsSectionProps> = ({
  agentUrl,
  token,
  isConnected,
  onOpenInfo,
}) => {
  const [apps, setApps] = useState<AllowlistedApp[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [launchResult, setLaunchResult] = useState<LaunchAppResult | null>(null);

  // Disruptive confirmation state
  const [pendingApp, setPendingApp] = useState<AllowlistedApp | null>(null);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);

  const loadApps = useCallback(async () => {
    if (!isConnected || !token || !agentUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await appService.getAllowlist(agentUrl, token);
      setApps(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch application allowlist';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, token, agentUrl]);

  useEffect(() => {
    if (isConnected && token) {
      loadApps();
    } else {
      setApps([]);
      setLaunchResult(null);
      setPendingApp(null);
    }
  }, [isConnected, token, loadApps]);

  const handleLaunchClick = (app: AllowlistedApp) => {
    if (app.is_disruptive) {
      setPendingApp(app);
    } else {
      executeLaunch(app, false);
    }
  };

  const executeLaunch = async (app: AllowlistedApp, confirmed: boolean) => {
    if (!token || !agentUrl) return;
    setIsLaunching(true);
    setError(null);
    setLaunchResult(null);

    try {
      const result = await appService.launchApp(agentUrl, token, app.app_id, confirmed);
      setLaunchResult(result);
      setPendingApp(null);

      // Auto-clear success message after 5 seconds
      setTimeout(() => {
        setLaunchResult((prev) => (prev?.app_id === app.app_id ? null : prev));
      }, 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch application';
      setError(msg);
    } finally {
      setIsLaunching(false);
    }
  };

  const getAppIcon = (iconName: string) => {
    switch (iconName) {
      case 'file-text':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'calculator':
        return <Calculator className="w-5 h-5 text-amber-400" />;
      case 'palette':
        return <Palette className="w-5 h-5 text-pink-400" />;
      case 'folder':
        return <FolderTree className="w-5 h-5 text-emerald-400" />;
      case 'globe':
        return <Globe className="w-5 h-5 text-cyan-400" />;
      case 'code':
        return <Code2 className="w-5 h-5 text-indigo-400" />;
      case 'activity':
        return <Activity className="w-5 h-5 text-rose-400" />;
      case 'terminal':
      default:
        return <Terminal className="w-5 h-5 text-slate-300" />;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950/70 border border-cyan-800/60 text-cyan-400">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Application Launcher</h3>
            <p className="text-xs text-slate-400">
              Launch approved Windows tools and productivity programs on host
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StageBadge stage={7} label="App Launcher" variant="filled" />
          <button
            type="button"
            onClick={() =>
              onOpenInfo(
                7,
                'Stage 7 Application Allowlist & Security Model',
                'PocketDesk prevents arbitrary command execution by enforcing a strict server-side allowlist.',
                [
                  'Predefined Executables Only: Only apps defined in the host allowlist can be launched; no arbitrary commands, flags, or script strings are accepted from the browser.',
                  'No Shell Expansion: All programs are spawned using subprocess.Popen(..., shell=False).',
                  'Disruptive App Confirmation: Launching administrative or terminal tools requires explicit user confirmation.',
                  'Standard Process Isolation: Apps are spawned in the user desktop session without administrator elevation.',
                ]
              )
            }
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="View App Launcher Security Specs"
          >
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>

      {!isConnected ? (
        <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
          <LayoutGrid className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-xs font-medium text-slate-300">Agent Disconnected</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Pair with your Windows laptop to inspect allowlisted applications and trigger safe program launching.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Launch Status Feedback */}
          {launchResult && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {launchResult.message} {launchResult.pid && `(PID: ${launchResult.pid})`}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Applications Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isLoading && apps.length === 0 ? (
              <div className="col-span-full p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Loading allowlisted applications...</span>
              </div>
            ) : (
              apps.map((app) => (
                <div
                  key={app.app_id}
                  className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors flex items-start justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                      {getAppIcon(app.icon_name)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-slate-200">
                          {app.name}
                        </span>
                        {app.is_disruptive && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/40">
                            Disruptive
                          </span>
                        )}
                        {!app.is_installed && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-900 text-slate-500 border border-slate-800">
                            Not Installed
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {app.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLaunchClick(app)}
                    disabled={!app.is_installed || isLaunching}
                    className="shrink-0 p-2 rounded-lg bg-slate-900 hover:bg-cyan-600 text-slate-300 hover:text-white border border-slate-800 hover:border-cyan-500 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                    title={`Launch ${app.name} on laptop`}
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Disruptive Applications */}
      {pendingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-950/50 border border-amber-800/60 text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirm Launch: {pendingApp.name}
                </h3>
                <p className="text-xs text-slate-400">
                  Potentially disruptive host action
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-2">
              <p>
                <strong>{pendingApp.name}</strong> is a system or administrative tool that may alter host tasks or interrupt user activity on the Windows laptop.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                <li>Spawns in the active user desktop session.</li>
                <li>Windows UIPI restrictions apply if other windows run as Administrator.</li>
                <li>Executable: <code className="text-slate-300 font-mono">{pendingApp.app_id}</code></li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingApp(null)}
                disabled={isLaunching}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeLaunch(pendingApp, true)}
                disabled={isLaunching}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isLaunching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>Confirm & Launch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
