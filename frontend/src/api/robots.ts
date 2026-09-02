import { apiClient } from './client';
import type { ApiResponse } from '../types/api';
import type { Robot } from '../types/robot';
import type { SensorReading } from '../types/sensor';

export async function fetchRobots(): Promise<Robot[]> {
  const response = await apiClient.get<ApiResponse<Robot[]>>('/robots');
  return response.data.data;
}

export async function fetchRobot(robotId: string): Promise<Robot> {
  const response = await apiClient.get<ApiResponse<Robot>>(`/robots/${encodeURIComponent(robotId)}`);
  return response.data.data;
}

/** @deprecated Use fetchSensorReadings from sensors.ts */
export async function fetchRobotReadings(robotId: string): Promise<SensorReading[]> {
  const response = await apiClient.get<ApiResponse<SensorReading[]>>(
    `/robots/${encodeURIComponent(robotId)}/sensor-readings`
  );
  return response.data.data;
}
