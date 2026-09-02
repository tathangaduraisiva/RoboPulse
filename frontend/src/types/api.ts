export interface ApiResponse<T> {
  success: boolean;
  count?: number;
  data: T;
  message?: string;
  robotId?: string;
}

export interface HealthStatus {
  success: boolean;
  service: string;
  status: 'operational' | 'degraded' | 'offline' | string;
  timestamp?: string;
}
