import { apiClient } from './client';
import type { MaintenanceTask, CreateMaintenanceInput } from '../types/maintenance';
import type { ApiResponse } from '../types/api';

export async function fetchMaintenance(): Promise<MaintenanceTask[]> {
  const response = await apiClient.get<ApiResponse<MaintenanceTask[]>>('/maintenance');
  return response.data.data;
}

export async function scheduleMaintenanceApi(input: CreateMaintenanceInput): Promise<MaintenanceTask> {
  const response = await apiClient.post<ApiResponse<MaintenanceTask>>('/maintenance', input);
  return response.data.data;
}

export async function completeMaintenanceApi(id: string): Promise<MaintenanceTask> {
  const response = await apiClient.patch<ApiResponse<MaintenanceTask>>(`/maintenance/${id}/complete`);
  return response.data.data;
}
