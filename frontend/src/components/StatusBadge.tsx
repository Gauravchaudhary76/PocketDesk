import React from 'react';
import type { ConnectionStatus } from '../types';
import { WifiOff, Loader2, AlertCircle, Wifi } from 'lucide-react';

interface StatusBadgeProps {
  status: ConnectionStatus;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showIcon = true,
}) => {
  switch (status) {
    case 'connected':
      return (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 shadow-sm"
          role="status"
          aria-label="Status: Connected"
        >
          {showIcon && <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Agent Online
          </span>
        </span>
      );

    case 'connecting':
      return (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 shadow-sm"
          role="status"
          aria-label="Status: Connecting"
        >
          {showIcon && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
          <span>Connecting...</span>
        </span>
      );

    case 'error':
      return (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-950/70 text-rose-300 border border-rose-800/60 shadow-sm"
          role="status"
          aria-label="Status: Error"
        >
          {showIcon && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
          <span>Connection Error</span>
        </span>
      );

    case 'disconnected':
    default:
      return (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-900/90 text-slate-400 border border-slate-800 shadow-sm"
          role="status"
          aria-label="Status: Disconnected"
        >
          {showIcon && <WifiOff className="w-3.5 h-3.5 text-slate-500" />}
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            Disconnected
          </span>
        </span>
      );
  }
};
