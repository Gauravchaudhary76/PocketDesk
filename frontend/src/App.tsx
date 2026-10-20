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
  // Connection status defaults to disconnected as required
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  // Active navigation tab (useful for mobile phones & small viewports)
  const [activeTab, setActiveTab] = useState<ActiveTab>('display');

  // Modal dialog state for explanatory notices on non-functional Stage 1 buttons
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    stageNumber: number;
    description: string;
    details?: string[];
  }>({
    isOpen: false,
    title: '',
    stageNumber: 1,
    description: '',
    details: [],
  });

  // Mock paired laptop metadata
  const pairedDevice: DeviceInfo = {
    id: 'dev_win11_laptop_01',
    name: 'Dell XPS 15 (Windows 11)',
    os: 'Windows 11 Pro 64-bit (23H2)',
    hostname: 'DESKTOP-WIN11-WORK',
    ipAddress: '192.168.1.145:8080',
    batteryLevel: 94,
    isCharging: true,
    cpuModel: 'Intel Core i7-13700H @ 2.40GHz',
    ramTotalGb: 32,
    lastSeen: 'Just now (Prototype LAN)',
  };

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

  const handleAttemptConnect = () => {
    handleOpenInfo(
      2,
      'Connect to Windows Host (Backend Handshake)',
      'The "Connect" action will initiate a mutual TLS / WebSocket pairing handshake with the Python FastAPI backend on your laptop in Stage 2. It is intentionally inactive during this Stage 1 frontend prototype.',
      [
        'Stage 2 will launch a local Python FastAPI service listening on localhost:8080.',
        'A secure ephemeral 6-digit PIN or QR code will authenticate your phone.',
        'No remote access or exposed ports will be opened until full security checks are complete.',
        'You can preview the Connecting and Error states using the state switcher in the top navigation bar.'
      ]
    );
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
        {/* Stage 1 Scope Announcement Banner */}
        <div className="bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-indigo-950/60 border border-blue-900/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">
                  Stage 1: Frontend Dashboard & Component Architecture
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Active Stage
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                This responsive dashboard establishes the UI foundation for PocketDesk. All buttons and interactive controls strictly adhere to Rule #6 and show explanatory notices regarding their planned backend stages.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              handleOpenInfo(
                1,
                'Stage 1 Compliance & Verification',
                'Stage 1 establishes the client-side architecture using React, Vite, TypeScript, and Tailwind CSS. No mock buttons pretend to perform actions. The Python backend and Windows agent will be developed in subsequent stages.',
                [
                  'Requirement A: Environment inspected (Node.js 22, npm 10, Python 3.13, Git).',
                  'Requirement B: Frontend application initialized in /frontend.',
                  'Requirement C: Dashboard with dark UI, device card, 16:9 preview, 4 feature sections, and multi-state simulator.',
                  'Requirement D: Clean project structure accommodating frontend, backend, laptop-agent, and docs.',
                  'Requirement E: Reusable typed components without bloated dependencies.',
                  'Requirement F: Comprehensive root README.md documentation.'
                ]
              )
            }
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-colors"
          >
            <span>Stage 1 Details</span>
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
