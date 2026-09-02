export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'investigating' | 'resolved';

export interface Alert {
  id: string;
  robot_id: string;
  robot_name: string;
  robot_serial: string;
  robot_model: string;
  line_name: string;
  anomaly_type: string;
  severity: AlertSeverity;
  description: string;
  status: AlertStatus;
  detected_at: string;
  resolved_at: string | null;
}
