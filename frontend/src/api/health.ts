import { apiClient } from './client';
import type { HealthStatus } from '../types/api';

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const response = await apiClient.get<HealthStatus>('/health');
  return response.data;
}

let warmUpPromise: Promise<void> | null = null;

/**
 * Starts one lightweight health check to wake the backend.
 * If another part of the app calls this while the request is
 * still running, it waits for the same request instead of
 * creating another one.
 */
export function warmUpBackend(): Promise<void> {
  if (warmUpPromise) {
    return warmUpPromise;
  }

  warmUpPromise = fetchHealthStatus()
    .then(() => undefined)
    .catch(() => {
      // Best-effort warm-up — allow the application to proceed
    });

  return warmUpPromise;
}