import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ConnectionStatus, DeviceInfo, SystemInfoResponse, ActiveTab } from './types';
import { Header } from './components/Header';
import { DeviceCard } from './components/DeviceCard';
import { RemoteDisplay } from './components/RemoteDisplay';
import { MouseKeyboardSection } from './components/MouseKeyboardSection';
import { FileTransferSection } from './components/FileTransferSection';
import { ApplicationsSection } from './components/ApplicationsSection';
import { SystemMonitorSection } from './components/SystemMonitorSection';
import { ConnectModal } from './components/ConnectModal';
import { InfoModal } from './components/InfoModal';
import {
  Monitor,
  Mouse,
  FolderUp,
  LayoutGrid,
  Activity,
  ShieldCheck,
  ChevronRight,
  Info,
  Wifi
} from 'lucide-react';

export const App: React.FC = () => {
  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  // Configurable Agent URL
  const [agentUrl, setAgentUrl] = useState<string>(() => {
    const saved = localStorage.getItem('pocketdesk_agent_url');
    if (saved) return saved;
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8000`;
    }
    return 'http://127.0.0.1:8000';
  });

  // Sensitive session token (kept in memory and sessionStorage only, NEVER in URLs or logs)
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    return sessionStorage.getItem('pocketdesk_session_token');
  });

  // Real host system telemetry returned from agent
  const [systemInfo, setSystemInfo] = useState<SystemInfoResponse | null>(null);

  // Active navigation tab (for mobile viewports)
  const [activeTab, setActiveTab] = useState<ActiveTab>('display');

  // Modals
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    stageNumber: number;
    description: string;
    details?: string[];
  }>({
    isOpen: false,
    title: '',
    stageNumber: 3,
    description: '',
    details: [],
  });

  // Track consecutive telemetry query failures
  const consecutiveFailuresRef = useRef<number>(0);

  // Paired device metadata
  const [pairedDevice, setPairedDevice] = useState<DeviceInfo>({
    id: 'dev_win11_laptop_host',
    name: 'Windows Laptop Host',
    os: 'Windows 10 / 11',
    hostname: 'Localhost / LAN',
    ipAddress: agentUrl,
    batteryLevel: null,
    isCharging: false,
    cpuModel: 'Intel / AMD Processor',
    ramTotalGb: 16,
    lastSeen: 'Offline',
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

  // Helper to query system telemetry using active session token
  const fetchTelemetry = useCallback(
    async (url: string, token: string): Promise<boolean> => {
      try {
        const res = await fetch(`${url}/api/system`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(3500),
        });

        if (res.status === 401) {
          // Token expired or revoked by agent
          setSessionToken(null);
          sessionStorage.removeItem('pocketdesk_session_token');
          setConnectionStatus('disconnected');
          setSystemInfo(null);
          handleOpenInfo(
            3,
            'Session Expired or Revoked',
            'Your session token has expired or was revoked by the laptop agent. Please reconnect and enter the pairing PIN shown on your laptop terminal.',
            [
              'Local sessions are automatically invalidated upon agent restart',
              'Tokens expire after 4 hours of inactivity',
              'Re-authorize by entering the current 6-digit PIN'
            ]
          );
          return false;
        }

        if (!res.ok) {
          throw new Error(`Agent returned HTTP ${res.status}`);
        }

        const data: SystemInfoResponse = await res.json();
        setSystemInfo(data);
        consecutiveFailuresRef.current = 0;

        // Update device card
        const ramGb = data.memory?.total_bytes
          ? Math.round(data.memory.total_bytes / (1024 * 1024 * 1024))
          : 16;

        setPairedDevice({
          id: 'dev_win_agent_paired',
          name: `${data.os?.hostname || 'Windows Host'} (PocketDesk Agent)`,
          os: `${data.os?.system || 'Windows'} ${data.os?.release || ''} (${data.os?.architecture || ''})`,
          hostname: data.os?.hostname || 'localhost',
          ipAddress: url,
          batteryLevel: data.battery?.percent !== null ? Math.round(data.battery?.percent ?? 100) : null,
          isCharging: Boolean(data.battery?.is_charging || data.battery?.power_plugged),
          cpuModel: data.cpu?.model || 'Intel / AMD Processor',
          ramTotalGb: ramGb,
          lastSeen: 'Live Telemetry Active',
        });

        return true;
      } catch (err) {
        consecutiveFailuresRef.current += 1;
        // If 2 consecutive failures occur, mark error
        if (consecutiveFailuresRef.current >= 2) {
          setConnectionStatus('error');
        }
        return false;
      }
    },
    []
  );

  // Poll telemetry every 2.5s when connected
  useEffect(() => {
    if (connectionStatus !== 'connected' || !sessionToken) {
      return;
    }

    const interval = setInterval(() => {
      fetchTelemetry(agentUrl, sessionToken);
    }, 2500);

    return () => clearInterval(interval);
  }, [connectionStatus, sessionToken, agentUrl, fetchTelemetry]);

  // Initiate connection & pairing workflow
  const handleConnectWithPin = async (
    targetUrl: string,
    pairingPin: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsConnecting(true);

    try {
      // Step 1: Health probe to ensure agent is reachable
      const healthRes = await fetch(`${targetUrl}/health`, {
        signal: AbortSignal.timeout(3500),
      }).catch(() => {
        throw new Error(
          `Cannot reach agent at ${targetUrl}. Ensure the agent is started on your laptop with 'python run.py --lan' and Windows Firewall allows port 8000.`
        );
      });

      if (!healthRes.ok) {
        throw new Error(`Agent health check returned HTTP ${healthRes.status}`);
      }

      // Step 2: Authorize with 6-digit PIN
      const pairRes = await fetch(`${targetUrl}/api/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pairing_code: pairingPin,
          client_name: 'PocketDesk Web Client',
        }),
        signal: AbortSignal.timeout(3500),
      }).catch(() => {
        throw new Error('Connection failed while submitting pairing authorization.');
      });

      if (!pairRes.ok) {
        const errorData = await pairRes.json().catch(() => ({}));
        const detail = errorData.detail || 'Invalid pairing code.';
        throw new Error(detail);
      }

      const pairData = await pairRes.json();
      const token = pairData.session_token;

      // Save token securely (in memory and sessionStorage)
      setSessionToken(token);
      sessionStorage.setItem('pocketdesk_session_token', token);

      // Save valid URL
      setAgentUrl(targetUrl);
      localStorage.setItem('pocketdesk_agent_url', targetUrl);

      // Step 3: Fetch initial telemetry
      await fetchTelemetry(targetUrl, token);

      setConnectionStatus('connected');
      setIsConnecting(false);
      setIsConnectModalOpen(false);
      return { success: true };
    } catch (err: unknown) {
      setIsConnecting(false);
      const errMsg = err instanceof Error ? err.message : 'Unknown connection error';
      return { success: false, error: errMsg };
    }
  };

  // Disconnect & revoke session
  const handleDisconnect = async () => {
    if (sessionToken && agentUrl) {
      try {
        await fetch(`${agentUrl}/api/unpair`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
          signal: AbortSignal.timeout(2000),
        }).catch(() => {});
      } catch {
        // Ignore network error on unpair
      }
    }

    setSessionToken(null);
    sessionStorage.removeItem('pocketdesk_session_token');
    setConnectionStatus('disconnected');
    setSystemInfo(null);
    setPairedDevice((prev) => ({
      ...prev,
      lastSeen: 'Disconnected',
    }));
  };

  const handleDeviceCardAction = () => {
    if (connectionStatus === 'connected') {
      handleDisconnect();
    } else {
      setIsConnectModalOpen(true);
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
        onStatusChange={(newStatus) => {
          if (newStatus === 'disconnected') {
            handleDisconnect();
          } else {
            setConnectionStatus(newStatus);
          }
        }}
        onOpenStageInfo={handleOpenInfo}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stage 3 Scope Announcement Banner */}
        <div className="bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-indigo-950/60 border border-blue-900/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  Stage 3: Local Network Device Pairing & Authenticated Telemetry
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Active Stage
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Connect your phone to your Windows laptop over your local Wi-Fi network. Pairing is authorized securely using a 6-digit PIN displayed on your laptop terminal. Remote desktop streaming and input injection remain safely isolated.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {connectionStatus !== 'connected' && (
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Pair with Laptop</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                handleOpenInfo(
                  3,
                  'Stage 3 Local Network Pairing Architecture',
                  'In Stage 3, PocketDesk enables local-network communication between client and agent. Pairing requires physical authorization on the laptop terminal. Plaintext HTTP traffic is limited to trusted private LANs.',
                  [
                    'Configurable Agent Address: Connect via LAN IP (e.g., http://192.168.1.145:8000).',
                    'Terminal Pairing PIN: Cryptographically random 6-digit PIN displayed on laptop.',
                    'Bearer Session Token: Issued upon authorization, kept strictly out of URLs.',
                    'Narrow CORS: Strictly restricts access to loopback and RFC1918 private subnets.',
                    'Live Telemetry: Real CPU load, memory utilization, and battery status polled every 2.5s.',
                    'Rule #10 Enforced: Ordinary HTTP traffic is not exposed to the public internet.'
                  ]
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <span>Stage 3 Specs</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Laptop Paired Device Card */}
        <DeviceCard
          device={pairedDevice}
          status={connectionStatus}
          onAttemptConnect={handleDeviceCardAction}
          onConfigureAddress={() => setIsConnectModalOpen(true)}
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
            <SystemMonitorSection
              systemInfo={systemInfo}
              isConnected={connectionStatus === 'connected'}
              onOpenInfo={handleOpenInfo}
              onRefresh={() => sessionToken && fetchTelemetry(agentUrl, sessionToken)}
            />
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
                <span>Switch tabs to test Controls, Files, Apps, or System Health telemetry.</span>
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
            <SystemMonitorSection
              systemInfo={systemInfo}
              isConnected={connectionStatus === 'connected'}
              onOpenInfo={handleOpenInfo}
              onRefresh={() => sessionToken && fetchTelemetry(agentUrl, sessionToken)}
            />
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
            Stage 3 Local Wi-Fi Pairing • Ordinary HTTP traffic restricted to trusted LAN
          </div>
        </div>
      </footer>

      {/* Connect & Pair Modal Dialog */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        currentAddress={agentUrl}
        onConnect={handleConnectWithPin}
        isConnecting={isConnecting}
      />

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
