/**
 * PocketDesk Remote Client Service (Stage 6)
 * Handles client device registration, cryptographic secrets storage,
 * replay protection nonces, short-lived session renewal, and dynamic ICE server retrieval.
 */

import type { IceServerConfig, PairedDeviceItem } from '../types';

export class RemoteClient {
  private static DEVICE_ID_KEY = 'pocketdesk_client_device_id';
  private static DEVICE_SECRET_KEY = 'pocketdesk_client_device_secret';
  private static DEVICE_NAME_KEY = 'pocketdesk_client_device_name';

  /**
   * Get or initialize a persistent unique device identifier for this browser.
   */
  getDeviceId(): string {
    let id = localStorage.getItem(RemoteClient.DEVICE_ID_KEY);
    if (!id) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = `dev_${crypto.randomUUID().replace(/-/g, '')}`;
      } else {
        id = `dev_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;
      }
      localStorage.setItem(RemoteClient.DEVICE_ID_KEY, id);
    }
    return id;
  }

  /**
   * Get saved persistent device secret if already paired.
   */
  getDeviceSecret(): string | null {
    return localStorage.getItem(RemoteClient.DEVICE_SECRET_KEY);
  }

  /**
   * Save device secret upon successful pairing.
   */
  setDeviceSecret(secret: string): void {
    localStorage.setItem(RemoteClient.DEVICE_SECRET_KEY, secret);
  }

  /**
   * Check if this device has been previously paired with a secret.
   */
  isDevicePaired(): boolean {
    return Boolean(this.getDeviceSecret());
  }

  /**
   * Get or set human-readable device name.
   */
  getDeviceName(): string {
    const saved = localStorage.getItem(RemoteClient.DEVICE_NAME_KEY);
    if (saved) return saved;

    const ua = navigator.userAgent;
    let name = 'PocketDesk Client';
    if (/iPhone/i.test(ua)) name = 'iPhone Safari';
    else if (/iPad/i.test(ua)) name = 'iPad';
    else if (/Android/i.test(ua)) name = 'Android Phone';
    else if (/Macintosh/i.test(ua)) name = 'Mac Browser';
    else if (/Windows/i.test(ua)) name = 'Windows Browser';

    localStorage.setItem(RemoteClient.DEVICE_NAME_KEY, name);
    return name;
  }

  setDeviceName(name: string): void {
    localStorage.setItem(RemoteClient.DEVICE_NAME_KEY, name.trim());
  }

  /**
   * Clear device credentials (unpair/reset).
   */
  clearDeviceCredentials(): void {
    localStorage.removeItem(RemoteClient.DEVICE_SECRET_KEY);
  }

  /**
   * Generate fresh timestamp and single-use cryptographic nonce for replay protection.
   */
  generateReplayParams(): { timestamp: number; nonce: string } {
    let nonce: string;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      nonce = crypto.randomUUID().replace(/-/g, '');
    } else {
      nonce = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    }
    return {
      timestamp: Date.now() / 1000,
      nonce,
    };
  }

  /**
   * Pair new client device with Windows laptop agent using 6-digit terminal PIN.
   */
  async pairDevice(
    remoteUrl: string,
    deviceName: string,
    pairingPin: string
  ): Promise<{ sessionToken: string; deviceSecret: string; expiresInSeconds: number }> {
    const deviceId = this.getDeviceId();
    const replay = this.generateReplayParams();

    const res = await fetch(`${remoteUrl}/api/remote/devices/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        device_name: deviceName || this.getDeviceName(),
        pairing_pin: pairingPin.trim(),
        timestamp: replay.timestamp,
        nonce: replay.nonce,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Pairing failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    this.setDeviceSecret(data.device_secret);
    this.setDeviceName(deviceName);

    return {
      sessionToken: data.session_token,
      deviceSecret: data.device_secret,
      expiresInSeconds: data.expires_in_seconds,
    };
  }

  /**
   * Request short-lived session token for an already paired trusted device.
   */
  async createSession(remoteUrl: string): Promise<{ sessionToken: string; expiresInSeconds: number }> {
    const deviceId = this.getDeviceId();
    const secret = this.getDeviceSecret();
    if (!secret) {
      throw new Error('Device is not paired. Please pair with the laptop agent first.');
    }

    const replay = this.generateReplayParams();

    const res = await fetch(`${remoteUrl}/api/remote/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        device_secret: secret,
        timestamp: replay.timestamp,
        nonce: replay.nonce,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.status === 401) {
      // Device secret invalid or device revoked
      this.clearDeviceCredentials();
      throw new Error('Device authorization has been revoked or expired. Please re-pair with laptop.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Session establishment failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      sessionToken: data.session_token,
      expiresInSeconds: data.expires_in_seconds,
    };
  }

  /**
   * Fetch dynamic ICE servers (STUN + time-limited TURN credentials).
   */
  async getIceServers(remoteUrl: string, token: string): Promise<IceServerConfig> {
    const res = await fetch(`${remoteUrl}/api/remote/ice-servers`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Return default public STUN fallback if endpoint fails
      return {
        ice_servers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
        turn_configured: false,
        nat_traversal_mode: 'fallback_stun',
        documentation: 'Default fallback STUN',
      };
    }

    return res.json();
  }

  /**
   * List all authorized devices on laptop agent.
   */
  async listDevices(remoteUrl: string, token: string): Promise<PairedDeviceItem[]> {
    const res = await fetch(`${remoteUrl}/api/remote/devices`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error('Failed to retrieve authorized devices list');
    const data = await res.json();
    return data.devices || [];
  }

  /**
   * Revoke an authorized device on the laptop agent.
   */
  async revokeDevice(remoteUrl: string, token: string, deviceId: string): Promise<boolean> {
    const res = await fetch(`${remoteUrl}/api/remote/devices/${encodeURIComponent(deviceId)}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to revoke device');
    }

    // If revoking current device, clear local secret
    if (deviceId === this.getDeviceId()) {
      this.clearDeviceCredentials();
    }

    return true;
  }
}

export const remoteClient = new RemoteClient();
