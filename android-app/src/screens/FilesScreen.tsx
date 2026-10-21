import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { androidFiles } from '../services/files';
import type { ApprovedRoot, FileItem, ConnectionStatus } from '../types';

interface FilesScreenProps {
  status: ConnectionStatus;
  agentUrl: string;
}

export const FilesScreen: React.FC<FilesScreenProps> = ({ status, agentUrl }) => {
  const [roots, setRoots] = useState<ApprovedRoot[]>([]);
  const [activeRootId, setActiveRootId] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New folder modal
  const [showMkdirModal, setShowMkdirModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');

  const loadRoots = useCallback(async () => {
    if (status !== 'connected') return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await androidFiles.getApprovedRoots(agentUrl);
      setRoots(res.roots);
      if (res.roots.length > 0) {
        const defaultRoot = res.roots.find((r) => r.is_default) || res.roots[0];
        setActiveRootId(defaultRoot.id);
        setCurrentPath('');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load approved roots');
    } finally {
      setIsLoading(false);
    }
  }, [status, agentUrl]);

  const loadDirectory = useCallback(
    async (rootId: string, path: string) => {
      if (status !== 'connected' || !rootId) return;
      try {
        setIsLoading(true);
        setError(null);
        const res = await androidFiles.listDirectory(agentUrl, rootId, path);
        setItems(res.items);
        setCurrentPath(res.relative_path);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load directory');
      } finally {
        setIsLoading(false);
      }
    },
    [status, agentUrl]
  );

  useEffect(() => {
    loadRoots();
  }, [loadRoots]);

  useEffect(() => {
    if (activeRootId) {
      loadDirectory(activeRootId, currentPath);
    }
  }, [activeRootId, loadDirectory]);

  const handleNavigateUp = () => {
    if (!currentPath) return;
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop();
    const newPath = segments.join('/');
    loadDirectory(activeRootId, newPath);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await androidFiles.createDirectory(agentUrl, activeRootId, currentPath, newFolderName);
      setShowMkdirModal(false);
      setNewFolderName('');
      loadDirectory(activeRootId, currentPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <View style={styles.container}>
      {/* Approved Roots Horizontal Tabs */}
      <View style={styles.rootsTabBar}>
        {roots.map((root) => {
          const isActive = root.id === activeRootId;
          return (
            <TouchableOpacity
              key={root.id}
              style={[styles.rootTab, isActive && styles.rootTabActive]}
              onPress={() => {
                setActiveRootId(root.id);
                setCurrentPath('');
              }}
            >
              <Text style={[styles.rootTabText, isActive && styles.rootTabTextActive]}>
                {root.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Breadcrumb Path Bar */}
      <View style={styles.breadcrumbBar}>
        <TouchableOpacity
          style={[styles.upBtn, !currentPath && styles.upBtnDisabled]}
          onPress={handleNavigateUp}
          disabled={!currentPath}
        >
          <Text style={styles.upBtnText}>⬆ ..</Text>
        </TouchableOpacity>
        <Text style={styles.pathText} numberOfLines={1}>
          /{currentPath || ''}
        </Text>
        <TouchableOpacity
          style={styles.newFolderBtn}
          onPress={() => setShowMkdirModal(true)}
        >
          <Text style={styles.newFolderText}>+ Folder</Text>
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* File & Folder List */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={styles.loadingText}>Loading files from laptop...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.path}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>This folder is empty.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.fileItemRow}
              onPress={() => {
                if (item.is_directory) {
                  const nextPath = currentPath
                    ? `${currentPath}/${item.name}`
                    : item.name;
                  loadDirectory(activeRootId, nextPath);
                }
              }}
            >
              <Text style={styles.fileIcon}>
                {item.is_directory ? '📁' : '📄'}
              </Text>
              <View style={styles.fileDetails}>
                <Text style={styles.fileName}>{item.name}</Text>
                <Text style={styles.fileMeta}>
                  {item.is_directory ? 'Folder' : formatFileSize(item.size_bytes)} •{' '}
                  {new Date(item.modified_at).toLocaleDateString()}
                </Text>
              </View>
              {!item.is_directory && (
                <Text style={styles.downloadBadge}>Download</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create Folder Modal */}
      <Modal visible={showMkdirModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Folder</Text>
            <TextInput
              style={styles.modalInput}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Folder name"
              placeholderTextColor="#475569"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowMkdirModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCreateBtn}
                onPress={handleCreateFolder}
              >
                <Text style={styles.modalCreateText}>Create</Text>
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
  rootsTabBar: {
    flexDirection: 'row',
    backgroundColor: '#0b1329',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 6,
  },
  rootTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  rootTabActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#172554',
  },
  rootTabText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  rootTabTextActive: {
    color: '#60a5fa',
  },
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#070d1e',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 8,
  },
  upBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  upBtnDisabled: {
    opacity: 0.3,
  },
  upBtnText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
  },
  pathText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  newFolderBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newFolderText: {
    color: '#ffffff',
    fontSize: 10,
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
    padding: 8,
    gap: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
  },
  fileItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1329',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 10,
  },
  fileIcon: {
    fontSize: 20,
  },
  fileDetails: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  fileMeta: {
    color: '#64748b',
    fontSize: 10,
  },
  downloadBadge: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
    maxWidth: 300,
    width: '100%',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 12,
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
  modalCreateBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalCreateText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
