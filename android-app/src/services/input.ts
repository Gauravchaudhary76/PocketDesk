/**
 * Remote Input Control & Touch Coordinate Mapping for PocketDesk Android
 *
 * Implements:
 * 1. Normalized touch-to-desktop coordinate mapping with letterbox/pillarbox compensation
 * 2. Mouse click, drag, and scroll dispatching
 * 3. Unicode keyboard typing and virtual shortcuts
 * 4. Safety controls: default-disabled input and emergency stop release
 */

import { apiRequest } from './apiClient';
import type { InputOperationResponse, ScreenInfoResponse } from '../types';

export interface TouchCoordinateInput {
  touchX: number;
  touchY: number;
  containerWidth: number;
  containerHeight: number;
  desktopAspectRatio?: number; // default 16/9
}

export interface NormalizedCoordinates {
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
  isInsideDisplay: boolean;
}

export class AndroidInputService {
  private inputEnabled = false;
  private screenInfo: ScreenInfoResponse | null = null;

  public isEnabled(): boolean {
    return this.inputEnabled;
  }

  /**
   * Fetches the host desktop screen resolution from laptop agent
   */
  public async fetchScreenInfo(agentUrl: string): Promise<ScreenInfoResponse> {
    const data = await apiRequest<ScreenInfoResponse>(agentUrl, '/api/input/screen-info', {
      method: 'GET',
      timeoutMs: 4000,
    });
    this.screenInfo = data;
    return data;
  }

  /**
   * Enables or disables remote input authorization on the laptop agent
   */
  public async setInputState(agentUrl: string, enable: boolean): Promise<InputOperationResponse> {
    const action = enable ? 'enable' : 'disable';
    const res = await apiRequest<InputOperationResponse>(agentUrl, '/api/input/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
      timeoutMs: 4000,
    });
    this.inputEnabled = enable;
    return res;
  }

  /**
   * Emergency stop: releases all keys and disables input immediately
   */
  public async emergencyStop(agentUrl: string): Promise<InputOperationResponse> {
    this.inputEnabled = false;
    try {
      return await apiRequest<InputOperationResponse>(agentUrl, '/api/input/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'emergency_stop' }),
        timeoutMs: 3000,
      });
    } catch {
      return { success: false, message: 'Emergency stop dispatch failed' };
    }
  }

  /**
   * Mathematical Coordinate Mapping:
   * Maps an Android touch point within a viewport to normalized [0.0, 1.0] host coordinates,
   * properly subtracting letterbox (top/bottom) or pillarbox (left/right) black bars.
   */
  public mapTouchToNormalized(input: TouchCoordinateInput): NormalizedCoordinates {
    const { touchX, touchY, containerWidth, containerHeight } = input;
    const desktopAspect = input.desktopAspectRatio || (16 / 9);

    if (containerWidth <= 0 || containerHeight <= 0) {
      return { x: 0, y: 0, isInsideDisplay: false };
    }

    const containerAspect = containerWidth / containerHeight;
    let renderWidth = containerWidth;
    let renderHeight = containerHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > desktopAspect) {
      // Pillarboxed (black bars on left and right)
      renderWidth = containerHeight * desktopAspect;
      offsetX = (containerWidth - renderWidth) / 2;
    } else {
      // Letterboxed (black bars on top and bottom)
      renderHeight = containerWidth / desktopAspect;
      offsetY = (containerHeight - renderHeight) / 2;
    }

    const adjustedX = touchX - offsetX;
    const adjustedY = touchY - offsetY;

    if (
      adjustedX < 0 ||
      adjustedX > renderWidth ||
      adjustedY < 0 ||
      adjustedY > renderHeight
    ) {
      // Touch landed in the letterbox/pillarbox padding
      return {
        x: Math.min(1.0, Math.max(0.0, adjustedX / renderWidth)),
        y: Math.min(1.0, Math.max(0.0, adjustedY / renderHeight)),
        isInsideDisplay: false,
      };
    }

    const normX = Math.max(0.0, Math.min(1.0, adjustedX / renderWidth));
    const normY = Math.max(0.0, Math.min(1.0, adjustedY / renderHeight));

    return {
      x: Math.round(normX * 10000) / 10000,
      y: Math.round(normY * 10000) / 10000,
      isInsideDisplay: true,
    };
  }

  // --- Remote Mouse Operations ---

  public async moveMouse(agentUrl: string, x: number, y: number): Promise<void> {
    if (!this.inputEnabled) return;
    await apiRequest(agentUrl, '/api/input/mouse/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
      timeoutMs: 2500,
    });
  }

  public async moveMouseRelative(agentUrl: string, dx: number, dy: number): Promise<void> {
    if (!this.inputEnabled) return;
    await apiRequest(agentUrl, '/api/input/mouse/relative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dx, dy }),
      timeoutMs: 2500,
    });
  }

  public async clickMouse(
    agentUrl: string,
    button: 'left' | 'right' | 'middle',
    action: 'click' | 'double_click' | 'down' | 'up' = 'click',
    coords?: { x: number; y: number }
  ): Promise<void> {
    if (!this.inputEnabled) return;
    await apiRequest(agentUrl, '/api/input/mouse/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ button, action, ...(coords ? { x: coords.x, y: coords.y } : {}) }),
      timeoutMs: 3000,
    });
  }

  public async scrollMouse(agentUrl: string, deltaY: number): Promise<void> {
    if (!this.inputEnabled) return;
    await apiRequest(agentUrl, '/api/input/mouse/scroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta_y: deltaY }),
      timeoutMs: 2500,
    });
  }

  // --- Remote Keyboard Operations ---

  public async sendKey(
    agentUrl: string,
    key: string,
    action: 'press' | 'down' | 'up' = 'press'
  ): Promise<void> {
    if (!this.inputEnabled) return;
    await apiRequest(agentUrl, '/api/input/keyboard/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, action }),
      timeoutMs: 3000,
    });
  }

  public async sendText(agentUrl: string, text: string): Promise<void> {
    if (!this.inputEnabled || !text) return;
    await apiRequest(agentUrl, '/api/input/keyboard/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      timeoutMs: 4000,
    });
  }

  public async sendShortcut(agentUrl: string, keys: string[]): Promise<void> {
    if (!this.inputEnabled || keys.length === 0) return;
    await apiRequest(agentUrl, '/api/input/keyboard/shortcut', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
      timeoutMs: 4000,
    });
  }
}

export const androidInput = new AndroidInputService();
