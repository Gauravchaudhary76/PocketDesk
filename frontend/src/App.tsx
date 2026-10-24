import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ConnectionStatus,
  DeviceInfo,
  SystemInfoResponse,
  ActiveTab,
  StreamResolution,
  ConnectionMode,
} from './types';
import { Header } from './components/Header';
import { DeviceCard } from './components/DeviceCard';
import { RemoteDisplay } from './components/RemoteDisplay';
import { MouseKeyboardSection } from './components/MouseKeyboardSection';
import { FileTransferSection } from './components/FileTransferSection';
import { ApplicationsSection } from './components/ApplicationsSection';
import { AssistantSection } from './components/AssistantSection';
import { SystemMonitorSection } from './components/SystemMonitorSection';
import { ConnectModal } from './components/ConnectModal';
import { DeviceManagementModal } from './components/DeviceManagementModal';
import { InfoModal } from './components/InfoModal';
import { streamClient } from './services/webrtc';
import { inputClient } from './services/input';
import { remoteClient } from './services/remote';
import {
  Monitor,
  Mouse,
  FolderUp,
  LayoutGrid,
  Activity,
  Sparkles,
  ChevronRight,
  Info,
  Globe,
  Hand,
  ShieldCheck,
  ShieldAlert,
  Power,
  SmartphoneCharging,
} from 'lucide-react';

