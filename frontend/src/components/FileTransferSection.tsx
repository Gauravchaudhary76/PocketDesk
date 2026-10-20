import React from 'react';
import {
  FolderUp,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  FolderOpen
} from 'lucide-react';
import { StageBadge } from './StageBadge';
import type { TransferFile } from '../types';

interface FileTransferSectionProps {
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
}

export const FileTransferSection: React.FC<FileTransferSectionProps> = ({
  onOpenInfo,
}) => {
  const handleTransferClick = (actionName: string, details: string[]) => {
    onOpenInfo(
      5,
      `${actionName} (File Transfer Engine)`,
      `File transfer between your phone and your Windows 11 laptop will be implemented in Stage 5.`,
      details
    );
  };

  // Sample planned mock items for UI presentation
  const stagedFiles: TransferFile[] = [
    {
      id: '1',
      name: 'Meeting_Notes_Quarterly.pdf',
      sizeBytes: 2450000,
      type: 'download',
      status: 'completed',
      progressPercent: 100,
      timestamp: 'Today, 10:45 AM',
    },
    {
      id: '2',
      name: 'Mobile_Photo_Capture.jpg',
      sizeBytes: 4120000,
      type: 'upload',
      status: 'queued',
      progressPercent: 0,
      timestamp: 'Today, 11:02 AM',
    },
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-950/70 border border-indigo-800/60 text-indigo-400">
            <FolderUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">File Transfer</h3>
            <p className="text-xs text-slate-400">
              Bidirectional file transfer between phone and Windows file system
            </p>
          </div>
        </div>
        <StageBadge stage={5} label="Stage 5 Feature" variant="filled" />
      </div>

      {/* Drag & Drop File Zone */}
      <div
        onClick={() =>
          handleTransferClick('Upload File to Laptop', [
            'Chunked 64KB binary transfer over authenticated WebSocket / HTTP pipeline',
            'SHA-256 integrity checksum verification before and after transmission',
            'Destination directory: C:\\Users\\<user>\\Downloads by default',
            'Real-time transfer progress bar with resume capability'
          ])
        }
        className="relative border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
        role="button"
        tabIndex={0}
        aria-label="Upload File Dropzone (Disabled in Stage 1)"
      >
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors mb-3">
          <Upload className="w-6 h-6" />
        </div>
        <p className="text-xs font-medium text-slate-200">
          Drop files here or click to browse (Stage 5)
        </p>
        <p className="text-[11px] text-slate-400 max-w-sm mt-1">
          Send photos, documents, and archives directly to your Windows 11 laptop storage securely.
        </p>

        <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400">
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
          Target: Windows Downloads Folder
        </span>
      </div>

      {/* Planned Transfers Queue Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-medium text-slate-300">
            Transfer Queue & History (Preview)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Stage 5 UI Mockup</span>
        </div>

        <div className="space-y-2">
          {stagedFiles.map((file) => (
            <div
              key={file.id}
              className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="font-medium text-slate-200 truncate">{file.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {formatFileSize(file.sizeBytes)} • {file.timestamp}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {file.status === 'completed' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
                    <CheckCircle2 className="w-3 h-3" />
                    Sent
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/30">
                    <Clock className="w-3 h-3" />
                    Pending (Stage 5)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
