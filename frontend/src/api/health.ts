import { apiClient } from './client';
import type { HealthStatus } from '../types/api';

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const response = await apiClient.get<HealthStatus>('/health');
  return response.data;
}
