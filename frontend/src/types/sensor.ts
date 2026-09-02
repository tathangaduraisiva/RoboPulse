export interface SensorReading {
  id: string;
  robot_id: string;
  temperature_c: number;
  vibration_mm_s: number;
  motor_current_a: number;
  pressure_bar: number;
  recorded_at: string;
}

export interface MetricStatistics {
  current: number;
  min: number;
  max: number;
  avg: number;
  unit: string;
  label: string;
  status: 'normal' | 'warning' | 'critical';
}
