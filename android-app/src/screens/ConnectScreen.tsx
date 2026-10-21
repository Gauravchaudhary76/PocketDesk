import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { ConnectionStatus, ConnectionMode, RegisteredLaptop } from '../types';

interface ConnectScreenProps {
  status: ConnectionStatus;
  mode: ConnectionMode;
  agentUrl: string;
  registeredLaptops: RegisteredLaptop[];
  isConnecting: boolean;
  errorMessage: string | null;
  onSetAgentUrl: (url: string) => void;
  onSetMode: (mode: ConnectionMode) => void;
  onConnectLocal: (url: string, pin: string) => Promise<void>;
  onConnectRemote: (url: string, pin: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSelectLaptop: (laptop: RegisteredLaptop) => void;
  onRemoveLaptop: (laptopId: string) => void;
}

export const ConnectScreen: React.FC<ConnectScreenProps> = ({
  status,
  mode,
  agentUrl,
  registeredLaptops,
  isConnecting,
  errorMessage,
  onSetAgentUrl,
  onSetMode,
  onConnectLocal,
  onConnectRemote,
  onDisconnect,
  onSelectLaptop,
  onRemoveLaptop,
}) => {
  const [pin, setPin] = useState('');

  const handleConnect = () => {
    if (!pin.trim() || pin.length < 6) return;
    if (mode === 'local') {
      onConnectLocal(agentUrl, pin);
    } else {
      onConnectRemote(agentUrl, pin);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title & Instructions */}
      <View style={styles.section}>
        <Text style={styles.heading}>Connect to Laptop</Text>
        <Text style={styles.subheading}>
          Access your Windows 10/11 desktop over secure local Wi-Fi or encrypted TURN Internet relay.
        </Text>
      </View>

      {/* Registered Laptops Card List (Stage 9 Requirement) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Registered Laptops</Text>
        {registeredLaptops.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No laptops paired yet. Pair with your Windows agent below.
            </Text>
          </View>
        ) : (
          registeredLaptops.map((laptop) => {
            const isCurrent = laptop.agentUrl === agentUrl;
            return (
              <View
                key={laptop.id}
                style={[styles.laptopCard, isCurrent && styles.laptopCardActive]}
              >
                <TouchableOpacity
                  style={styles.laptopInfo}
                  onPress={() => onSelectLaptop(laptop)}
                >
                  <Text style={styles.laptopName}>{laptop.name}</Text>
                  <Text style={styles.laptopUrl} numberOfLines={1}>
                    {laptop.agentUrl} • {laptop.mode === 'remote' ? 'Internet' : 'Local LAN'}
                  </Text>
                  {laptop.lastConnected && (
                    <Text style={styles.laptopLastSeen}>
                      Last connected: {new Date(laptop.lastConnected).toLocaleDateString()}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.laptopActions}>
                  {isCurrent && status === 'connected' ? (
                    <View style={styles.connectedBadge}>
                      <Text style={styles.connectedBadgeText}>Active</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.selectBtn}
                      onPress={() => onSelectLaptop(laptop)}
                    >
                      <Text style={styles.selectBtnText}>Select</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => onRemoveLaptop(laptop.id)}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Mode Switcher */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Mode</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'local' && styles.modeBtnActive]}
            onPress={() => onSetMode('local')}
          >
            <Text style={[styles.modeBtnText, mode === 'local' && styles.modeBtnTextActive]}>
              📶 Local Wi-Fi (LAN)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'remote' && styles.modeBtnActive]}
            onPress={() => onSetMode('remote')}
          >
            <Text style={[styles.modeBtnText, mode === 'remote' && styles.modeBtnTextActive]}>
              🌐 Remote (NAT/TURN)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Connection Form */}
      <View style={styles.section}>
        <Text style={styles.inputLabel}>Laptop Agent Address</Text>
        <TextInput
          style={styles.textInput}
          value={agentUrl}
          onChangeText={onSetAgentUrl}
          placeholder="http://192.168.1.145:8000"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={styles.inputLabel}>
          {mode === 'local' ? '6-Digit Terminal Pairing PIN' : 'Device Registration PIN'}
        </Text>
        <TextInput
          style={[styles.textInput, styles.pinInput]}
          value={pin}
          onChangeText={setPin}
          placeholder="123456"
          placeholderTextColor="#475569"
          keyboardType="number-pad"
          maxLength={6}
        />

        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          {status === 'connected' ? (
            <TouchableOpacity
              style={styles.disconnectBtn}
              onPress={onDisconnect}
              disabled={isConnecting}
            >
              <Text style={styles.disconnectBtnText}>Disconnect from Laptop</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.connectBtn,
                (!pin.trim() || pin.length < 6 || isConnecting) && styles.connectBtnDisabled,
              ]}
              onPress={handleConnect}
              disabled={!pin.trim() || pin.length < 6 || isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.connectBtnText}>
                  {mode === 'local' ? 'Authenticate & Connect' : 'Register & Connect'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Android Security Notice */}
      <View style={styles.securityNotice}>
        <Text style={styles.securityTitle}>🔒 Android Security Architecture</Text>
        <Text style={styles.securityBody}>
          • Credentials are encrypted using Android KeyStore hardware-backed AES-256.{'\n'}
          • Device pairing requires explicit physical terminal authorization on your laptop.{'\n'}
          • 1-hour short-lived tokens prevent session persistence attacks.{'\n'}
          • Backgrounding pauses video streaming and emergency-stops active inputs.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  heading: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  subheading: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyCard: {
    backgroundColor: '#0b1329',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  laptopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0b1329',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 8,
  },
  laptopCardActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#0d1d3d',
  },
  laptopInfo: {
    flex: 1,
    gap: 2,
  },
  laptopName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  laptopUrl: {
    color: '#94a3b8',
    fontSize: 11,
  },
  laptopLastSeen: {
    color: '#64748b',
    fontSize: 10,
  },
  laptopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  connectedBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },
  selectBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  selectBtnText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 6,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 14,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: '#0b1329',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  modeBtnActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#172554',
  },
  modeBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#60a5fa',
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#0b1329',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  pinInput: {
    letterSpacing: 8,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#f43f5e',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 11,
  },
  buttonRow: {
    marginTop: 8,
  },
  connectBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnDisabled: {
    opacity: 0.5,
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  disconnectBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  disconnectBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  securityNotice: {
    backgroundColor: '#0b1329',
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  securityTitle: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  securityBody: {
    color: '#94a3b8',
    fontSize: 10,
    lineHeight: 16,
  },
});
