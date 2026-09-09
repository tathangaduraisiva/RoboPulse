import React from 'react';
import { ChevronRight, Bell } from 'lucide-react';
import type { Alert } from '../../types/alert';

interface RecentAlertsPanelProps {
  alerts: Alert[];
  onViewAll: () => void;
  onSelectAlert?: (alert: Alert) => void;
}

export const RecentAlertsPanel: React.FC<RecentAlertsPanelProps> = ({
  alerts,
  onViewAll,
  onSelectAlert,
}) => {
  // Only show unresolved (open / investigating) alerts in the Recent Alerts panel.
  // Resolved alerts are historical records and must not appear as active items.
  const displayAlerts = alerts.filter((a) => a.status !== 'resolved').slice(0, 5);

  const formatAlertTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
      case 'warning':
        return 'warning';
      case 'medium':
        return 'warning';
      case 'low':
      case 'info':
      default:
        return 'info';
    }
  };

  const getStateBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
      case 'new':
        return 'new';
      case 'investigating':
      case 'in-progress':
      case 'in progress':
        return 'in-progress';
      case 'resolved':
        return 'resolved';
      default:
        return 'new';
    }
  };

  const formatStatusLabel = (status: string) => {
    if (status === 'investigating') return 'In Progress';
    if (status === 'open') return 'New';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div
      className="card"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Recent Alerts
          </h3>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Live anomaly feed from fleet sensor threshold monitoring
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          style={{
            fontSize: '12px',
            color: 'var(--accent-primary)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <span>View all</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Alerts Table */}
      <div className="table-container" style={{ flex: 1, border: 'none', boxShadow: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ padding: '8px 12px' }}>Time</th>
              <th style={{ padding: '8px 12px' }}>Machine</th>
              <th style={{ padding: '8px 12px' }}>Alert Type</th>
              <th style={{ padding: '8px 12px' }}>Severity</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {displayAlerts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: 'center',
                    padding: '28px',
                    color: 'var(--text-muted)',
                  }}
                >
                  No alerts recorded. All machine telemetry within safe limits.
                </td>
              </tr>
            ) : (
              displayAlerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="clickable"
                  onClick={() => onSelectAlert?.(alert)}
                >
                  {/* Time */}
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '10px 12px' }}>
                    {formatAlertTime(alert.detected_at)}
                  </td>

                  {/* Machine Name */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        <Bell size={13} />
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12.5px' }}>
                          {alert.robot_name}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Alert Type */}
                  <td style={{ fontSize: '12.5px', color: 'var(--text-primary)', padding: '10px 12px' }}>
                    {alert.anomaly_type}
                  </td>

                  {/* Severity Badge */}
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`severity-badge ${getSeverityBadgeClass(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                    <span className={`state-badge ${getStateBadgeClass(alert.status)}`}>
                      {formatStatusLabel(alert.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Link */}
      <div
        style={{
          marginTop: '12px',
          textAlign: 'center',
          paddingTop: '8px',
          borderTop: '1px solid #f1f5f9',
        }}
      >
        <button
          type="button"
          onClick={onViewAll}
          style={{
            fontSize: '12px',
            color: 'var(--accent-primary)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>View all alerts</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};
