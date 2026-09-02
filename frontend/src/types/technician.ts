export type TechnicianStatus = 'available' | 'assigned' | 'offline';

export type TechnicianSpecialization =
  | 'mechanical'
  | 'electrical'
  | 'hydraulic'
  | 'software'
  | 'general';

export interface Technician {
  id: string;
  name: string;
  technician_id: string;
  specialization: TechnicianSpecialization;
  assigned_robots: string[];
  status: TechnicianStatus;
  last_activity: string | null;
  phone?: string;
  email?: string;
}