export const App: React.FC = () => {
  // Connection status & mode
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(() => {
    return (localStorage.getItem('pocketdesk_connection_mode') as ConnectionMode) || 'local';
  });

  // Configurable Agent URL (automatically tracks current network host)
  const [agentUrl, setAgentUrl] = useState<string>(() => {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8000`;
    }
    const saved = localStorage.getItem('pocketdesk_agent_url');
    if (saved) return saved;
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

  // WebRTC Screen Streaming State (Stage 4 & Stage 6)
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isStartingStream, setIsStartingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamFps, setStreamFps] = useState<number>(20);
  const [streamResolution, setStreamResolution] = useState<StreamResolution>('720p');
  const [webrtcState, setWebrtcState] = useState<RTCPeerConnectionState | 'disconnected'>('disconnected');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Remote Input Control State (Stage 5)
  const [isInputEnabled, setIsInputEnabled] = useState<boolean>(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  const [confirmInputModalOpen, setConfirmInputModalOpen] = useState<boolean>(false);

  // Modals
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState<boolean>(false);
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
    stageNumber: 7,
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
          setIsInputEnabled(false);
          inputClient.disableInput(url, token).catch(() => {});
          handleOpenInfo(
            6,
            'Session Expired or Revoked',
            'Your session token has expired or was revoked by the laptop agent. Remote input and screen streaming have been safely terminated.',
            [
              'Remote session tokens automatically expire after 1 hour (configurable TTL)',
              'Replay protection nonces are single-use within a 60-second window',
              'Device revocation immediately invalidates all active sessions',
              'Re-authenticate by connecting with your paired device secret or entering a new PIN',
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
        if (consecutiveFailuresRef.current >= 2) {
          setConnectionStatus('error');
          setIsStreaming(false);
          setIsInputEnabled(false);
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

  // Clean up WebRTC session & input state when browser tab is refreshed or closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      streamClient.stopStream();
      if (agentUrl && sessionToken) {
        inputClient.disableInput(agentUrl, sessionToken);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      streamClient.stopStream();
      if (agentUrl && sessionToken) {
        inputClient.disableInput(agentUrl, sessionToken);
      }
    };
  }, [agentUrl, sessionToken]);

  // WebRTC Stream Control: Start Screen Sharing
  const handleStartStream = async () => {
    if (!agentUrl || !sessionToken) {
      setStreamError('Agent must be paired and connected before starting screen share.');
      return;
    }

    setIsStartingStream(true);
    setStreamError(null);

    try {
      let iceServers: RTCIceServer[] = [];

      // In Remote Mode, fetch dynamic STUN / TURN credentials from agent
      if (connectionMode === 'remote') {
        try {
          const iceConfig = await remoteClient.getIceServers(agentUrl, sessionToken);
          iceServers = iceConfig.ice_servers || [];
        } catch (iceErr) {
          console.warn('Could not fetch dynamic ICE servers, using fallback:', iceErr);
          iceServers = [{ urls: 'stun:stun.cloudflare.com:3478' }];
        }
      }

      await streamClient.startStream(
        agentUrl,
        sessionToken,
        {
          fps: streamFps,
          resolution: streamResolution,
          mode: connectionMode,
          iceServers,
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

  // Remote Input Controls (Stage 5)
  const handleToggleInput = (enable: boolean) => {
    if (enable) {
      setConfirmInputModalOpen(true);
    } else {
      handleEmergencyDisableInput();
    }
  };

  const handleConfirmEnableInput = async () => {
    if (!agentUrl || !sessionToken) return;
    try {
      await inputClient.enableInput(agentUrl, sessionToken);
      setIsInputEnabled(true);
      setConfirmInputModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to enable remote input';
      alert(msg);
    }
  };

  const handleEmergencyDisableInput = async () => {
    if (agentUrl && sessionToken) {
      await inputClient.disableInput(agentUrl, sessionToken);
    }
    setIsInputEnabled(false);
    setIsKeyboardOpen(false);
  };

  const handleMouseMove = (normX: number, normY: number) => {
    if (!isInputEnabled) return;
    inputClient.sendMouseMove(normX, normY);
  };

  const handleMouseMoveRelative = (dx: number, dy: number) => {
    if (!isInputEnabled) return;
    inputClient.sendMouseRelative(dx, dy);
  };

  const handleMouseClick = (
    button: 'left' | 'right' | 'middle',
    action: 'click' | 'double_click' | 'down' | 'up' = 'click',
    normX?: number,
    normY?: number
  ) => {
    if (!isInputEnabled) return;
    inputClient.sendMouseClick(button, action, normX, normY);
  };

  const handleMouseScroll = (deltaY: number) => {
    if (!isInputEnabled) return;
    inputClient.sendMouseScroll(deltaY);
  };

  const handleSendKey = (key: string, action: 'press' | 'down' | 'up' = 'press') => {
    if (!isInputEnabled) return;
    inputClient.sendKey(key, action);
  };

  const handleSendText = (text: string) => {
    if (!isInputEnabled) return;
    inputClient.sendText(text);
  };

  const handleSendShortcut = (keys: string[]) => {
    if (!isInputEnabled) return;
    inputClient.sendShortcut(keys);
  };

  // Local Wi-Fi Connection Flow
  const handleConnectLocal = async (
    targetUrl: string,
    pairingPin: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsConnecting(true);

    try {
      // Step 1: Health probe
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

      // Step 2: Local pairing
      const pairRes = await fetch(`${targetUrl}/api/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pairing_code: pairingPin,
          client_name: 'PocketDesk Web Client (Local)',
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

      // Save token securely
      setSessionToken(token);
      sessionStorage.setItem('pocketdesk_session_token', token);

      // Save configuration
      setAgentUrl(targetUrl);
      localStorage.setItem('pocketdesk_agent_url', targetUrl);
      setConnectionMode('local');
      localStorage.setItem('pocketdesk_connection_mode', 'local');

      // Fetch telemetry
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

  // Remote Internet Connection Flow (Stage 6)
  const handleConnectRemote = async (
    targetUrl: string,
    deviceName: string,
    pairingPin: string | null
  ): Promise<{ success: boolean; error?: string }> => {
    setIsConnecting(true);

    try {
      let token: string;

      if (pairingPin !== null) {
        // Pairing with 6-digit PIN
        const result = await remoteClient.pairDevice(targetUrl, deviceName, pairingPin);
        token = result.sessionToken;
      } else {
        // Authenticating existing paired device via stored cryptographic secret
        const result = await remoteClient.createSession(targetUrl);
        token = result.sessionToken;
      }

      // Save token securely
      setSessionToken(token);
      sessionStorage.setItem('pocketdesk_session_token', token);

      // Save configuration
      setAgentUrl(targetUrl);
      localStorage.setItem('pocketdesk_agent_url', targetUrl);
      setConnectionMode('remote');
      localStorage.setItem('pocketdesk_connection_mode', 'remote');

      // Fetch initial telemetry
      await fetchTelemetry(targetUrl, token);

      setConnectionStatus('connected');
      setIsConnecting(false);
      setIsConnectModalOpen(false);
      return { success: true };
    } catch (err: unknown) {
      setIsConnecting(false);
      const errMsg = err instanceof Error ? err.message : 'Unknown remote connection error';
      return { success: false, error: errMsg };
    }
  };

  // Disconnect & revoke session
  const handleDisconnect = async () => {
    // Terminate input and stream
    await handleEmergencyDisableInput();
    await handleStopStream();

    if (sessionToken && agentUrl) {
      try {
        if (connectionMode === 'local') {
          await fetch(`${agentUrl}/api/unpair`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${sessionToken}` },
            signal: AbortSignal.timeout(2000),
          }).catch(() => {});
        }
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
    { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
    { id: 'files', label: 'Files', icon: FolderUp },
    { id: 'apps', label: 'Apps', icon: LayoutGrid },
    { id: 'system', label: 'System', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-20 md:pb-8">
      {/* Top Application Header */}
      <Header
        status={connectionStatus}
        connectionMode={connectionMode}
        onStatusChange={(newStatus) => {
          if (newStatus === 'disconnected') {
            handleDisconnect();
          } else {
            setConnectionStatus(newStatus);
          }
        }}
        onOpenStageInfo={handleOpenInfo}
        onOpenDevicesModal={() => setIsDeviceModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Stage 8 Scope Announcement Banner */}
        <div className="bg-gradient-to-r from-blue-950/60 via-purple-950/40 to-indigo-950/60 border border-purple-900/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Stage 8: AI-Assisted Desktop Command Interface
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Active Stage
                </span>
                {connectionMode === 'remote' && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    INTERNET NAT/TURN
                  </span>
                )}
                {isInputEnabled && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    INPUT ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Submit natural-language instructions from phone and map them to a restricted set of authorized desktop actions (apps, telemetry, files, streaming, screenshots) via local rule-based intent parsing with zero external paid APIs and zero shell execution.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {connectionStatus !== 'connected' && (
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Connect / Pair</span>
              </button>
            )}

            {connectionStatus === 'connected' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsDeviceModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
                  title="Manage Authorized Paired Devices"
                >
                  <SmartphoneCharging className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Devices</span>
                </button>

                {isInputEnabled ? (
                  <button
                    type="button"
                    onClick={handleEmergencyDisableInput}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-900/40 transition-all cursor-pointer"
                    title="Immediately disable remote input"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Disable Input</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmInputModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/40 transition-all cursor-pointer"
                    title="Authorize remote touch and keyboard input"
                  >
                    <Hand className="w-3.5 h-3.5" />
                    <span>Enable Input</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() =>
                handleOpenInfo(
                  8,
                  'Stage 8 AI Desktop Command Interface Specifications',
                  'In Stage 8, PocketDesk integrates a secure, local rule-based AI intent parser that translates natural language into structured desktop operations.',
                  [
                    'Zero External AI Dependency: Rule-based pattern classifier requires zero paid API keys, zero cloud LLMs, and zero external network calls.',
                    'Zero Shell Command Execution: Instructions are mapped strictly to strongly-typed Python functions; no shell=True or bash/cmd/powershell strings are ever evaluated.',
                    'Destructive Command Blocking: Prohibited patterns (format, delete, shutdown, drop, kill, curl) are immediately flagged and rejected with audit alerts.',
                    'Explicit Confirmation Gates: Sensitive operations (desktop screenshots, disruptive applications) require secondary user confirmation before execution.',
                    'Audited Execution: Every command parse and execution event generates a traceable audit record logged to security audit log with audit ID.',
                    'Supported Actions: Launch allowlisted apps, query real-time system telemetry, search approved directories, control WebRTC streams, capture screenshots, and display help.',
                  ]
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            >
              <span>Stage 8 Specs</span>
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
              isInputEnabled={isInputEnabled}
              isKeyboardOpen={isKeyboardOpen}
              onFpsChange={setStreamFps}
              onResolutionChange={setStreamResolution}
              onStartStream={handleStartStream}
              onStopStream={handleStopStream}
              onToggleInput={handleToggleInput}
              onToggleKeyboard={() => setIsKeyboardOpen((prev) => !prev)}
              onMouseMove={handleMouseMove}
              onMouseClick={handleMouseClick}
              onMouseScroll={handleMouseScroll}
              onSendKey={handleSendKey}
              onSendText={handleSendText}
              onSendShortcut={handleSendShortcut}
              onOpenInfo={handleOpenInfo}
            />
            <MouseKeyboardSection
              isInputEnabled={isInputEnabled}
              isConnected={connectionStatus === 'connected'}
              onToggleInput={handleToggleInput}
              onOpenInfo={handleOpenInfo}
              onMouseMoveRelative={handleMouseMoveRelative}
              onMouseClick={handleMouseClick}
              onMouseScroll={handleMouseScroll}
              onSendKey={handleSendKey}
              onSendText={handleSendText}
              onSendShortcut={handleSendShortcut}
            />
            <ApplicationsSection
              agentUrl={agentUrl}
              token={sessionToken}
              isConnected={connectionStatus === 'connected'}
              onOpenInfo={handleOpenInfo}
            />
            <AssistantSection
              agentUrl={agentUrl}
              token={sessionToken}
              isConnected={connectionStatus === 'connected'}
              onOpenInfo={handleOpenInfo}
            />
          </div>

          {/* Right Column: Telemetry & File Management (4 columns) */}
          <div className="lg:col-span-4 space-y-6">
            <SystemMonitorSection
              systemInfo={systemInfo}
              isConnected={connectionStatus === 'connected'}
              onOpenInfo={handleOpenInfo}
              onRefresh={() => sessionToken && fetchTelemetry(agentUrl, sessionToken)}
            />
            <FileTransferSection
              agentUrl={agentUrl}
              token={sessionToken}
              isConnected={connectionStatus === 'connected'}
              onOpenInfo={handleOpenInfo}
            />
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
                isInputEnabled={isInputEnabled}
                isKeyboardOpen={isKeyboardOpen}
                onFpsChange={setStreamFps}
                onResolutionChange={setStreamResolution}
                onStartStream={handleStartStream}
                onStopStream={handleStopStream}
                onToggleInput={handleToggleInput}
                onToggleKeyboard={() => setIsKeyboardOpen((prev) => !prev)}
                onMouseMove={handleMouseMove}
                onMouseClick={handleMouseClick}
                onMouseScroll={handleMouseScroll}
                onSendKey={handleSendKey}
                onSendText={handleSendText}
                onSendShortcut={handleSendShortcut}
                onOpenInfo={handleOpenInfo}
              />
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Switch to Controls tab for virtual trackpad or open virtual keyboard.</span>
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <MouseKeyboardSection
              isInputEnabled={isInputEnabled}
              isConnected={connectionStatus === 'connected'}
              onToggleInput={handleToggleInput}
              onOpenInfo={handleOpenInfo}
              onMouseMoveRelative={handleMouseMoveRelative}
              onMouseClick={handleMouseClick}
              onMouseScroll={handleMouseScroll}
              onSendKey={handleSendKey}
              onSendText={handleSendText}
              onSendShortcut={handleSendShortcut}
            />
          )}

          {activeTab === 'assistant' && (
            <AssistantSection
              agentUrl={agentUrl}
              token={sessionToken}
              isConnected={connectionStatus === 'connected'}
              onOpenInfo={handleOpenInfo}
            />
          )}

          {activeTab === 'files' && (
            <FileTransferSection
              agentUrl={agentUrl}
              token={sessionToken}
              isConnected={connectionStatus === 'connected'}
              onOpenInfo={handleOpenInfo}
            />
          )}

          {activeTab === 'apps' && (
            <ApplicationsSection
              agentUrl={agentUrl}
              token={sessionToken}
              isConnected={connectionStatus === 'connected'}
              onOpenInfo={handleOpenInfo}
            />
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
            Stage 8 AI Desktop Interface • Windows 10/11 Host
          </div>
        </div>
      </footer>

      {/* Explicit Remote Input Authorization Confirmation Modal */}
      {confirmInputModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-950/50 border border-amber-800/60 text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Enable Remote Input Control?
                </h3>
                <p className="text-xs text-slate-400">
                  Explicit security authorization required
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-2">
              <p>
                Enabling remote input allows this browser session to dispatch <strong>mouse movement</strong>, <strong>mouse clicks</strong>, and <strong>keyboard keystrokes</strong> directly to your Windows laptop.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                <li>You can terminate input at any time via the <strong>Emergency Disable</strong> button.</li>
                <li>Windows Secure Desktop (Ctrl+Alt+Del, UAC prompts) remains protected by Windows UIPI.</li>
                <li>Disconnecting or closing the tab immediately revokes input permission.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmInputModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEnableInput}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Authorize & Enable</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect & Pair Modal Dialog */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        currentAddress={agentUrl}
        currentMode={connectionMode}
        onConnectLocal={handleConnectLocal}
        onConnectRemote={handleConnectRemote}
        isConnecting={isConnecting}
      />

      {/* Authorized Paired Devices Modal */}
      <DeviceManagementModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        agentUrl={agentUrl}
        token={sessionToken}
        onDeviceRevoked={() => {
          handleDisconnect();
        }}
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
