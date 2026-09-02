import React from 'react';
import type { RobotStatus } from '../../types/robot';

interface StatusBadgeProps {
  status: RobotStatus | string;
  className?: string;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
  showDot = true,
}) => {
  const normalizedStatus = (status || 'unknown').toLowerCase();
  
  // Format human-readable status label
  const label =
    normalizedStatus === 'operational'
      ? 'Operational'
      : normalizedStatus === 'attention'
      ? 'Attention'
      : normalizedStatus === 'maintenance'
      ? 'Maintenance'
      : normalizedStatus === 'offline'
      ? 'Offline'
      : normalizedStatus;

  const statusClass =
    normalizedStatus === 'operational' ||
    normalizedStatus === 'attention' ||
    normalizedStatus === 'maintenance' ||
    normalizedStatus === 'offline'
      ? normalizedStatus
      : 'maintenance';

  return (
    <span className={`status-pill ${statusClass} ${className}`}>
      {showDot && <span className="status-dot" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
};
