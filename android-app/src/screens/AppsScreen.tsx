import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { androidApps } from '../services/apps';
import type { AppInfo, ConnectionStatus } from '../types';

interface AppsScreenProps {
  status: ConnectionStatus;
  agentUrl: string;
}

export const AppsScreen: React.FC<AppsScreenProps> = ({ status, agentUrl }) => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [launchingAppId, setLaunchingAppId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Disruptive confirmation dialog
  const [pendingApp, setPendingApp] = useState<AppInfo | null>(null);

  const loadApps = useCallback(async () => {
    if (status !== 'connected') return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await androidApps.getAllowlist(agentUrl);
      setApps(res.applications);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch application allowlist');
    } finally {
      setIsLoading(false);
    }
  }, [status, agentUrl]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const executeLaunch = async (app: AppInfo, confirmed = false) => {
    try {
      setLaunchingAppId(app.app_id);
      setError(null);
      setFeedback(null);
      const res = await androidApps.launchApp(agentUrl, app.app_id, confirmed);
      setFeedback(`Launched ${app.name} (PID: ${res.pid ?? 'Active'})`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Application launch failed');
    } finally {
      setLaunchingAppId(null);
      setPendingApp(null);
    }
  };

  const handleLaunchClick = (app: AppInfo) => {
    if (app.is_disruptive) {
      setPendingApp(app);
    } else {
      executeLaunch(app, false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Application Launcher</Text>
        <Text style={styles.headerSub}>
          Launch allowlisted Windows applications with predefined paths. Zero arbitrary shell commands.
        </Text>
      </View>

      {feedback && (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>✓ {feedback}</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={styles.loadingText}>Fetching allowed applications...</Text>
        </View>
      ) : (
        <FlatList
          data={apps}
          keyExtractor={(item) => item.app_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.appCard}>
              <View style={styles.appIconWrapper}>
                <Text style={styles.appIcon}>
                  {item.icon === 'calculator'
                    ? '🧮'
                    : item.icon === 'file-text'
                    ? '📝'
                    : item.icon === 'terminal'
                    ? '💻'
                    : item.icon === 'activity'
                    ? '📊'
                    : item.icon === 'globe'
                    ? '🌐'
                    : item.icon === 'code'
                    ? '⚡'
                    : '🖥️'}
                </Text>
              </View>

              <View style={styles.appDetails}>
                <View style={styles.appNameRow}>
                  <Text style={styles.appName}>{item.name}</Text>
                  {item.is_disruptive && (
                    <View style={styles.disruptiveBadge}>
                      <Text style={styles.disruptiveBadgeText}>Admin/System</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.appDesc}>{item.description}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.launchBtn,
                  launchingAppId === item.app_id && styles.launchBtnActive,
                ]}
                onPress={() => handleLaunchClick(item)}
                disabled={launchingAppId !== null}
              >
                {launchingAppId === item.app_id ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.launchBtnText}>Launch</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Confirmation Modal for Disruptive Apps */}
      <Modal visible={pendingApp !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚠️ Confirm Application Launch</Text>
            <Text style={styles.modalBody}>
              {pendingApp?.name} is a system or administrative utility that can alter system state.
              {'\n\n'}
              Are you sure you want to launch it on your Windows laptop?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPendingApp(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => pendingApp && executeLaunch(pendingApp, true)}
              >
                <Text style={styles.modalConfirmText}>Confirm & Launch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    padding: 14,
    backgroundColor: '#0b1329',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  headerSub: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
  },
  feedbackBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    padding: 8,
    margin: 8,
    borderRadius: 6,
  },
  feedbackText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#f43f5e',
    padding: 8,
    margin: 8,
    borderRadius: 6,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 11,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 12,
  },
  listContent: {
    padding: 10,
    gap: 8,
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1329',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 12,
  },
  appIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#172554',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    fontSize: 18,
  },
  appDetails: {
    flex: 1,
    gap: 2,
  },
  appNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  disruptiveBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  disruptiveBadgeText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '600',
  },
  appDesc: {
    color: '#64748b',
    fontSize: 11,
  },
  launchBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  launchBtnActive: {
    backgroundColor: '#1d4ed8',
  },
  launchBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0b1329',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    maxWidth: 320,
    width: '100%',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBody: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalCancelText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  modalConfirmBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
