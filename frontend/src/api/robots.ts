import { apiClient } from './client';
import type { ApiResponse } from '../types/api';
import type { Robot } from '../types/robot';
import type { SensorReading } from '../types/sensor';
import { fetchSensorReadings } from './sensors';

export async function fetchRobots(): Promise<Robot[]> {
  const response = await apiClient.get<ApiResponse<Robot[]>>('/robots');
  return response.data.data;
}

export async function fetchRobot(robotId: string): Promise<Robot> {
  const response = await apiClient.get<ApiResponse<Robot>>(`/robots/${encodeURIComponent(robotId)}`);
  return response.data.data;
}

/** Forward to fetchSensorReadings with caching support */
export async function fetchRobotReadings(robotId: string, forceRefresh = false): Promise<SensorReading[]> {
  return fetchSensorReadings(robotId, forceRefresh);
}
