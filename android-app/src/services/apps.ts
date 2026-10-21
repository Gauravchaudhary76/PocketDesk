/**
 * Allowlisted Applications Service for PocketDesk Android
 */

import { apiRequest } from './apiClient';
import type { AppAllowlistResponse, LaunchAppResponse } from '../types';

export class AndroidAppsService {
  /**
   * Fetches the allowlist of installed applications available for launching
   */
  public async getAllowlist(agentUrl: string): Promise<AppAllowlistResponse> {
    return await apiRequest<AppAllowlistResponse>(agentUrl, '/api/apps/allowlist', {
      method: 'GET',
      timeoutMs: 4000,
    });
  }

  /**
   * Launches an approved application by immutable app_id
   */
  public async launchApp(
    agentUrl: string,
    appId: string,
    confirmed = false
  ): Promise<LaunchAppResponse> {
    return await apiRequest<LaunchAppResponse>(agentUrl, '/api/apps/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        confirmed,
      }),
      timeoutMs: 6000,
    });
  }
}

export const androidApps = new AndroidAppsService();
