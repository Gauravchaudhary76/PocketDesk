/**
 * Restricted File Management Service for PocketDesk Android
 *
 * Implements:
 * 1. Approved root browsing (Downloads, Documents, Desktop, Pictures)
 * 2. Directory listing with path canonicalization
 * 3. File downloading to Android storage
 * 4. Chunked file uploading with 50 MB size limit enforcement
 * 5. Folder creation with Windows filename sanitization
 */

import { apiRequest, ApiError } from './apiClient';
import { secureStorage } from './secureStorage';
import type { ApprovedRootsResponse, DirectoryListingResponse } from '../types';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export class AndroidFilesService {
  /**
   * Fetches approved filesystem roots on the Windows laptop
   */
  public async getApprovedRoots(agentUrl: string): Promise<ApprovedRootsResponse> {
    return await apiRequest<ApprovedRootsResponse>(agentUrl, '/api/files/roots', {
      method: 'GET',
      timeoutMs: 5000,
    });
  }

  /**
   * Lists directory contents inside an approved root
   */
  public async listDirectory(
    agentUrl: string,
    rootId: string,
    relativePath = ''
  ): Promise<DirectoryListingResponse> {
    const query = new URLSearchParams({
      root_id: rootId,
      path: relativePath,
    }).toString();

    return await apiRequest<DirectoryListingResponse>(agentUrl, `/api/files/list?${query}`, {
      method: 'GET',
      timeoutMs: 7000,
    });
  }

  /**
   * Uploads a file to an approved directory on the Windows laptop
   */
  public async uploadFile(
    agentUrl: string,
    rootId: string,
    relativePath: string,
    file: { name: string; size: number; uri: string; type?: string }
  ): Promise<{ success: boolean; message: string; filename: string }> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 50 MB maximum upload limit.`,
        413
      );
    }

    const token = await secureStorage.getSessionToken();
    const formData = new FormData();
    formData.append('root_id', rootId);
    formData.append('path', relativePath);
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type || 'application/octet-stream',
    } as unknown as Blob);

    const targetUrl = `${agentUrl.replace(/\/+$/, '')}/api/files/upload`;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      let msg = `Upload failed with HTTP ${response.status}`;
      try {
        const json = await response.json();
        if (json.detail) msg = json.detail;
      } catch {
        // ignore
      }
      throw new ApiError(msg, response.status);
    }

    return await response.json();
  }

  /**
   * Creates a new subdirectory in an approved root
   */
  public async createDirectory(
    agentUrl: string,
    rootId: string,
    parentPath: string,
    folderName: string
  ): Promise<{ success: boolean; message: string }> {
    return await apiRequest(agentUrl, '/api/files/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        root_id: rootId,
        path: parentPath,
        name: folderName.trim(),
      }),
      timeoutMs: 5000,
    });
  }

  /**
   * Construct download URL for direct Android DownloadManager or browser download
   */
  public getDownloadUrl(agentUrl: string, rootId: string, relativePath: string): string {
    const query = new URLSearchParams({
      root_id: rootId,
      path: relativePath,
    }).toString();
    return `${agentUrl.replace(/\/+$/, '')}/api/files/download?${query}`;
  }
}

export const androidFiles = new AndroidFilesService();
