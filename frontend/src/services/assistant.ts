import type { InterpretedCommand, ExecuteCommandResult, IntentCatalogItem } from '../types';

export class AssistantService {
  /**
   * Fetch catalog of supported natural-language intents and examples.
   */
  async getIntents(agentUrl: string, token: string): Promise<IntentCatalogItem[]> {
    const res = await fetch(`${agentUrl}/api/assistant/intents`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch assistant intents (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data.intents || [];
  }

  /**
   * Submit natural language instruction to be parsed and validated into an action proposal.
   */
  async parseInstruction(
    agentUrl: string,
    token: string,
    prompt: string
  ): Promise<InterpretedCommand> {
    const res = await fetch(`${agentUrl}/api/assistant/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt: prompt.trim() }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Command parsing failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  /**
   * Execute an authorized command proposal.
   */
  async executeInstruction(
    agentUrl: string,
    token: string,
    commandId: string,
    actionType: string,
    parameters: Record<string, any> = {},
    confirmed: boolean = false
  ): Promise<ExecuteCommandResult> {
    const res = await fetch(`${agentUrl}/api/assistant/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        command_id: commandId,
        action_type: actionType,
        parameters,
        confirmed,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Action execution failed with HTTP ${res.status}`);
    }

    return res.json();
  }
}

export const assistantService = new AssistantService();
