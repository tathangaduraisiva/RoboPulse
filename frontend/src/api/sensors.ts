import { apiClient } from './client';
import type { SensorReading } from '../types/sensor';
import type { ApiResponse } from '../types/api';

const sensorCache = new Map<string, { data: SensorReading[]; timestamp: number }>();
const CACHE_TTL_MS = 10000;

/**
 * Fetch sensor readings for a robot with short client-side cache to eliminate UI interaction latency.
 * Endpoint: GET /api/robots/:id/sensor-readings
 */
export async function fetchSensorReadings(robotId: string, forceRefresh = false): Promise<SensorReading[]> {
  const now = Date.now();
  if (!forceRefresh && sensorCache.has(robotId)) {
    const cached = sensorCache.get(robotId)!;
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const response = await apiClient.get<ApiResponse<SensorReading[]>>(
    `/robots/${encodeURIComponent(robotId)}/sensor-readings`
  );
  const data = response.data.data;
  sensorCache.set(robotId, { data, timestamp: now });
  return data;
}

export function clearSensorCache(): void {
  sensorCache.clear();
}
