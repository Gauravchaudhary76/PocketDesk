/**
 * API Client for PocketDesk Android
 *
 * Centralizes HTTP requests, bearer authentication headers, request timeouts,
 * and standard error response extraction.
 */

import { secureStorage } from './secureStorage';

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
}

export class ApiError extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(
  baseUrl: string,
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
  const timeoutMs = options.timeoutMs ?? 7000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!options.skipAuth) {
    const token = await secureStorage.getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      await secureStorage.clearSessionToken();
      throw new ApiError('Session has expired or token is invalid. Please reconnect.', 401);
    }

    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}`;
      let errorData: unknown = null;
      try {
        errorData = await response.json();
        if (typeof errorData === 'object' && errorData !== null && 'detail' in errorData) {
          errorMessage = String((errorData as { detail: unknown }).detail);
        } else if (typeof errorData === 'object' && errorData !== null && 'message' in errorData) {
          errorMessage = String((errorData as { message: unknown }).message);
        }
      } catch {
        // Response is non-JSON
      }
      throw new ApiError(errorMessage, response.status, errorData);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(`Request to ${endpoint} timed out after ${timeoutMs}ms`, 408);
    }
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    throw new ApiError(`Network request failed: ${message}`, 0);
  }
}
