import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ConnectionStatus, DeviceInfo, SystemInfoResponse, ActiveTab, StreamResolution } from './types';
import { Header } from './components/Header';
import { DeviceCard } from './components/DeviceCard';
import { RemoteDisplay } from './components/RemoteDisplay';
import { MouseKeyboardSection } from './components/MouseKeyboardSection';
import { FileTransferSection } from './components/FileTransferSection';
import { ApplicationsSection } from './components/ApplicationsSection';
import { SystemMonitorSection } from './components/SystemMonitorSection';
import { ConnectModal } from './components/ConnectModal';
import { InfoModal } from './components/InfoModal';
import { streamClient } from './services/webrtc';
import {
  Monitor,
  Mouse,
  FolderUp,
  LayoutGrid,
  Activity,
  ChevronRight,
  Info,
  Wifi,
  Tv
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

  // WebRTC Screen Streaming State (Stage 4)
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isStartingStream, setIsStartingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamFps, setStreamFps] = useState<number>(20);
  const [streamResolution, setStreamResolution] = useState<StreamResolution>('720p');
  const [webrtcState, setWebrtcState] = useState<RTCPeerConnectionState | 'disconnected'>('disconnected');
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
    stageNumber: 4,
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
          setIsStreaming(false);
          handleOpenInfo(
            4,
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
      } catch {
        consecutiveFailuresRef.current += 1;
        // If 2 consecutive failures occur, mark error
        if (consecutiveFailuresRef.current >= 2) {
          setConnectionStatus('error');
          setIsStreaming(false);
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

  // Clean up WebRTC session when browser tab is refreshed or closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      streamClient.stopStream();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      streamClient.stopStream();
    };
  }, []);

  // WebRTC Stream Control: Start Screen Sharing
  const handleStartStream = async () => {
    if (!agentUrl || !sessionToken) {
      setStreamError('Agent must be paired and connected before starting screen share.');
      return;
    }

    setIsStartingStream(true);
    setStreamError(null);

    try {
      await streamClient.startStream(
        agentUrl,
        sessionToken,
        {
          fps: streamFps,
          resolution: streamResolution,
        },
        (remoteStream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = remoteStream;
            videoRef.current.play().catch(() => {});
          }
          setIsStreaming(true);
          setIsStartingStream(false);
        },
        (state) => {
          setWebrtcState(state);
          if (state === 'failed' || state === 'closed' || state === 'disconnected') {
            setIsStreaming(false);
            setIsStartingStream(false);
          } else if (state === 'connected') {
            setIsStreaming(true);
            setIsStartingStream(false);
          }
        }
      );
    } catch (err: unknown) {
      setIsStartingStream(false);
      setIsStreaming(false);
      const msg = err instanceof Error ? err.message : 'WebRTC stream negotiation failed.';
      setStreamError(msg);
    }
  };

  // WebRTC Stream Control: Stop Screen Sharing
  const handleStopStream = async () => {
    try {
      await streamClient.stopStream();
    } catch {
      // Ignore unreachability during stop
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setIsStartingStream(false);
    setWebrtcState('disconnected');
  };

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
    // Terminate stream if active
    await handleStopStream();

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
        {/* Stage 4 Scope Announcement Banner */}
        <div className="bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-indigo-950/60 border border-blue-900/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0 mt-0.5">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  Stage 4: Local WebRTC Desktop Screen Streaming
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Active Stage
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Stream your Windows 10/11 desktop directly to your mobile browser over local Wi-Fi. Screen capture begins only upon your explicit command, prints <code className="text-emerald-400 font-mono">[SCREEN SHARING ACTIVE]</code> on your laptop, and can be stopped at any time from both phone and laptop.
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
                  4,
                  'Stage 4 WebRTC Desktop Streaming Architecture',
                  'In Stage 4, PocketDesk streams the user desktop over direct peer-to-peer WebRTC across the local Wi-Fi network without third-party cloud relays.',
                  [
                    'Explicit User Initiation: Screen capture starts strictly on user request.',
                    'Laptop Indicator: Terminal displays [SCREEN SHARING ACTIVE] whenever streaming.',
                    'Direct WebRTC PeerConnection: Empty iceServers prevents third-party STUN/TURN data leakage.',
                    'Configurable Limits: Select 1080p, 720p, 540p or 480p at 15, 20 or 30 FPS to minimize CPU load.',
                    'Dual Stop Mechanism: Stop button in browser UI + POST /api/stream/stop or Ctrl+C on laptop.',
                    'Isolated Remote Input: Mouse and keyboard injection remain strictly disabled until Stage 5.'
                  ]
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <span>Stage 4 Specs</span>
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
          {/* Left Column: Remote Screen (Prominent 8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            <RemoteDisplay
              status={connectionStatus}
              isStreaming={isStreaming}
              isStartingStream={isStartingStream}
              streamError={streamError}
              streamFps={streamFps}
              streamResolution={streamResolution}
              webrtcState={webrtcState}
              videoRef={videoRef}
              onFpsChange={setStreamFps}
              onResolutionChange={setStreamResolution}
              onStartStream={handleStartStream}
              onStopStream={handleStopStream}
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
                isStreaming={isStreaming}
                isStartingStream={isStartingStream}
                streamError={streamError}
                streamFps={streamFps}
                streamResolution={streamResolution}
                webrtcState={webrtcState}
                videoRef={videoRef}
                onFpsChange={setStreamFps}
                onResolutionChange={setStreamResolution}
                onStartStream={handleStartStream}
                onStopStream={handleStopStream}
                onOpenInfo={handleOpenInfo}
              />
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Switch tabs to inspect Controls, Files, Apps, or System Health telemetry.</span>
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
            Stage 4 Local WebRTC Screen Streaming • Ordinary HTTP traffic restricted to trusted LAN
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
