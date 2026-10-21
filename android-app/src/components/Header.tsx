import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ConnectionStatus, ConnectionMode, SystemInfoResponse } from '../types';

interface HeaderProps {
  status: ConnectionStatus;
  connectionMode: ConnectionMode;
  systemInfo: SystemInfoResponse | null;
  onOpenConnect: () => void;
  onEmergencyStop?: () => void;
  isInputActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  connectionMode,
  systemInfo,
  onOpenConnect,
  onEmergencyStop,
  isInputActive,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#10b981'; // emerald
      case 'connecting':
        return '#06b6d4'; // cyan
      case 'error':
        return '#f43f5e'; // rose
      default:
        return '#64748b'; // slate
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <TouchableOpacity style={styles.titleContainer} onPress={onOpenConnect}>
          <Text style={styles.brandTitle}>PocketDesk</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Android • v0.9.0</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.statusGroup}>
          {/* Emergency Stop Button if input active */}
          {isInputActive && onEmergencyStop && (
            <TouchableOpacity
              style={styles.emergencyBtn}
              onPress={onEmergencyStop}
              activeOpacity={0.7}
            >
              <Text style={styles.emergencyText}>STOP INPUT</Text>
            </TouchableOpacity>
          )}

          {/* Connection Mode Pill */}
          <View style={styles.modePill}>
            <Text style={styles.modeText}>
              {connectionMode === 'remote' ? 'NAT/TURN' : 'Wi-Fi'}
            </Text>
          </View>

          {/* Connection Status Pill */}
          <TouchableOpacity
            style={[styles.statusPill, { borderColor: getStatusColor() }]}
            onPress={onOpenConnect}
          >
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {status.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Host Telemetry Bar when connected */}
      {status === 'connected' && systemInfo && (
        <View style={styles.telemetryBar}>
          <Text style={styles.telemetryItem} numberOfLines={1}>
            💻 {systemInfo.os.hostname} ({systemInfo.os.system})
          </Text>
          <Text style={styles.telemetryItem}>
            ⚡ CPU {systemInfo.cpu.usage_percent}%
          </Text>
          <Text style={styles.telemetryItem}>
            🧠 RAM {systemInfo.memory.usage_percent}%
          </Text>
          {systemInfo.battery.percent !== null && (
            <Text style={styles.telemetryItem}>
              🔋 {systemInfo.battery.percent}%{systemInfo.battery.is_charging ? ' ⚡' : ''}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#020617',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  versionBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  versionText: {
    color: '#60a5fa',
    fontSize: 9,
    fontWeight: '600',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emergencyBtn: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emergencyText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  modePill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  telemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    marginTop: 6,
  },
  telemetryItem: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
  },
});
