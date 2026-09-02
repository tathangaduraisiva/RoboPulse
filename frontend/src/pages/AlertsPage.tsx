import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  Check,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  X,
} from 'lucide-react';
import type { Alert, AlertSeverity, AlertStatus } from '../types/alert';
import type { Robot } from '../types/robot';
import { acknowledgeAlertApi, resolveAlertApi } from '../api/alerts';

interface AlertsPageProps {
  alerts: Alert[];
  robots: Robot[];
  onSelectRobot: (robot: Robot) => void;
  onRefreshAlerts: () => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  alerts,
  robots,
  onSelectRobot,
  onRefreshAlerts,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewingAlert, setViewingAlert] = useState<Alert | null>(null);

  // Statistics
  const openCount = alerts.filter((a) => a.status === 'open').length;
  const investigatingCount = alerts.filter((a) => a.status === 'investigating').length;
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length;

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Search
      const matchesSearch =
        search === '' ||
        alert.robot_name.toLowerCase().includes(search.toLowerCase()) ||
        alert.robot_serial.toLowerCase().includes(search.toLowerCase()) ||
        alert.anomaly_type.toLowerCase().includes(search.toLowerCase()) ||
        alert.description.toLowerCase().includes(search.toLowerCase()) ||
        alert.line_name.toLowerCase().includes(search.toLowerCase());

      // Severity
      const matchesSeverity =
        selectedSeverity === 'all' || alert.severity === selectedSeverity;

      // Status
      const matchesStatus =
        selectedStatus === 'all' || alert.status === selectedStatus;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [alerts, search, selectedSeverity, selectedStatus]);

  // Handlers for PostgreSQL alert mutations
  const handleAcknowledge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setUpdatingId(id);
      await acknowledgeAlertApi(id);
      onRefreshAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setUpdatingId(id);
      await resolveAlertApi(id);
      onRefreshAlerts();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    const s = (severity || 'low').toLowerCase();
    if (s === 'critical' || s === 'high') {
      return <span className="severity-badge critical" style={{ textTransform: 'uppercase', fontWeight: 700 }}>High</span>;
    }
    if (s === 'medium') {
      return <span className="severity-badge warning" style={{ textTransform: 'uppercase', fontWeight: 700 }}>Medium</span>;
    }
    return <span className="severity-badge medium" style={{ textTransform: 'uppercase', fontWeight: 700 }}>Low</span>;
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case 'open':
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span className="state-badge open">Open</span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '3px',
                backgroundColor: 'var(--status-attention-bg)',
                color: 'var(--status-attention-fg)',
                border: '1px solid var(--status-attention-border)',
                letterSpacing: '0.02em',
              }}
            >
              UNRESOLVED
            </span>
          </div>
        );
      case 'investigating':
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span className="state-badge in-progress">Investigating</span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '3px',
                backgroundColor: 'var(--status-attention-bg)',
                color: 'var(--status-attention-fg)',
                border: '1px solid var(--status-attention-border)',
                letterSpacing: '0.02em',
              }}
            >
              UNRESOLVED
            </span>
          </div>
        );
      case 'resolved':
        return <span className="state-badge resolved">Resolved</span>;
      default:
        return <span className="state-badge open">Open</span>;
    }
  };

  const formatTime = (iso: string) => {
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

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Bell size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>Alerts & Incident Management</span>
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Real-time anomaly telemetry, active threshold infractions, and resolution workflow
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-default"
            onClick={onRefreshAlerts}
            title="Refresh active alerts"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/predictions')}
            style={{ height: '36px', padding: '0 14px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={15} />
            <span>Predictive Maintenance & Risk Intelligence</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Active Unresolved
            </div>
            <div className="font-mono tabular-nums" style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px' }}>
              {openCount + investigatingCount}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={18} />
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Critical Severity
            </div>
            <div
              className="font-mono tabular-nums"
              style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#dc2626' }}
            >
              {criticalCount}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={18} />
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Under Investigation
            </div>
            <div
              className="font-mono tabular-nums"
              style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#9333ea' }}
            >
              {investigatingCount}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#faf5ff',
              color: '#9333ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={18} />
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Resolved Anomaly Logs
            </div>
            <div
              className="font-mono tabular-nums"
              style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#16a34a' }}
            >
              {resolvedCount}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={18} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px' }}>
          <div className="search-input-wrapper" style={{ width: '100%', maxWidth: '340px' }}>
            <Search size={15} />
            <input
              type="text"
              className="search-input"
              placeholder="Search alert type, robot, line..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Severity filter */}
          <select
            className="select-input"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            aria-label="Filter by Severity"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status filter */}
          <select
            className="select-input"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Filter by Status"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Detected</th>
              <th>Machine</th>
              <th>Production Line</th>
              <th>Anomaly Type & Description</th>
              <th>Severity</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No alerts match your filter criteria.
                </td>
              </tr>
            ) : (
              filteredAlerts.map((alert) => {
                const targetRobot = robots.find((r) => r.id === alert.robot_id);

                return (
                  <tr
                    key={alert.id}
                    className="clickable"
                    onClick={() => setViewingAlert(alert)}
                  >
                    {/* Time */}
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatTime(alert.detected_at)}
                    </td>

                    {/* Machine */}
                    <td>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {alert.robot_name}
                        </span>
                        <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {alert.robot_serial}
                        </div>
                      </div>
                    </td>

                    {/* Line */}
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {alert.line_name}
                    </td>

                    {/* Description */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12.5px' }}>
                        {alert.anomaly_type}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '380px' }}>
                        {alert.description}
                      </div>
                    </td>

                    {/* Severity */}
                    <td>{getSeverityBadge(alert.severity)}</td>

                    {/* Status */}
                    <td>{getStatusBadge(alert.status)}</td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-default"
                          onClick={() => setViewingAlert(alert)}
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                          title="View alert diagnostics"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>

                        {alert.status === 'open' && (
                          <button
                            type="button"
                            className="btn btn-default"
                            disabled={updatingId === alert.id}
                            onClick={(e) => handleAcknowledge(alert.id, e)}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            title="Mark as investigating"
                          >
                            <span>Investigate</span>
                          </button>
                        )}

                        {alert.status !== 'resolved' && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={updatingId === alert.id}
                            onClick={(e) => handleResolve(alert.id, e)}
                            style={{
                              fontSize: '11px',
                              padding: '4px 8px',
                              backgroundColor: '#16a34a',
                              borderColor: '#16a34a',
                            }}
                            title="Resolve and close alert"
                          >
                            <Check size={12} />
                            <span>Resolve</span>
                          </button>
                        )}

                        {targetRobot && (
                          <button
                            type="button"
                            className="btn btn-default"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            onClick={() => onSelectRobot(targetRobot)}
                          >
                            <span>Telemetry</span>
                            <ChevronRight size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Alert Details Modal */}
      {viewingAlert && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingAlert(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="alert-dialog-title"
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '540px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: viewingAlert.severity === 'critical' ? '#fee2e2' : '#fef3c7',
                    color: viewingAlert.severity === 'critical' ? '#dc2626' : '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 id="alert-dialog-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                    {viewingAlert.anomaly_type}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Machine: {viewingAlert.robot_name} ({viewingAlert.robot_serial})
                  </div>
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={() => setViewingAlert(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'grid', gap: '16px' }}>
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Incident Description
                </div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', marginTop: '4px', lineHeight: 1.5 }}>
                  {viewingAlert.description}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Severity</div>
                  <div style={{ marginTop: '4px' }}>{getSeverityBadge(viewingAlert.severity)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</div>
                  <div style={{ marginTop: '4px' }}>{getStatusBadge(viewingAlert.status)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Production Line</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {viewingAlert.line_name}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Detected Timestamp</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {formatTime(viewingAlert.detected_at)}
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: 'var(--radius-sm)', border: '1px solid #bbf7d0', fontSize: '12px', color: '#166534' }}>
                <strong>Predictive Maintenance Note:</strong> Sensor telemetry indicates elevated mechanical stress. Review the Predictive Maintenance dashboard to analyze projected remaining useful life and failure risk.
              </div>
            </div>

            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <button
                type="button"
                className="btn btn-default"
                onClick={() => {
                  setViewingAlert(null);
                  navigate('/predictions');
                }}
                style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={14} />
                <span>View Risk Analysis</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {viewingAlert.status !== 'resolved' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async (e) => {
                      if (!viewingAlert) return;
                      await handleResolve(viewingAlert.id, e);
                      setViewingAlert(null);
                    }}
                    style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                  >
                    <Check size={13} />
                    <span>Resolve Alert</span>
                  </button>
                )}
                <button type="button" className="btn btn-default" onClick={() => setViewingAlert(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
