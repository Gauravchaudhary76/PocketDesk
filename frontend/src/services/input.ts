/**
 * PocketDesk Input Dispatcher Service
 * Manages low-latency WebSocket input streaming with REST fallback,
 * coordinate normalization, and safe emergency release controls.
 */

import type { ScreenDimensions, InputStatus } from '../types';

export function mapClientCoordsToNormalized(
  clientX: number,
  clientY: number,
  containerElement: HTMLElement,
  hostAspect: number = 16 / 9
): { x: number; y: number } | null {
  const rect = containerElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const containerAspect = rect.width / rect.height;
  let renderWidth = rect.width;
  let renderHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (containerAspect > hostAspect) {
    // Pillarboxed (black bars on left and right)
    renderHeight = rect.height;
    renderWidth = rect.height * hostAspect;
    offsetX = (rect.width - renderWidth) / 2;
    offsetY = 0;
  } else {
    // Letterboxed (black bars on top and bottom)
    renderWidth = rect.width;
    renderHeight = rect.width / hostAspect;
    offsetX = 0;
    offsetY = (rect.height - renderHeight) / 2;
  }

  const relX = clientX - rect.left - offsetX;
  const relY = clientY - rect.top - offsetY;

  // Clamp within the rendered display area
  const clampedX = Math.max(0, Math.min(relX, renderWidth));
  const clampedY = Math.max(0, Math.min(relY, renderHeight));

  const normX = Math.max(0.0, Math.min(1.0, clampedX / renderWidth));
  const normY = Math.max(0.0, Math.min(1.0, clampedY / renderHeight));

  return { x: normX, y: normY };
}

export class InputClient {
  private ws: WebSocket | null = null;
  private agentUrl: string = '';
  private token: string = '';
  private lastMoveSentTime: number = 0;
  private readonly MOVE_THROTTLE_MS: number = 14; // ~70Hz max throttle for smooth motion

  /**
   * Connect to low-latency input WebSocket.
   */
  connectWebSocket(agentUrl: string, token: string): void {
    this.agentUrl = agentUrl;
    this.token = token;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const wsUrl = agentUrl.replace(/^http/, 'ws') + `/api/input/ws?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        // Connected
      };

      socket.onerror = () => {
        // Fallback to REST on error
      };

      socket.onclose = () => {
        this.ws = null;
      };

      this.ws = socket;
    } catch {
      this.ws = null;
    }
  }

  /**
   * Disconnect input WebSocket.
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  /**
   * Send JSON message via WebSocket or fallback to REST endpoint.
   */
  private sendWsOrFallback(msg: Record<string, unknown>, fallbackEndpoint: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ ...msg, timestamp: Date.now() / 1000 }));
        return;
      } catch {
        // Fall back to REST below
      }
    }

    // REST fallback
    if (this.agentUrl && this.token) {
      fetch(`${this.agentUrl}${fallbackEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(msg),
      }).catch(() => {});
    }
  }

  /**
   * Fetch host screen dimensions and aspect ratio.
   */
  async getScreenInfo(agentUrl: string, token: string): Promise<ScreenDimensions> {
    const res = await fetch(`${agentUrl}/api/input/screen-info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch screen info');
    return res.json();
  }

  /**
   * Fetch input status.
   */
  async getStatus(agentUrl: string, token: string): Promise<InputStatus> {
    const res = await fetch(`${agentUrl}/api/input/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch input status');
    return res.json();
  }

  /**
   * Explicitly enable remote input for this session.
   */
  async enableInput(agentUrl: string, token: string): Promise<boolean> {
    this.connectWebSocket(agentUrl, token);

    const res = await fetch(`${agentUrl}/api/input/control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'enable' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to enable remote input');
    }

    return true;
  }

  /**
   * Immediately disable remote input and release all held keys and mouse buttons.
   */
  async disableInput(agentUrl: string, token: string): Promise<void> {
    try {
      await fetch(`${agentUrl}/api/input/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'emergency_stop' }),
      });
    } catch {
      // ignore network errors during emergency stop
    }

    this.disconnectWebSocket();
  }

  /**
   * Move mouse cursor to normalized coordinates [0.0, 1.0].
   */
  sendMouseMove(normX: number, normY: number): void {
    const now = performance.now();
    if (now - this.lastMoveSentTime < this.MOVE_THROTTLE_MS) {
      return;
    }
    this.lastMoveSentTime = now;

    this.sendWsOrFallback(
      { type: 'move', x: normX, y: normY },
      '/api/input/mouse/move'
    );
  }

  /**
   * Move mouse cursor relative to current position (trackpad delta).
   */
  sendMouseRelative(dx: number, dy: number): void {
    const now = performance.now();
    if (now - this.lastMoveSentTime < this.MOVE_THROTTLE_MS) {
      return;
    }
    this.lastMoveSentTime = now;

    this.sendWsOrFallback(
      { type: 'move_rel', dx, dy },
      '/api/input/mouse/relative'
    );
  }

  /**
   * Dispatch mouse click, button down, or button up.
   */
  sendMouseClick(
    button: 'left' | 'right' | 'middle',
    action: 'click' | 'double_click' | 'down' | 'up' = 'click',
    normX?: number,
    normY?: number
  ): void {
    this.sendWsOrFallback(
      {
        type: 'click',
        button,
        action,
        x: normX ?? null,
        y: normY ?? null,
      },
      '/api/input/mouse/click'
    );
  }

  /**
   * Dispatch mouse vertical wheel scroll.
   */
  sendMouseScroll(deltaY: number): void {
    this.sendWsOrFallback(
      { type: 'scroll', delta_y: deltaY },
      '/api/input/mouse/scroll'
    );
  }

  /**
   * Dispatch key press, down, or up.
   */
  sendKey(key: string, action: 'press' | 'down' | 'up' = 'press'): void {
    this.sendWsOrFallback(
      { type: 'key', key, action },
      '/api/input/keyboard/key'
    );
  }

  /**
   * Dispatch typed Unicode text string.
   */
  sendText(text: string): void {
    if (!text) return;
    this.sendWsOrFallback(
      { type: 'text', text: text.slice(0, 500) },
      '/api/input/keyboard/text'
    );
  }

  /**
   * Dispatch multi-key combination (shortcut).
   */
  sendShortcut(keys: string[]): void {
    if (!keys || keys.length === 0) return;
    this.sendWsOrFallback(
      { type: 'shortcut', keys: keys.slice(0, 5) },
      '/api/input/keyboard/shortcut'
    );
  }
}

export const inputClient = new InputClient();
