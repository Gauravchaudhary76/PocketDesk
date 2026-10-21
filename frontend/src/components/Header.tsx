import React from 'react';
import { Monitor, Smartphone, Shield, Wifi, Globe, SmartphoneCharging } from 'lucide-react';
import type { ConnectionStatus, ConnectionMode } from '../types';
import { StatusBadge } from './StatusBadge';

interface HeaderProps {
  status: ConnectionStatus;
  connectionMode: ConnectionMode;
  onStatusChange: (newStatus: ConnectionStatus) => void;
  onOpenStageInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
  onOpenDevicesModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  connectionMode,
  onStatusChange,
  onOpenStageInfo,
  onOpenDevicesModal,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 shadow-lg shadow-blue-500/20">
            <Monitor className="w-5 h-5 text-white" />
            <Smartphone className="w-3 h-3 text-cyan-200 absolute -bottom-0.5 -right-0.5 bg-slate-950 rounded-full p-0.5 border border-cyan-400/50" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                PocketDesk
              </h1>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                v0.8.0 • Stage 8
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                {connectionMode === 'remote' ? (
                  <>
                    <Globe className="w-3 h-3 text-cyan-400" />
                    Remote NAT/TURN
                  </>
                ) : (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    Local Wi-Fi
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Secure Mobile-to-Laptop Remote Control System
            </p>
          </div>
        </div>

        {/* Status and Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Active status */}
          <StatusBadge status={status} />

          {/* Authorized Devices Trigger */}
          <button
            type="button"
            onClick={onOpenDevicesModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition-colors cursor-pointer"
            title="Manage Authorized Paired Devices"
          >
            <SmartphoneCharging className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Devices</span>
          </button>

          {/* Interactive State Tester for previewing states */}
          <div className="hidden md:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <span className="px-2 text-[11px] text-slate-400 font-medium">
              Preview State:
            </span>
            <button
              type="button"
              onClick={() => onStatusChange('disconnected')}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                status === 'disconnected'
                  ? 'bg-slate-700/80 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Preview Disconnected State"
            >
              Disconnected
            </button>
            <button
              type="button"
              onClick={() => onStatusChange('connecting')}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                status === 'connecting'
                  ? 'bg-cyan-700/60 text-cyan-200 font-semibold'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
              title="Preview Connecting / Loading State"
            >
              Connecting
            </button>
            <button
              type="button"
              onClick={() => onStatusChange('connected')}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                status === 'connected'
                  ? 'bg-emerald-800/80 text-emerald-200 font-semibold'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
              title="Preview Connected State"
            >
              Connected
            </button>
            <button
              type="button"
              onClick={() => onStatusChange('error')}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                status === 'error'
                  ? 'bg-rose-900/60 text-rose-200 font-semibold'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
              title="Preview Error State"
            >
              Error
            </button>
          </div>

          {/* Stage Roadmap quick trigger */}
          <button
            type="button"
            onClick={() =>
              onOpenStageInfo(
                8,
                'PocketDesk Architecture & Stage Roadmap',
                'PocketDesk is built incrementally following strict engineering rules. Stage 8 delivers an AI-assisted desktop command interface mapping natural language to safe, rule-validated desktop actions without external paid APIs.',
                [
                  'Stage 1: Frontend Prototype, UI Dashboard & Responsive Layout (Completed)',
                  'Stage 2: Python FastAPI Agent Foundation & Local Telemetry (Completed)',
                  'Stage 3: Local Network Device Pairing & Authenticated Handshake (Completed)',
                  'Stage 4: Authenticated WebRTC Desktop Video Streaming (Completed)',
                  'Stage 5: Low-latency Input Dispatch (Mouse, Keyboard, Touch) (Completed)',
                  'Stage 6: Encrypted WebRTC & Dynamic TURN Traversal for Remote Internet Access (Completed)',
                  'Stage 7: Restricted File Management & Application Launcher (Completed)',
                  'Stage 8: AI-Assisted Desktop Command Interface (Current Stage)',
                ]
              )
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
            title="View Roadmap & Stage Info"
            aria-label="View Project Roadmap"
          >
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Roadmap</span>
          </button>
        </div>
      </div>
    </header>
  );
};
