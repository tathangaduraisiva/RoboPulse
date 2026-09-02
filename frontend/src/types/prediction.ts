export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface PredictionInsight {
  id: string;
  robot_id: string;
  robot_name: string;
  robot_serial: string;
  robot_model: string;
  robot_status: string;
  line_name: string;
  health_score: number;
  risk_score: number;
  risk_level: RiskLevel;
  temperature_score: number;
  vibration_score: number;
  runtime_score: number;
  error_score: number;
  maintenance_score: number;
  primary_reason: string;
  recommendation: string;
  calculated_at: string;
}
