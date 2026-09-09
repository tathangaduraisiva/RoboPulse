import React, { useState, useMemo } from 'react';
import {
  FileBarChart,
  Download,
  Layers,
} from 'lucide-react';
import type { Robot } from '../types/robot';
import type { Alert } from '../types/alert';
import type { MaintenanceTask } from '../types/maintenance';
import type { PredictionInsight } from '../types/prediction';

interface ReportsPageProps {
  robots: Robot[];
  alerts: Alert[];
  maintenance: MaintenanceTask[];
  predictions: PredictionInsight[];
}

type ReportType = 'fleet_health' | 'alerts_log' | 'maintenance_costs' | 'predictions_risk';

export const ReportsPage: React.FC<ReportsPageProps> = ({
  robots,
  alerts,
  maintenance,
  predictions,
}) => {
  const [reportType, setReportType] = useState<ReportType>('fleet_health');

  // CSV Export utility
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    let fileName: string;

    switch (reportType) {
      case 'fleet_health':
        fileName = 'robopulse-fleet-health.csv';
        csvContent += 'Robot Name,Serial Number,Model,Manufacturer,Status,Runtime Hours\n';
        robots.forEach((r) => {
          csvContent += `"${r.name}","${r.serial_number}","${r.model}","${r.manufacturer}","${r.status}",${r.total_runtime_hours}\n`;
        });
        break;
      case 'alerts_log':
        fileName = 'robopulse-alerts-log.csv';
        csvContent += 'Detected At,Robot Name,Serial Number,Line,Anomaly Type,Severity,Status,Description\n';
        alerts.forEach((a) => {
          csvContent += `"${a.detected_at}","${a.robot_name}","${a.robot_serial}","${a.line_name}","${a.anomaly_type}","${a.severity}","${a.status}","${a.description}"\n`;
        });
        break;
      case 'maintenance_costs':
        fileName = 'robopulse-maintenance-costs.csv';
        csvContent += 'Robot Name,Line,Maintenance Type,Technician,Cost USD,Status,Due Date,Description\n';
        maintenance.forEach((m) => {
          csvContent += `"${m.robot_name}","${m.line_name}","${m.maintenance_type}","${m.technician || ''}",${m.cost || 0},"${m.status}","${m.next_due_at || m.performed_at}","${m.description}"\n`;
        });
        break;
      case 'predictions_risk':
      default:
        fileName = 'robopulse-predictions-risk.csv';
        csvContent += 'Robot Name,Serial,Line,Health Score,Failure Probability,Risk Level,Primary Reason,Recommendation\n';
        predictions.forEach((p) => {
          csvContent += `"${p.robot_name}","${p.robot_serial}","${p.line_name}",${p.health_score},${p.risk_score},"${p.risk_level}","${p.primary_reason}","${p.recommendation}"\n`;
        });
        break;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPIs
  const totalCost = useMemo(
    () => maintenance.reduce((sum, m) => sum + (Number(m.cost) || 0), 0),
    [maintenance]
  );
  const totalRuntime = useMemo(
    () => robots.reduce((sum, r) => sum + (Number(r.total_runtime_hours) || 0), 0),
    [robots]
  );

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
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
            <FileBarChart size={20} style={{ color: '#2563eb' }} />
            <span>Industrial Reports & Operational Analytics</span>
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Generate operational audit summaries, equipment reliability records, and maintenance expense logs
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleExportCSV}
          style={{ height: '38px', padding: '0 16px', fontWeight: 600 }}
        >
          <Download size={16} />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        <div className="card card-interactive" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Fleet Machines
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px' }}>
            {robots.length} Units
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Across 4 production lines
          </div>
        </div>

        <div className="card card-interactive" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Cumulative Runtime
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px' }}>
            {Math.round(totalRuntime).toLocaleString()} hrs
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Logged operating hours
          </div>
        </div>

        <div className="card card-interactive" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Total Recorded Anomalies
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#dc2626' }}>
            {alerts.length} Incidents
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            PostgreSQL event stream
          </div>
        </div>

        <div className="card card-interactive" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Cumulative Maintenance
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#16a34a' }}>
            ${totalCost.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {maintenance.length} scheduled work orders
          </div>
        </div>
      </div>

      {/* Report Type Selector */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Report Template:</span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'var(--bg-surface-secondary)',
            padding: '3px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            gap: '2px',
          }}
        >
          <button
            type="button"
            className={`report-tab-btn ${reportType === 'fleet_health' ? 'active' : ''}`}
            onClick={() => setReportType('fleet_health')}
          >
            Fleet Operations
          </button>

          <button
            type="button"
            className={`report-tab-btn ${reportType === 'alerts_log' ? 'active' : ''}`}
            onClick={() => setReportType('alerts_log')}
          >
            Alerts & Incidents
          </button>

          <button
            type="button"
            className={`report-tab-btn ${reportType === 'maintenance_costs' ? 'active' : ''}`}
            onClick={() => setReportType('maintenance_costs')}
          >
            Maintenance & Costs
          </button>

          <button
            type="button"
            className={`report-tab-btn ${reportType === 'predictions_risk' ? 'active' : ''}`}
            onClick={() => setReportType('predictions_risk')}
          >
            Predictive Risk
          </button>
        </div>
      </div>

      {/* Report Table Preview */}
      <div className="table-container">
        {reportType === 'fleet_health' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Machine Identifier</th>
                <th>Model</th>
                <th>Manufacturer</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Operating Runtime</th>
              </tr>
            </thead>
            <tbody>
              {robots.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {r.serial_number}
                    </div>
                  </td>
                  <td>{r.model}</td>
                  <td>{r.manufacturer}</td>
                  <td>
                    <span className={`status-pill ${r.status}`}>
                      <span className="status-dot" />
                      {r.status}
                    </span>
                  </td>
                  <td className="tabular-nums font-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                    {Number(r.total_runtime_hours).toLocaleString()} hrs
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'alerts_log' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Detected At</th>
                <th>Machine</th>
                <th>Production Line</th>
                <th>Anomaly Type</th>
                <th>Severity</th>
                <th style={{ textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontSize: '12px' }}>{new Date(a.detected_at).toLocaleString()}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.robot_name}</div>
                    <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {a.robot_serial}
                    </div>
                  </td>
                  <td>{a.line_name}</td>
                  <td>{a.anomaly_type}</td>
                  <td>
                    <span className={`severity-badge ${a.severity}`}>{a.severity}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`state-badge ${a.status}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'maintenance_costs' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Machine</th>
                <th>Type</th>
                <th>Technician</th>
                <th>Description</th>
                <th>Cost ($)</th>
                <th style={{ textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {maintenance.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.robot_name}</div>
                    <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {m.robot_serial}
                    </div>
                  </td>
                  <td>{m.maintenance_type}</td>
                  <td>{m.technician || 'Unassigned'}</td>
                  <td style={{ maxWidth: '300px' }}>{m.description}</td>
                  <td className="tabular-nums font-mono" style={{ fontWeight: 600 }}>
                    ${Number(m.cost || 0).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`state-badge ${m.status}`}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'predictions_risk' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Machine</th>
                <th>Line</th>
                <th>Health Score</th>
                <th>Failure Risk</th>
                <th>Risk Level</th>
                <th style={{ textAlign: 'right' }}>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.robot_name}</div>
                    <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {p.robot_serial}
                    </div>
                  </td>
                  <td>{p.line_name}</td>
                  <td className="tabular-nums font-mono" style={{ fontWeight: 600 }}>
                    {p.health_score}%
                  </td>
                  <td className="tabular-nums font-mono" style={{ fontWeight: 600, color: p.risk_score > 60 ? '#dc2626' : '#d97706' }}>
                    {p.risk_score}%
                  </td>
                  <td>
                    <span className={`severity-badge ${p.risk_level === 'critical' ? 'critical' : 'warning'}`}>
                      {p.risk_level}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '12px' }}>{p.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
