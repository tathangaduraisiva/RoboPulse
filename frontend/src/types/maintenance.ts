export type MaintenanceType =
  | 'preventive'
  | 'corrective'
  | 'inspection'
  | 'component_replacement';

export type MaintenanceStatus = 'upcoming' | 'overdue' | 'completed';

export interface MaintenanceTask {
  id: string;
  robot_id: string;
  robot_name: string;
  robot_serial: string;
  robot_model: string;
  line_name: string;
  component_id: string | null;
  component_name: string | null;
  maintenance_type: MaintenanceType;
  description: string;
  technician: string | null;
  cost: number | null;
  performed_at: string;
  next_due_at: string | null;
  created_at: string;
  status: MaintenanceStatus;
}

export interface CreateMaintenanceInput {
  robot_id: string;
  component_id?: string;
  maintenance_type: MaintenanceType;
  description: string;
  technician?: string;
  cost?: number;
  next_due_at?: string;
}
