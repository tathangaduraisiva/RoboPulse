export type RobotStatus = 'operational' | 'attention' | 'maintenance' | 'offline';

export interface Robot {
  id: string;
  line_id: string | null;
  name: string;
  serial_number: string;
  model: string;
  manufacturer: string;
  status: RobotStatus;
  installation_date: string;
  total_runtime_hours: number | string;
  created_at?: string;
}

export interface RobotFleetStats {
  totalRobots: number;
  operational: number;
  attention: number;
  maintenance: number;
  offline: number;
  totalProductionLines: number;
}
