import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { systemService } from '../services/system';
import type { SystemInfoResponse, ConnectionStatus } from '../types';

interface SystemScreenProps {
  status: ConnectionStatus;
  agentUrl: string;
}

export const SystemScreen: React.FC<SystemScreenProps> = ({ status, agentUrl }) => {
  const [telemetry, setTelemetry] = useState<SystemInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemData = useCallback(async () => {
    if (status !== 'connected') return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await systemService.getTelemetry(agentUrl);
      setTelemetry(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve hardware telemetry');
    } finally {
      setIsLoading(false);
    }
  }, [status, agentUrl]);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  const formatBytes = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>System Telemetry</Text>
          <Text style={styles.subtitle}>
            Live hardware sensors and resource monitoring from host Windows machine.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={fetchSystemData}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {telemetry ? (
        <View style={styles.cardsGrid}>
          {/* CPU Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>⚡ CPU Usage</Text>
              <Text style={styles.cardValue}>{telemetry.cpu.usage_percent}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, telemetry.cpu.usage_percent)}%` },
                ]}
              />
            </View>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {telemetry.cpu.model}
            </Text>
            <Text style={styles.cardSubMeta}>
              {telemetry.cpu.cores_physical} Physical Cores • {telemetry.cpu.cores_logical} Logical Threads
            </Text>
          </View>

          {/* Memory Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🧠 Memory (RAM)</Text>
              <Text style={styles.cardValue}>{telemetry.memory.usage_percent}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, telemetry.memory.usage_percent)}%`,
                    backgroundColor: '#8b5cf6',
                  },
                ]}
              />
            </View>
            <Text style={styles.cardMeta}>
              {formatBytes(telemetry.memory.used_bytes)} used of{' '}
              {formatBytes(telemetry.memory.total_bytes)}
            </Text>
            <Text style={styles.cardSubMeta}>
              {formatBytes(telemetry.memory.available_bytes)} free
            </Text>
          </View>

          {/* Battery Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🔋 Battery Status</Text>
              <Text style={styles.cardValue}>
                {telemetry.battery.percent !== null ? `${telemetry.battery.percent}%` : 'N/A'}
              </Text>
            </View>
            {telemetry.battery.percent !== null && (
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, telemetry.battery.percent)}%`,
                      backgroundColor: '#10b981',
                    },
                  ]}
                />
              </View>
            )}
            <Text style={styles.cardMeta}>
              Power Source:{' '}
              {telemetry.battery.power_plugged ? 'AC Adapter (Plugged In)' : 'On Battery'}
            </Text>
            {telemetry.battery.is_charging && (
              <Text style={styles.cardSubMeta}>⚡ Currently Charging</Text>
            )}
          </View>

          {/* Host OS Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💻 Host Operating System</Text>
            <Text style={styles.hostName}>{telemetry.os.hostname}</Text>
            <Text style={styles.cardMeta}>
              {telemetry.os.system} {telemetry.os.release} ({telemetry.os.architecture})
            </Text>
            <Text style={styles.cardSubMeta}>Kernel: {telemetry.os.version}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {status === 'connected'
              ? 'Loading hardware telemetry...'
              : 'Connect to your Windows laptop to inspect system metrics.'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 11,
    maxWidth: 240,
  },
  refreshBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refreshBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#f43f5e',
    padding: 8,
    borderRadius: 6,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 11,
  },
  cardsGrid: {
    gap: 10,
  },
  card: {
    backgroundColor: '#0b1329',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  cardValue: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#020617',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  cardMeta: {
    color: '#94a3b8',
    fontSize: 11,
  },
  cardSubMeta: {
    color: '#64748b',
    fontSize: 10,
  },
  hostName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
  },
});
