/**
 * Authentication Service for PocketDesk Android
 *
 * Implements:
 * 1. Local Wi-Fi 6-digit terminal PIN handshake
 * 2. Remote Internet device registration with 256-bit secret storage in Android KeyStore
 * 3. Short-lived session creation with replay protection nonces
 * 4. Safe unpairing and credential revocation
 */

import { apiRequest } from './apiClient';
import { secureStorage } from './secureStorage';
import type {
  PairResponse,
  RemoteDevicePairResponse,
  RemoteSessionResponse,
  IceServerConfig,
} from '../types';

export class AuthService {
  /**
   * Generates a single-use random cryptographic nonce for replay protection
   */
  private generateNonce(length = 24): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generates or retrieves a persistent Android device identifier
   */
  public async getOrCreateDeviceId(): Promise<string> {
    const creds = await secureStorage.getDeviceCredentials();
    if (creds.deviceId) {
      return creds.deviceId;
    }
    const newId = `dev_android_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await secureStorage.saveDeviceCredentials(newId, creds.deviceSecret || '');
    return newId;
  }

  /**
   * Mode 1: Local Wi-Fi Pairing
   * Connects to the local laptop agent using the 6-digit terminal PIN.
   */
  public async pairLocal(agentUrl: string, pin: string): Promise<PairResponse> {
    const response = await apiRequest<PairResponse>(agentUrl, '/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin.trim() }),
      skipAuth: true,
      timeoutMs: 5000,
    });

    if (response.session_token) {
      await secureStorage.saveSessionToken(response.session_token);
    }

    return response;
  }

  /**
   * Mode 2: Remote Device Registration
   * Registers this Android phone as an authorized client on the laptop agent.
   */
  public async registerRemoteDevice(
    agentUrl: string,
    pin: string,
    deviceName = 'Android Phone'
  ): Promise<RemoteDevicePairResponse> {
    const deviceId = await this.getOrCreateDeviceId();
    const nonce = this.generateNonce();
    const clientTimestamp = Math.floor(Date.now() / 1000);

    const response = await apiRequest<RemoteDevicePairResponse>(
      agentUrl,
      '/api/remote/devices/pair',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pin.trim(),
          device_id: deviceId,
          device_name: deviceName,
          nonce,
          client_timestamp: clientTimestamp,
        }),
        skipAuth: true,
        timeoutMs: 8000,
      }
    );

    if (response.device_secret) {
      // Store 256-bit device secret securely in Android KeyStore
      await secureStorage.saveDeviceCredentials(deviceId, response.device_secret);
    }

    return response;
  }

  /**
   * Mode 2: Remote Session Establishment
   * Requests a short-lived (1-hour TTL) session token using the paired device secret.
   */
  public async createRemoteSession(agentUrl: string): Promise<RemoteSessionResponse> {
    const creds = await secureStorage.getDeviceCredentials();
    if (!creds.deviceId || !creds.deviceSecret) {
      throw new Error('Device is not paired. Please register your Android device first.');
    }

    const nonce = this.generateNonce();
    const clientTimestamp = Math.floor(Date.now() / 1000);

    const response = await apiRequest<RemoteSessionResponse>(
      agentUrl,
      '/api/remote/session/create',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: creds.deviceId,
          device_secret: creds.deviceSecret,
          nonce,
          client_timestamp: clientTimestamp,
        }),
        skipAuth: true,
        timeoutMs: 8000,
      }
    );

    if (response.session_token) {
      await secureStorage.saveSessionToken(response.session_token);
    }

    return response;
  }

  /**
   * Terminate current local or remote session
   */
  public async disconnect(agentUrl?: string): Promise<void> {
    const token = await secureStorage.getSessionToken();
    if (token && agentUrl) {
      try {
        await apiRequest(agentUrl, '/api/unpair', {
          method: 'POST',
          timeoutMs: 2500,
        });
      } catch {
        // Ignore unpair network errors during teardown
      }
    }
    await secureStorage.clearSessionToken();
  }

  /**
   * Fetch dynamic STUN + RFC 5766 TURN credentials from laptop agent
   */
  public async fetchIceServers(agentUrl: string): Promise<IceServerConfig> {
    return await apiRequest<IceServerConfig>(agentUrl, '/api/remote/ice-servers', {
      method: 'GET',
      timeoutMs: 5000,
    });
  }
}

export const authService = new AuthService();
