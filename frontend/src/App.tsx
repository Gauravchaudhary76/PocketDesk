import React, { useState } from 'react';
import type { ConnectionStatus, DeviceInfo, ActiveTab } from './types';
import { Header } from './components/Header';
import { DeviceCard } from './components/DeviceCard';
import { RemoteDisplay } from './components/RemoteDisplay';
import { MouseKeyboardSection } from './components/MouseKeyboardSection';
import { FileTransferSection } from './components/FileTransferSection';
import { ApplicationsSection } from './components/ApplicationsSection';
import { SystemMonitorSection } from './components/SystemMonitorSection';
import { InfoModal } from './components/InfoModal';
import {
  Monitor,
  Mouse,
  FolderUp,
  LayoutGrid,
  Activity,
  ShieldCheck,
  ChevronRight,
  Info
} from 'lucide-react';

export const App: React.FC = () => {
  // Connection status defaults to disconnected
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  // Active navigation tab (useful for mobile phones & small viewports)
  const [activeTab, setActiveTab] = useState<ActiveTab>('display');

  // Modal dialog state for explanatory notices on non-functional Stage 1/2 buttons
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    stageNumber: number;
    description: string;
    details?: string[];
  }>({
    isOpen: false,
    title: '',
    stageNumber: 2,
    description: '',
    details: [],
  });

  // Host device metadata (updates when connected to live agent)
  const [pairedDevice, setPairedDevice] = useState<DeviceInfo>({
    id: 'dev_win11_laptop_01',
    name: 'Windows Host (Local Agent)',
    os: 'Windows 10 / 11 (Querying agent...)',
    hostname: '127.0.0.1',
    ipAddress: 'http://127.0.0.1:8000',
    batteryLevel: 100,
    isCharging: true,
    cpuModel: 'Intel / AMD x86_64',
    ramTotalGb: 16,
    lastSeen: 'Localhost only (Stage 2)',
  });

  const handleOpenInfo = (
    stage: number,
    title: string,
    description: string,
    details?: string[]
  ) => {
    setModalState({
      isOpen: true,
      title,
      stageNumber: stage,
      description,
      details,
    });
  };

  const handleAttemptConnect = async () => {
    if (connectionStatus === 'connected') {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');

    try {
      // Attempt live connection to local FastAPI agent
      const healthRes = await fetch('http://127.0.0.1:8000/health', {
        signal: AbortSignal.timeout(3000),
      });

      if (!healthRes.ok) {
        throw new Error(`Agent health endpoint returned HTTP ${healthRes.status}`);
      }

      // Fetch live host telemetry
      const sysRes = await fetch('http://127.0.0.1:8000/api/system', {
        signal: AbortSignal.timeout(3000),
      });

      if (sysRes.ok) {
        const sysData = await sysRes.json();
        const ramGb = sysData.memory?.total_bytes
          ? Math.round(sysData.memory.total_bytes / (1024 * 1024 * 1024))
          : 16;

        setPairedDevice({
          id: 'dev_win_agent_local',
          name: `${sysData.os?.hostname || 'Windows Host'} (PocketDesk Agent)`,
          os: `${sysData.os?.system || 'Windows'} ${sysData.os?.release || ''} (${sysData.os?.architecture || ''})`,
          hostname: sysData.os?.hostname || '127.0.0.1',
          ipAddress: 'http://127.0.0.1:8000',
          batteryLevel: sysData.battery?.percent !== null ? Math.round(sysData.battery?.percent ?? 100) : 100,
          isCharging: Boolean(sysData.battery?.is_charging ?? sysData.battery?.power_plugged),
          cpuModel: sysData.cpu?.model || 'Intel / AMD Host CPU',
          ramTotalGb: ramGb,
          lastSeen: 'Live Telemetry Active',
        });
      }

      setConnectionStatus('connected');
    } catch (err: unknown) {
      setConnectionStatus('error');
      handleOpenInfo(
        2,
        'Agent Unreachable on 127.0.0.1:8000',
        'Could not reach the local PocketDesk agent at http://127.0.0.1:8000. Follow the steps below to start it.',
        [
          'Open PowerShell in the laptop-agent directory:',
          '  cd C:\\Users\\gaura\\.gemini\\antigravity\\scratch\\pocketdesk\\laptop-agent',
          'Activate the virtual environment:',
          '  .\\.venv\\Scripts\\Activate.ps1',
          'Start the agent service:',
          '  python run.py',
          'The agent will listen locally on http://127.0.0.1:8000'
        ]
      );
    }
  };

  const tabs: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'display', label: 'Screen', icon: Monitor },
    { id: 'controls', label: 'Controls', icon: Mouse },
    { id: 'files', label: 'Files', icon: FolderUp },
    { id: 'apps', label: 'Apps', icon: LayoutGrid },
    { id: 'system', label: 'System', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-20 md:pb-8">
      {/* Top Application Header */}
      <Header
        status={connectionStatus}
        onStatusChange={setConnectionStatus}
        onOpenStageInfo={handleOpenInfo}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stage 2 Scope Announcement Banner */}
        <div className="bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-indigo-950/60 border border-blue-900/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">
                  Stage 2: Windows Laptop Agent Foundation (FastAPI)
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Active Stage
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                The Python agent foundation is now implemented in <code className="text-blue-300 bg-slate-900 px-1 py-0.5 rounded">laptop-agent/</code> with <code className="text-blue-300 bg-slate-900 px-1 py-0.5 rounded">/health</code>, <code className="text-blue-300 bg-slate-900 px-1 py-0.5 rounded">/api/system</code>, and <code className="text-blue-300 bg-slate-900 px-1 py-0.5 rounded">/api/capabilities</code> endpoints bound strictly to localhost (127.0.0.1:8000).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              handleOpenInfo(
                2,
                'Stage 2 Agent Specifications',
                'Stage 2 delivers a robust local service without exposing remote control to the LAN or internet. Arbitrary execution and input control are strictly prohibited at this stage.',
                [
                  'GET /health: Semantic version, uptime, and operational health.',
                  'GET /api/system: Hardware telemetry (OS, CPU cores/usage, RAM bytes, and battery).',
                  'GET /api/capabilities: Feature inventory distinguishing available vs planned features.',
                  'Local-only security: Binds strictly to 127.0.0.1 (Rule #10).',
                  'Automated tests: 8 unit & integration tests passing with psutil mocks.'
                ]
              )
            }
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-colors"
          >
            <span>Stage 2 Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Laptop Paired Device Card */}
        <DeviceCard
          device={pairedDevice}
          status={connectionStatus}
          onAttemptConnect={handleAttemptConnect}
        />

        {/* Mobile & Small Screen Tab Navigation Pill Bar */}
        <div className="md:hidden flex items-center justify-between gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl sticky top-16 z-20 backdrop-blur-md">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-1 rounded-lg text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px]">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop Layout: Remote Screen + Multi-section Panels */}
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Remote Screen (Prominent 7 or 8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            <RemoteDisplay
              status={connectionStatus}
              onOpenInfo={handleOpenInfo}
            />
            <MouseKeyboardSection onOpenInfo={handleOpenInfo} />
            <ApplicationsSection onOpenInfo={handleOpenInfo} />
          </div>

          {/* Right Column: Telemetry & File Management (4 columns) */}
          <div className="lg:col-span-4 space-y-6">
            <SystemMonitorSection onOpenInfo={handleOpenInfo} />
            <FileTransferSection onOpenInfo={handleOpenInfo} />
          </div>
        </div>

        {/* Mobile Layout: Responsive Tab-switched View for Phone Ergonomics */}
        <div className="md:hidden space-y-4">
          {activeTab === 'display' && (
            <div className="space-y-4">
              <RemoteDisplay
                status={connectionStatus}
                onOpenInfo={handleOpenInfo}
              />
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Switch tabs below to test Touchpad Controls, Files, Apps, or System Health.</span>
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <MouseKeyboardSection onOpenInfo={handleOpenInfo} />
          )}

          {activeTab === 'files' && (
            <FileTransferSection onOpenInfo={handleOpenInfo} />
          )}

          {activeTab === 'apps' && (
            <ApplicationsSection onOpenInfo={handleOpenInfo} />
          )}

          {activeTab === 'system' && (
            <SystemMonitorSection onOpenInfo={handleOpenInfo} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/60 py-4 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">PocketDesk</span>
            <span>•</span>
            <span>Mobile-to-Windows Remote Control System</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Open-source architecture • Free of paid external APIs
          </div>
        </div>
      </footer>

      {/* Explanatory Info Modal */}
      <InfoModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        stageNumber={modalState.stageNumber}
        description={modalState.description}
        details={modalState.details}
      />
    </div>
  );
};
export default App;
