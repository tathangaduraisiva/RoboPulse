import { apiClient } from './client';
import type { ApiResponse } from '../types/api';

export interface TechnicianApiRecord {
  id: string;
  name: string;
  employee_code: string;
  specialization: string;
  phone?: string | null;
  email?: string | null;
  status: 'available' | 'assigned' | 'offline';
  created_at?: string;
  updated_at?: string;
  assigned_robots?: Array<{
    id?: string;
    robot_id?: string;
    robot_name?: string;
    robot_code?: string;
    model?: string;
    status?: string;
    production_line?: string | null;
  }>;
}

export async function fetchTechnicians(): Promise<TechnicianApiRecord[]> {
  const response = await apiClient.get<ApiResponse<TechnicianApiRecord[]>>('/technicians');
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

export async function fetchTechnicianById(id: string): Promise<TechnicianApiRecord> {
  const response = await apiClient.get<ApiResponse<TechnicianApiRecord>>(`/technicians/${id}`);
  return response.data.data;
}

export interface CreateTechnicianPayload {
  name: string;
  employee_code?: string;
  specialization: string;
  phone?: string | null;
  email?: string | null;
  status?: 'available' | 'assigned' | 'offline';
}

export async function createTechnicianApi(payload: CreateTechnicianPayload): Promise<TechnicianApiRecord> {
  const response = await apiClient.post<ApiResponse<TechnicianApiRecord>>('/technicians', payload);
  return response.data.data;
}

export async function updateTechnicianApi(
  id: string,
  payload: Partial<CreateTechnicianPayload>
): Promise<TechnicianApiRecord> {
  const response = await apiClient.put<ApiResponse<TechnicianApiRecord>>(`/technicians/${id}`, payload);
  return response.data.data;
}

export async function deleteTechnicianApi(id: string): Promise<void> {
  await apiClient.delete<ApiResponse<unknown>>(`/technicians/${id}`);
}

export async function assignTechnicianRobotApi(technicianId: string, robotId: string): Promise<void> {
  await apiClient.post<ApiResponse<unknown>>(`/technicians/${technicianId}/assignments/${robotId}`);
}

export async function removeTechnicianRobotApi(technicianId: string, robotId: string): Promise<void> {
  await apiClient.delete<ApiResponse<unknown>>(`/technicians/${technicianId}/assignments/${robotId}`);
}
