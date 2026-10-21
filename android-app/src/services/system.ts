/**
 * System Telemetry & Capabilities Service for PocketDesk Android
 */

import { apiRequest } from './apiClient';
import type { SystemInfoResponse } from '../types';

export interface CapabilitiesResponse {
  agent_version: string;
  stage: number;
  capabilities: Array<{
    id: string;
    name: string;
    description: string;
    status: 'available' | 'development' | 'planned';
  }>;
}

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
}

export class SystemService {
  public async getHealth(agentUrl: string): Promise<HealthResponse> {
    return await apiRequest<HealthResponse>(agentUrl, '/health', {
      method: 'GET',
      skipAuth: true,
      timeoutMs: 3000,
    });
  }

  public async getTelemetry(agentUrl: string): Promise<SystemInfoResponse> {
    return await apiRequest<SystemInfoResponse>(agentUrl, '/api/system', {
      method: 'GET',
      timeoutMs: 4000,
    });
  }

  public async getCapabilities(agentUrl: string): Promise<CapabilitiesResponse> {
    return await apiRequest<CapabilitiesResponse>(agentUrl, '/api/capabilities', {
      method: 'GET',
      timeoutMs: 4000,
    });
  }
}

export const systemService = new SystemService();
