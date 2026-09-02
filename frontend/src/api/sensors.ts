import { apiClient } from './client';
import type { SensorReading } from '../types/sensor';
import type { ApiResponse } from '../types/api';

/**
 * Fetch sensor readings for a robot.
 * Endpoint: GET /api/robots/:id/sensor-readings
 */
export async function fetchSensorReadings(robotId: string): Promise<SensorReading[]> {
  const response = await apiClient.get<ApiResponse<SensorReading[]>>(
    `/robots/${encodeURIComponent(robotId)}/sensor-readings`
  );
  return response.data.data;
}
