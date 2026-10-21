import type { ApprovedRoot, DirectoryListing } from '../types';

export class FileService {
  /**
   * Fetch approved root directories available on host laptop.
   */
  async getRoots(agentUrl: string, token: string): Promise<ApprovedRoot[]> {
    const res = await fetch(`${agentUrl}/api/files/roots`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch approved roots (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data.roots || [];
  }

  /**
   * List files and subdirectories within an approved directory.
   */
  async listFiles(
    agentUrl: string,
    token: string,
    rootId: string,
    relativePath: string = ''
  ): Promise<DirectoryListing> {
    const params = new URLSearchParams({
      root_id: rootId,
      path: relativePath,
    });

    const res = await fetch(`${agentUrl}/api/files/list?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to list directory (HTTP ${res.status})`);
    }

    return res.json();
  }

  /**
   * Download a file from host and trigger a browser download save.
   */
  async downloadFile(
    agentUrl: string,
    token: string,
    rootId: string,
    filePath: string,
    fileName: string
  ): Promise<void> {
    const params = new URLSearchParams({
      root_id: rootId,
      path: filePath,
    });

    const res = await fetch(`${agentUrl}/api/files/download?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to download file (HTTP ${res.status})`);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }

  /**
   * Upload a file with real-time percentage progress tracking via XMLHttpRequest.
   */
  uploadFile(
    agentUrl: string,
    token: string,
    rootId: string,
    folderPath: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{ success: boolean; message: string; path?: string }> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('root_id', rootId);
      formData.append('path', folderPath);
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${agentUrl}/api/files/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            resolve({ success: true, message: 'File uploaded successfully' });
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.detail || `Upload failed with HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with HTTP ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error occurred during file upload.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload timed out.'));
      };

      xhr.timeout = 120000; // 2 minutes
      xhr.send(formData);
    });
  }

  /**
   * Create a new folder within an approved directory.
   */
  async createFolder(
    agentUrl: string,
    token: string,
    rootId: string,
    folderPath: string,
    folderName: string
  ): Promise<{ success: boolean; message: string; path?: string }> {
    const res = await fetch(`${agentUrl}/api/files/mkdir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        root_id: rootId,
        path: folderPath,
        folder_name: folderName,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create folder (HTTP ${res.status})`);
    }

    return res.json();
  }
}

export const fileService = new FileService();
