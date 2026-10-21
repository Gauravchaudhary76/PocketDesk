/**
 * AI Command Interface Service for PocketDesk Android
 */

import { apiRequest } from './apiClient';
import type {
  InterpretedCommand,
  ExecuteCommandResult,
  IntentCatalogItem,
} from '../types';

export interface IntentCatalogResponse {
  intents: IntentCatalogItem[];
  total: number;
  zero_shell_guarantee: boolean;
}

export class AndroidAssistantService {
  /**
   * Fetches the supported intent catalog from laptop agent
   */
  public async getIntents(agentUrl: string): Promise<IntentCatalogResponse> {
    return await apiRequest<IntentCatalogResponse>(agentUrl, '/api/assistant/intents', {
      method: 'GET',
      timeoutMs: 4000,
    });
  }

  /**
   * Parses a natural-language prompt into a proposed desktop action preview
   */
  public async parseInstruction(
    agentUrl: string,
    prompt: string
  ): Promise<InterpretedCommand> {
    return await apiRequest<InterpretedCommand>(agentUrl, '/api/assistant/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim() }),
      timeoutMs: 5000,
    });
  }

  /**
   * Executes an authorized desktop action
   */
  public async executeInstruction(
    agentUrl: string,
    prompt: string,
    intent: string,
    parameters: Record<string, unknown> = {},
    confirmed = false
  ): Promise<ExecuteCommandResult> {
    return await apiRequest<ExecuteCommandResult>(agentUrl, '/api/assistant/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.trim(),
        intent,
        parameters,
        confirmed,
      }),
      timeoutMs: 12000,
    });
  }
}

export const androidAssistant = new AndroidAssistantService();
