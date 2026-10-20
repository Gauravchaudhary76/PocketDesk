import React from 'react';
import {
  MonitorOff,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  RotateCcw,
  Settings,
  Layers
} from 'lucide-react';
import type { ConnectionStatus } from '../types';
import { StageBadge } from './StageBadge';

interface RemoteDisplayProps {
  status: ConnectionStatus;
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
}

export const RemoteDisplay: React.FC<RemoteDisplayProps> = ({
  status,
  onOpenInfo,
}) => {
  const handleFullscreenClick = () => {
    onOpenInfo(
      1,
      'Fullscreen Display Mode',
      'In Stage 3, when the live video stream from your Windows 11 laptop is received, fullscreen mode will expand the canvas to fit your phone or browser display seamlessly without browser chrome.',
      [
        'Touch-based pinch-to-zoom will be enabled',
        'Hardware-accelerated WebGL / Canvas rendering',
        'Auto-orientation lock for landscape mode on mobile'
      ]
    );
  };

  const handleStreamSettingsClick = () => {
    onOpenInfo(
      3,
      'Stream Quality & Codec Controls',
      'Configurable stream parameters will be supported in Stage 3 to ensure smooth performance across various Wi-Fi and mobile network conditions.',
      [
        'Video Codecs: H.264, VP9, and AV1 support',
        'Resolution options: 1080p (Native), 720p (Balanced), 540p (High FPS)',
        'Target FPS: 30 FPS / 60 FPS lock',
        'Bandwidth adaptation & packet loss compensation'
      ]
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      {/* Remote display window top bar */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700/80"></span>
          </div>
          <span className="font-mono text-[11px] text-slate-400 ml-1">
            Display 1: 1920 × 1080 @ 60Hz
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Stream telemetry indicator */}
          <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-400 mr-2">
            <span>FPS: {status === 'disconnected' ? '0' : status === 'connecting' ? '--' : '0'}</span>
            <span>Bitrate: 0 kbps</span>
            <span>RTT: -- ms</span>
          </div>

          <button
            type="button"
            onClick={handleStreamSettingsClick}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Stream Settings (Stage 3)"
            aria-label="Stream Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleFullscreenClick}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Expand Fullscreen (Stage 3)"
            aria-label="Expand Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 16:9 Aspect Ratio Display Canvas Area */}
      <div className="relative w-full aspect-video bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* State: DISCONNECTED (Default) */}
        {status === 'disconnected' && (
          <div className="max-w-md flex flex-col items-center z-10 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-inner">
              <MonitorOff className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-base font-semibold text-white">
                  Remote Display Inactive
                </h3>
                <StageBadge stage={3} label="Stage 3 Stream" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect to your Windows laptop to stream your desktop in real-time. In Stage 3, the Windows agent will capture your screen via DXGI and transmit frames over WebRTC.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 text-left w-full space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Planned Stream Architecture:</span>
              </div>
              <p className="text-slate-400">
                Windows Desktop Duplication API (DXGI) → H.264 / WebRTC PeerConnection → Mobile HTML5 Canvas & WebGL Renderer.
              </p>
            </div>
          </div>
        )}

        {/* State: CONNECTED (Stage 2 Agent Verified) */}
        {status === 'connected' && (
          <div className="max-w-md flex flex-col items-center z-10 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/50">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-base font-semibold text-emerald-300">
                  Laptop Agent Online (v0.2.0)
                </h3>
                <StageBadge stage={2} label="Stage 2 Connected" variant="filled" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Agent is active on <span className="font-mono text-emerald-300">127.0.0.1:8000</span>. Hardware telemetry endpoints are responding. Real-time screen capture via DXGI will be integrated in Stage 3.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 text-left w-full space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Next Milestone (Stage 3):</span>
              </div>
              <p className="text-slate-400">
                DirectX Desktop Duplication API (DXGI) video pipeline will stream real-time desktop video frames directly into this viewport.
              </p>
            </div>
          </div>
        )}

        {/* State: CONNECTING / LOADING */}
        {status === 'connecting' && (
          <div className="max-w-md flex flex-col items-center z-10 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-cyan-500/10 blur-sm -z-10 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-cyan-300">
                Negotiating Stream Connection...
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Exchanging WebRTC SDP credentials and authenticating session with Windows host agent...
              </p>
            </div>

            {/* Simulated connection progress bar */}
            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-pulse w-3/4" />
            </div>

            <span className="text-[11px] font-mono text-slate-400">
              Protocol: WSS / WebRTC ICE Candidate Check
            </span>
          </div>
        )}

        {/* State: ERROR */}
        {status === 'error' && (
          <div className="max-w-md flex flex-col items-center z-10 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/50">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-rose-300">
                Remote Stream Unreachable
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Could not connect to laptop-agent on <span className="font-mono text-rose-300">192.168.1.145:8080</span>.
              </p>
            </div>

            <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-3 text-left w-full text-xs text-rose-200/90 space-y-1.5">
              <span className="font-semibold block text-rose-300 text-[11px] uppercase tracking-wider">
                Troubleshooting Checklist:
              </span>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                <li>Ensure the Python agent is started on your Windows laptop.</li>
                <li>Verify your phone and laptop are on the same Wi-Fi network.</li>
                <li>Confirm Windows Defender Firewall allows local port 8080.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() =>
                onOpenInfo(
                  2,
                  'Backend Agent Connection',
                  'In Stage 2, the Python FastAPI backend and pairing handshake will be implemented. During Stage 1, this error state serves as a layout and error-handling verification.',
                  [
                    'FastAPI server will listen on localhost/LAN',
                    'A secure pairing PIN / QR code will be generated',
                    'Session reconnect logic will automatically recover from network drops'
                  ]
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 text-xs border border-rose-800/60 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Connection (Stage 2)</span>
            </button>
          </div>
        )}

        {/* Watermark overlay at bottom right */}
        <div className="absolute bottom-2 right-3 font-mono text-[10px] text-slate-700 pointer-events-none">
          PocketDesk Stream Engine • Virtual Canvas
        </div>
      </div>
    </div>
  );
};
