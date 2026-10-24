import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderUp,
  Folder,
  FolderPlus,
  FileText,
  FileCode,
  FileImage,
  FileArchive,
  File,
  Download,
  Upload,
  RefreshCw,
  ArrowUp,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import type { ApprovedRoot, DirectoryListing, FileItem, UploadProgress } from '../types';
import { fileService } from '../services/files';
import { StageBadge } from './StageBadge';

interface FileTransferSectionProps {
  agentUrl: string;
  token: string | null;
  isConnected: boolean;
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
}

export const FileTransferSection: React.FC<FileTransferSectionProps> = ({
  agentUrl,
  token,
  isConnected,
  onOpenInfo,
}) => {
  const [roots, setRoots] = useState<ApprovedRoot[]>([]);
  const [activeRootId, setActiveRootId] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New folder dialog
  const [isNewFolderOpen, setIsNewFolderOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);

  // Upload status
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch approved roots on connection
  const loadRoots = useCallback(async () => {
    if (!isConnected || !token || !agentUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const fetchedRoots = await fileService.getRoots(agentUrl, token);
      setRoots(fetchedRoots);
      if (fetchedRoots.length > 0 && (!activeRootId || !fetchedRoots.some((r) => r.id === activeRootId))) {
        setActiveRootId(fetchedRoots[0].id);
        setCurrentPath('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load approved roots';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, token, agentUrl, activeRootId]);

  // Load directory contents
  const loadDirectory = useCallback(
    async (rootId: string, path: string = '') => {
      if (!isConnected || !token || !agentUrl || !rootId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await fileService.listFiles(agentUrl, token, rootId, path);
        setListing(data);
        setCurrentPath(data.current_path);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to list directory contents';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [isConnected, token, agentUrl]
  );

  useEffect(() => {
    if (isConnected && token) {
      loadRoots();
    } else {
      setRoots([]);
      setListing(null);
      setActiveRootId('');
      setCurrentPath('');
    }
  }, [isConnected, token, loadRoots]);

  useEffect(() => {
    if (activeRootId && isConnected && token) {
      loadDirectory(activeRootId, currentPath);
    }
  }, [activeRootId, currentPath, isConnected, token, loadDirectory]);

  // Navigate into subfolder
  const handleOpenFolder = (folderName: string) => {
    const nextPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(nextPath);
  };

  // Navigate to parent folder
  const handleNavigateUp = () => {
    if (listing?.parent_path !== null && listing?.parent_path !== undefined) {
      setCurrentPath(listing.parent_path);
    }
  };

  // Navigate via breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath('');
      return;
    }
    const parts = currentPath.split('/');
    const nextPath = parts.slice(0, index + 1).join('/');
    setCurrentPath(nextPath);
  };

  // Download a file
  const handleDownload = async (fileItem: FileItem) => {
    if (!token || !agentUrl || !activeRootId) return;
    try {
      await fileService.downloadFile(agentUrl, token, activeRootId, fileItem.path, fileItem.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      alert(msg);
    }
  };

  // Handle file upload
  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !token || !agentUrl || !activeRootId) return;
    const file = files[0];

    setUploadProgress({
      fileName: file.name,
      progressPercent: 0,
      status: 'uploading',
    });

    try {
      await fileService.uploadFile(
        agentUrl,
        token,
        activeRootId,
        currentPath,
        file,
        (percent) => {
          setUploadProgress({
            fileName: file.name,
            progressPercent: percent,
            status: 'uploading',
          });
        }
      );

      setUploadProgress({
        fileName: file.name,
        progressPercent: 100,
        status: 'completed',
      });

      // Refresh directory listing
      await loadDirectory(activeRootId, currentPath);

      setTimeout(() => {
        setUploadProgress(null);
      }, 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadProgress({
        fileName: file.name,
        progressPercent: 0,
        status: 'error',
        errorMessage: msg,
      });
    }
  };

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !agentUrl || !activeRootId || !newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      await fileService.createFolder(
        agentUrl,
        token,
        activeRootId,
        currentPath,
        newFolderName.trim()
      );
      setNewFolderName('');
      setIsNewFolderOpen(false);
      await loadDirectory(activeRootId, currentPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create folder';
      alert(msg);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  };

  const getFileIcon = (ext: string) => {
    const e = ext.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(e)) {
      return <FileImage className="w-4 h-4 text-emerald-400" />;
    }
    if (['txt', 'md', 'pdf', 'doc', 'docx', 'rtf'].includes(e)) {
      return <FileText className="w-4 h-4 text-blue-400" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) {
      return <FileArchive className="w-4 h-4 text-amber-400" />;
    }
    if (['py', 'js', 'ts', 'html', 'css', 'json', 'yaml', 'xml'].includes(e)) {
      return <FileCode className="w-4 h-4 text-cyan-400" />;
    }
    return <File className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-950/70 border border-indigo-800/60 text-indigo-400">
            <FolderUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Restricted File Manager</h3>
            <p className="text-xs text-slate-400">
              Browse, upload, and download files within approved laptop directories
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StageBadge stage={7} label="Sandboxed Storage" variant="filled" />
          <button
            type="button"
            onClick={() =>
              onOpenInfo(
                7,
                'Stage 7 File Security & Access Model',
                'PocketDesk enforces strict file access boundaries to protect your Windows host.',
                [
                  'Approved Roots Only: Access is strictly confined to predefined user folders (Downloads, Documents, Desktop, Pictures).',
                  'Path Traversal Defense: All paths are canonicalized; directory escape attempts (../) are rejected with HTTP 403.',
                  'Symlink Escape Prevention: Symbolic links resolving outside approved roots are blocked.',
                  'Sensitive File Filtering: System files, credentials (.ssh, .env, id_rsa), and browser profiles (AppData) are blacklisted.',
                  'Upload Size Limit: Enforces a 50 MB per-file upload cap with automatic partial-file purge on violation.',
                ]
              )
            }
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="View File Security Specs"
          >
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
          </button>
        </div>
      </div>

      {!isConnected ? (
        <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
          <Folder className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-xs font-medium text-slate-300">Agent Disconnected</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Pair with your Windows laptop to securely browse, download, and upload files to approved folders.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Approved Roots Tabs */}
          {roots.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0 mr-1">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                Root:
              </span>
              {roots.map((root) => (
                <button
                  key={root.id}
                  type="button"
                  onClick={() => {
                    setActiveRootId(root.id);
                    setCurrentPath('');
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeRootId === root.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <Folder className="w-3 h-3" />
                  <span>{root.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Navigation & Action Bar */}
          <div className="flex items-center justify-between gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 px-1 flex-1">
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(-1)}
                className="text-slate-400 hover:text-white font-medium hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Folder className="w-3.5 h-3.5 text-indigo-400" />
                <span>{roots.find((r) => r.id === activeRootId)?.name || 'Root'}</span>
              </button>

              {currentPath &&
                currentPath.split('/').map((seg, idx) => (
                  <React.Fragment key={idx}>
                    <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                    <button
                      type="button"
                      onClick={() => handleBreadcrumbClick(idx)}
                      className="text-slate-300 hover:text-white font-medium hover:underline truncate max-w-[120px] cursor-pointer"
                    >
                      {seg}
                    </button>
                  </React.Fragment>
                ))}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {currentPath && (
                <button
                  type="button"
                  onClick={handleNavigateUp}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                  title="Up one folder"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => loadDirectory(activeRootId, currentPath)}
                disabled={isLoading}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh folder"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsNewFolderOpen(true)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                title="Create new folder"
              >
                <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors cursor-pointer text-xs"
                title="Upload file to this folder"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  handleUploadFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {/* New Folder Inline Form */}
          {isNewFolderOpen && (
            <form onSubmit={handleCreateFolder} className="p-3 bg-slate-950 rounded-xl border border-indigo-900/50 space-y-2 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                  Create New Folder in {currentPath || 'Root'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsNewFolderOpen(false)}
                  className="text-slate-400 hover:text-white text-[11px]"
                >
                  Cancel
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder Name (e.g. Project_Drafts)"
                  disabled={isCreatingFolder}
                  autoFocus
                  maxLength={100}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  {isCreatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Create</span>
                </button>
              </div>
            </form>
          )}

          {/* Upload Progress Indicator */}
          {uploadProgress && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-200 truncate max-w-[200px]">
                  {uploadProgress.fileName}
                </span>
                <span className="text-slate-400 font-mono">
                  {uploadProgress.status === 'uploading' && `${uploadProgress.progressPercent}%`}
                  {uploadProgress.status === 'completed' && <span className="text-emerald-400 font-semibold">Upload Complete</span>}
                  {uploadProgress.status === 'error' && <span className="text-rose-400 font-semibold">Upload Failed</span>}
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    uploadProgress.status === 'error'
                      ? 'bg-rose-500'
                      : uploadProgress.status === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-indigo-500'
                  }`}
                  style={{ width: `${uploadProgress.progressPercent}%` }}
                />
              </div>
              {uploadProgress.errorMessage && (
                <p className="text-[10px] text-rose-400 mt-1">{uploadProgress.errorMessage}</p>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Access Restricted</span>
                <p className="text-[11px] text-rose-300/90">{error}</p>
              </div>
            </div>
          )}

          {/* Directory Items List */}
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
            {isLoading && !listing ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Loading directory...</span>
              </div>
            ) : listing && listing.items.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                This directory is empty.
              </div>
            ) : (
              listing?.items.map((item) => (
                <div
                  key={item.path}
                  className="flex items-center justify-between p-2.5 hover:bg-slate-900/60 transition-colors text-xs group"
                >
                  <div
                    onClick={() => (item.is_dir ? handleOpenFolder(item.name) : handleDownload(item))}
                    className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="shrink-0">
                      {item.is_dir ? (
                        <Folder className="w-4 h-4 text-amber-400" />
                      ) : (
                        getFileIcon(item.extension)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {item.is_dir ? 'Directory' : formatFileSize(item.size_bytes)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {!item.is_dir && (
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-indigo-600 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Download to phone"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
