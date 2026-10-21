import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  AppState,
  AppStateStatus,
} from 'react-native';

import type {
  ConnectionStatus,
  ConnectionMode,
  ActiveTab,
  StreamResolution,
  SystemInfoResponse,
  RegisteredLaptop,
} from './types';

import { Header } from './components/Header';
import { ConnectScreen } from './screens/ConnectScreen';
import { RemoteDesktopScreen } from './screens/RemoteDesktopScreen';
import { FilesScreen } from './screens/FilesScreen';
import { AppsScreen } from './screens/AppsScreen';
import { SystemScreen } from './screens/SystemScreen';
import { AssistantScreen } from './screens/AssistantScreen';

import { authService } from './services/auth';
import { secureStorage } from './services/secureStorage';
import { systemService } from './services/system';
import { androidWebRTC } from './services/webrtc';
import { androidInput } from './services/input';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('connect');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [mode, setMode] = useState<ConnectionMode>('local');
  const [agentUrl, setAgentUrl] = useState<string>('http://10.0.2.2:8000'); // Standard Android emulator localhost alias
  const [registeredLaptops, setRegisteredLaptops] = useState<RegisteredLaptop[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfoResponse | null>(null);

  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // WebRTC Stream & Input states
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isInputEnabled, setIsInputEnabled] = useState<boolean>(false);
  const [streamResolution, setStreamResolution] = useState<StreamResolution>('720p');
  const [fps, setFps] = useState<number>(20);

  // Failure tracking
  const consecutiveErrorsRef = useRef<number>(0);

  // Load saved laptops and last session on mount
  useEffect(() => {
    const initStorage = async () => {
      const laptops = await secureStorage.getRegisteredLaptops();
      setRegisteredLaptops(laptops);
      if (laptops.length > 0) {
        const lastId = await secureStorage.getLastConnectedLaptopId();
        const found = laptops.find((l) => l.id === lastId) || laptops[0];
        setAgentUrl(found.agentUrl);
        setMode(found.mode);
      }
    };
    initStorage();
  }, []);

  // Configure WebRTC callbacks
  useEffect(() => {
    androidWebRTC.setCallbacks({
      onStreamStarted: () => setIsStreaming(true),
      onStreamStopped: () => setIsStreaming(false),
      onError: (err) => setErrorMessage(`Stream error: ${err}`),
      onConnectionStateChange: (state) => {
        if (state === 'failed') {
          setIsStreaming(false);
          setErrorMessage('WebRTC media stream failed');
        }
      },
    });
  }, []);

  // Telemetry polling effect
  useEffect(() => {
    if (status !== 'connected') return;

    const interval = setInterval(async () => {
      try {
        const data = await systemService.getTelemetry(agentUrl);
        setSystemInfo(data);
        consecutiveErrorsRef.current = 0;
      } catch {
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= 3) {
          setStatus('error');
          setErrorMessage('Lost connection to laptop agent');
          androidWebRTC.stopStream(agentUrl);
          androidInput.emergencyStop(agentUrl);
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [status, agentUrl]);

  /**
   * Android AppState Lifecycle Handling (Stage 9 Requirement):
   * When app enters background:
   * 1. Pauses WebRTC video track to save battery and network bandwidth.
   * 2. Immediately disables remote input and sends emergency stop to host to clear any held keys.
   * When app resumes to active foreground:
   * 1. Restores video stream track and re-validates connection.
   */
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const isBackground = nextState === 'background' || nextState === 'inactive';
      androidWebRTC.handleAppBackground(isBackground);

      if (isBackground && status === 'connected') {
        androidInput.emergencyStop(agentUrl);
        setIsInputEnabled(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [status, agentUrl]);

  // Connection Handler: Local Wi-Fi
  const handleConnectLocal = async (url: string, pin: string) => {
    try {
      setIsConnecting(true);
      setErrorMessage(null);
      setStatus('connecting');

      const pairRes = await authService.pairLocal(url, pin);
      setStatus('connected');

      // Save registered laptop
      const laptopProfile: RegisteredLaptop = {
        id: `laptop_${Date.now()}`,
        name: `Windows Laptop (${new URL(url).hostname})`,
        agentUrl: url,
        mode: 'local',
        lastConnected: new Date().toISOString(),
      };
      await secureStorage.saveRegisteredLaptop(laptopProfile);
      await secureStorage.setLastConnectedLaptopId(laptopProfile.id);

      const refreshed = await secureStorage.getRegisteredLaptops();
      setRegisteredLaptops(refreshed);

      // Auto-fetch initial telemetry and switch to desktop
      const telem = await systemService.getTelemetry(url);
      setSystemInfo(telem);
      setActiveTab('desktop');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Local pairing failed');
    } finally {
      setIsConnecting(false);
    }
  };

  // Connection Handler: Remote Internet
  const handleConnectRemote = async (url: string, pin: string) => {
    try {
      setIsConnecting(true);
      setErrorMessage(null);
      setStatus('connecting');

      await authService.registerRemoteDevice(url, pin, 'Android Phone');
      await authService.createRemoteSession(url);
      setStatus('connected');

      const laptopProfile: RegisteredLaptop = {
        id: `laptop_remote_${Date.now()}`,
        name: `Windows Laptop (Remote NAT)`,
        agentUrl: url,
        mode: 'remote',
        lastConnected: new Date().toISOString(),
      };
      await secureStorage.saveRegisteredLaptop(laptopProfile);
      await secureStorage.setLastConnectedLaptopId(laptopProfile.id);

      const refreshed = await secureStorage.getRegisteredLaptops();
      setRegisteredLaptops(refreshed);

      const telem = await systemService.getTelemetry(url);
      setSystemInfo(telem);
      setActiveTab('desktop');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Remote registration failed');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect Handler
  const handleDisconnect = async () => {
    try {
      await androidInput.emergencyStop(agentUrl);
      await androidWebRTC.stopStream(agentUrl);
      await authService.disconnect(agentUrl);
    } finally {
      setStatus('disconnected');
      setIsStreaming(false);
      setIsInputEnabled(false);
      setSystemInfo(null);
      setActiveTab('connect');
    }
  };

  // Toggle Stream Handler
  const handleToggleStream = async () => {
    if (isStreaming) {
      await androidWebRTC.stopStream(agentUrl);
      setIsStreaming(false);
    } else {
      try {
        await androidWebRTC.startStream(agentUrl, streamResolution, fps, mode === 'remote');
        setIsStreaming(true);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not start WebRTC stream');
      }
    }
  };

  // Input Control Handlers
  const handleToggleInput = async () => {
    const nextState = !isInputEnabled;
    try {
      await androidInput.setInputState(agentUrl, nextState);
      setIsInputEnabled(nextState);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to toggle remote input');
    }
  };

  const handleEmergencyStop = async () => {
    await androidInput.emergencyStop(agentUrl);
    setIsInputEnabled(false);
  };

  // Laptop Selection Handlers
  const handleSelectLaptop = (laptop: RegisteredLaptop) => {
    setAgentUrl(laptop.agentUrl);
    setMode(laptop.mode);
    secureStorage.setLastConnectedLaptopId(laptop.id);
  };

  const handleRemoveLaptop = async (laptopId: string) => {
    await secureStorage.removeRegisteredLaptop(laptopId);
    const refreshed = await secureStorage.getRegisteredLaptops();
    setRegisteredLaptops(refreshed);
  };

  const navigationTabs: Array<{ id: ActiveTab; label: string; icon: string }> = [
    { id: 'desktop', label: 'Screen', icon: '🖥️' },
    { id: 'files', label: 'Files', icon: '📁' },
    { id: 'apps', label: 'Apps', icon: '⚡' },
    { id: 'system', label: 'System', icon: '📊' },
    { id: 'assistant', label: 'AI', icon: '✨' },
    { id: 'connect', label: 'Connect', icon: '🔗' },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      {/* Top Application Header */}
      <Header
        status={status}
        connectionMode={mode}
        systemInfo={systemInfo}
        onOpenConnect={() => setActiveTab('connect')}
        onEmergencyStop={handleEmergencyStop}
        isInputActive={isInputEnabled}
      />

      {/* Connection Loss Banner */}
      {status === 'error' && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            ⚠️ Connection lost or error occurred. Tap Connect to retry.
          </Text>
        </View>
      )}

      {/* Active Screen View */}
      <View style={styles.screenContainer}>
        {activeTab === 'connect' && (
          <ConnectScreen
            status={status}
            mode={mode}
            agentUrl={agentUrl}
            registeredLaptops={registeredLaptops}
            isConnecting={isConnecting}
            errorMessage={errorMessage}
            onSetAgentUrl={setAgentUrl}
            onSetMode={setMode}
            onConnectLocal={handleConnectLocal}
            onConnectRemote={handleConnectRemote}
            onDisconnect={handleDisconnect}
            onSelectLaptop={handleSelectLaptop}
            onRemoveLaptop={handleRemoveLaptop}
          />
        )}

        {activeTab === 'desktop' && (
          <RemoteDesktopScreen
            status={status}
            agentUrl={agentUrl}
            isStreaming={isStreaming}
            isInputEnabled={isInputEnabled}
            streamResolution={streamResolution}
            fps={fps}
            onToggleStream={handleToggleStream}
            onToggleInput={handleToggleInput}
            onEmergencyStop={handleEmergencyStop}
            onChangeResolution={setStreamResolution}
          />
        )}

        {activeTab === 'files' && (
          <FilesScreen status={status} agentUrl={agentUrl} />
        )}

        {activeTab === 'apps' && (
          <AppsScreen status={status} agentUrl={agentUrl} />
        )}

        {activeTab === 'system' && (
          <SystemScreen status={status} agentUrl={agentUrl} />
        )}

        {activeTab === 'assistant' && (
          <AssistantScreen status={status} agentUrl={agentUrl} />
        )}
      </View>

      {/* Bottom Android Tab Bar */}
      <View style={styles.bottomTabBar}>
        {navigationTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  screenContainer: {
    flex: 1,
  },
  errorBanner: {
    backgroundColor: '#be123c',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  errorBannerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#0b1329',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#172554',
  },
  tabIcon: {
    fontSize: 14,
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#60a5fa',
  },
});

export default App;
