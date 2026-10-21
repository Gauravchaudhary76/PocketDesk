import type { AllowlistedApp, LaunchAppResult } from '../types';

export class AppService {
  /**
   * Fetch approved allowlisted applications from the laptop agent.
   */
  async getAllowlist(agentUrl: string, token: string): Promise<AllowlistedApp[]> {
    const res = await fetch(`${agentUrl}/api/apps/allowlist`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch application allowlist (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data.apps || [];
  }

  /**
   * Launch an allowlisted application by ID.
   */
  async launchApp(
    agentUrl: string,
    token: string,
    appId: string,
    confirmed: boolean = false
  ): Promise<LaunchAppResult> {
    const res = await fetch(`${agentUrl}/api/apps/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        app_id: appId,
        confirmed,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to launch application (HTTP ${res.status})`);
    }

    return res.json();
  }
}

export const appService = new AppService();
