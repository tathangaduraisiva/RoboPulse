import { apiClient } from './client';
import type { Alert } from '../types/alert';
import type { ApiResponse } from '../types/api';

export async function fetchAlerts(): Promise<Alert[]> {
  const response = await apiClient.get<ApiResponse<Alert[]>>('/alerts');
  return response.data.data;
}

export async function acknowledgeAlertApi(id: string): Promise<Alert> {
  const response = await apiClient.patch<ApiResponse<Alert>>(`/alerts/${id}/acknowledge`);
  return response.data.data;
}

export async function resolveAlertApi(id: string): Promise<Alert> {
  const response = await apiClient.patch<ApiResponse<Alert>>(`/alerts/${id}/resolve`);
  return response.data.data;
}
