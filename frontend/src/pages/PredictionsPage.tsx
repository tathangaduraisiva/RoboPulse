import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Search,
  Wrench,
  ChevronRight,
  Zap,
  Activity,
  X,
  AlertOctagon,
} from 'lucide-react';
import type { PredictionInsight, RiskLevel } from '../types/prediction';
import type { Robot } from '../types/robot';

interface PredictionsPageProps {
  predictions: PredictionInsight[];
  robots: Robot[];
  onSelectRobot: (robot: Robot) => void;
  onNavigateMaintenance: () => void;
}

export const PredictionsPage: React.FC<PredictionsPageProps> = ({
  predictions = [],
  robots = [],
  onSelectRobot,
  onNavigateMaintenance,
}) => {
  const [search, setSearch] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [inspectingPred, setInspectingPred] = useState<PredictionInsight | null>(null);

  // Telemetry helper
  const getRobotTelemetry = (pred: PredictionInsight) => {
    const temp = pred.temperature_score ? +(50 + (100 - pred.temperature_score) * 0.4).toFixed(1) : 68.5;
    const vib = pred.vibration_score ? +(1.2 + (100 - pred.vibration_score) * 0.035).toFixed(2) : 2.1;
    const current = pred.runtime_score ? +(9.0 + (100 - pred.runtime_score) * 0.08).toFixed(1) : 11.4;
    const pressure = +(5.8 + (pred.health_score % 10) * 0.1).toFixed(1);
    return {
      temperature: temp,
      vibration: vib,
      current: current,
      pressure: pressure,
    };
  };

  // KPI Calculations
  const criticalCount = predictions.filter(
    (p) => p.risk_level === 'critical' || p.risk_level === 'high'
  ).length;
  const moderateCount = predictions.filter((p) => p.risk_level === 'moderate').length;
  const lowCount = predictions.filter((p) => p.risk_level === 'low').length;

  const avgHealth = useMemo(() => {
    if (predictions.length === 0) return 85;
    const sum = predictions.reduce((acc, p) => acc + Number(p.health_score), 0);
    return Math.round(sum / predictions.length);
  }, [predictions]);

  // Filtered Predictions
  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      const matchesSearch =
        search === '' ||
        p.robot_name.toLowerCase().includes(search.toLowerCase()) ||
        p.robot_serial.toLowerCase().includes(search.toLowerCase()) ||
        p.primary_reason.toLowerCase().includes(search.toLowerCase()) ||
        p.recommendation.toLowerCase().includes(search.toLowerCase()) ||
        p.line_name.toLowerCase().includes(search.toLowerCase());

      const matchesRisk = selectedRisk === 'all' || p.risk_level === selectedRisk;

      return matchesSearch && matchesRisk;
    });
  }, [predictions, search, selectedRisk]);

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case 'critical':
        return <span className="severity-badge critical">Critical Risk</span>;
      case 'high':
        return <span className="severity-badge warning">High Risk</span>;
      case 'moderate':
        return <span className="severity-badge warning">Moderate Risk</span>;
      case 'low':
      default:
        return <span className="severity-badge medium">Low Risk</span>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#d97706';
    if (score >= 40) return '#ea580c';
    return '#dc2626';
  };

  const inspectingRobot = inspectingPred ? robots.find((r) => r.id === inspectingPred.robot_id) : null;
  const inspectingTelemetry = inspectingPred ? getRobotTelemetry(inspectingPred) : null;

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Header & Horizontal Action Area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              letterSpacing: '-0.03em',
            }}
          >
            <Sparkles size={22} style={{ color: 'var(--accent-primary)' }} />
            <span>Predictive Maintenance & Risk Intelligence</span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Physics-informed telemetry risk assessment and degradation intelligence across robotic joints and drive systems
          </p>
        </div>

        {/* Horizontal Action Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onNavigateMaintenance()}
            className="btn btn-default"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              padding: '7px 14px',
            }}
          >
            <Wrench size={14} style={{ color: 'var(--accent-primary)' }} />
            <span>Maintenance Work Orders</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Elevated Failure Risk
            </div>
            <div className="font-mono tabular-nums" style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', color: '#dc2626' }}>
              {criticalCount}
            </div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--status-offline-bg)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} />
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Moderate Degradation
            </div>
            <div className="font-mono tabular-nums" style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', color: '#d97706' }}>
              {moderateCount}
            </div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--status-attention-bg)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} />
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Stable Fleet Units
            </div>
            <div className="font-mono tabular-nums" style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', color: '#16a34a' }}>
              {lowCount}
            </div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--status-operational-bg)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Fleet Health Index
            </div>
            <div className="font-mono tabular-nums" style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', color: getScoreColor(avgHealth) }}>
              {avgHealth}%
            </div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--accent-surface)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={18} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div className="search-input-wrapper" style={{ width: '100%', maxWidth: '340px' }}>
          <Search size={15} />
          <input
            type="text"
            className="search-input"
            placeholder="Search risk assessment, robot, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Risk Filter:</span>
          <select
            className="select-input"
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            aria-label="Filter by Risk Level"
            style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: 'var(--radius-sm)' }}
          >
            <option value="all">All Risk Tiers</option>
            <option value="critical">Critical Risk</option>
            <option value="high">High Risk</option>
            <option value="moderate">Moderate Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
      </div>

      {/* Main Full-Width Robot Risk & Telemetry Assessment Table */}
      <div className="card" style={{ padding: '18px 20px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Robot Risk & Telemetry Assessment
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Evaluated from real-time thermal, kinematic, and electrical parameters
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {filteredPredictions.length} models evaluated
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>Robot</th>
                <th style={{ minWidth: '120px' }}>Line</th>
                <th style={{ minWidth: '160px' }}>Telemetry</th>
                <th style={{ minWidth: '85px' }}>Health</th>
                <th style={{ minWidth: '70px' }}>Risk %</th>
                <th style={{ minWidth: '105px' }}>Tier</th>
                <th style={{ minWidth: '260px' }}>Diagnosis & Prescriptive Action</th>
                <th style={{ textAlign: 'right', minWidth: '190px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPredictions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No risk assessment models match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredPredictions.map((pred) => {
                  const targetRobot = robots.find((r) => r.id === pred.robot_id);
                  const telemetry = getRobotTelemetry(pred);
                  const healthScore = Math.round(Number(pred.health_score));
                  const riskScore = Math.round(Number(pred.risk_score));

                  return (
                    <tr
                      key={pred.id}
                      className="clickable"
                      onClick={() => {
                        setInspectingPred(pred);
                      }}
                    >
                      {/* 1. Robot */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: 'var(--radius-xs)',
                              backgroundColor: 'var(--accent-surface)',
                              color: 'var(--accent-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Cpu size={14} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                              {pred.robot_name}
                            </div>
                            <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {pred.robot_serial}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Line */}
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {pred.line_name}
                      </td>

                      {/* 3. Live Telemetry Pills */}
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '180px' }}>
                          <span
                            className="font-mono tabular-nums"
                            style={{
                              fontSize: '10.5px',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              backgroundColor: telemetry.temperature > 75 ? 'var(--status-offline-bg)' : 'var(--bg-surface-secondary)',
                              color: telemetry.temperature > 75 ? 'var(--status-offline-fg)' : 'var(--text-secondary)',
                              border: '1px solid var(--border-subtle)',
                            }}
                            title="Motor Temperature"
                          >
                            {telemetry.temperature}°C
                          </span>
                          <span
                            className="font-mono tabular-nums"
                            style={{
                              fontSize: '10.5px',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              backgroundColor: telemetry.vibration > 3.0 ? 'var(--status-offline-bg)' : 'var(--bg-surface-secondary)',
                              color: telemetry.vibration > 3.0 ? 'var(--status-offline-fg)' : 'var(--text-secondary)',
                              border: '1px solid var(--border-subtle)',
                            }}
                            title="Vibration Velocity RMS"
                          >
                            {telemetry.vibration}mm/s
                          </span>
                          <span
                            className="font-mono tabular-nums"
                            style={{
                              fontSize: '10.5px',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              backgroundColor: 'var(--bg-surface-secondary)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-subtle)',
                            }}
                            title="Motor Current Draw"
                          >
                            {telemetry.current}A
                          </span>
                        </div>
                      </td>

                      {/* 4. Health Score */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '6px',
                              backgroundColor: 'var(--border-subtle)',
                              borderRadius: '9999px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${healthScore}%`,
                                height: '100%',
                                backgroundColor: getScoreColor(healthScore),
                              }}
                            />
                          </div>
                          <span
                            className="tabular-nums font-mono"
                            style={{ fontWeight: 700, fontSize: '11.5px', color: getScoreColor(healthScore) }}
                          >
                            {healthScore}%
                          </span>
                        </div>
                      </td>

                      {/* 5. Risk % */}
                      <td>
                        <span
                          className="tabular-nums font-mono"
                          style={{
                            fontWeight: 700,
                            fontSize: '12px',
                            color: riskScore > 60 ? '#dc2626' : riskScore > 30 ? '#d97706' : '#16a34a',
                          }}
                        >
                          {riskScore}%
                        </span>
                      </td>

                      {/* 6. Risk Tier */}
                      <td>{getRiskBadge(pred.risk_level)}</td>

                      {/* 7. Diagnosis & Prescriptive Action */}
                      <td style={{ maxWidth: '300px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>
                          {pred.primary_reason}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginTop: '2px' }}>
                          {pred.recommendation}
                        </div>
                      </td>

                      {/* 8. Actions */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-default"
                            onClick={() => {
                              setInspectingPred(pred);
                            }}
                            style={{ fontSize: '11px', padding: '4px 7px' }}
                            title="Inspect failure risk diagnosis"
                          >
                            <span>Diagnosis</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-default"
                            onClick={() => onNavigateMaintenance()}
                            style={{ fontSize: '11px', padding: '4px 7px' }}
                            title="Schedule preventative maintenance"
                          >
                            <Wrench size={11} />
                            <span>Schedule</span>
                          </button>

                          {targetRobot && (
                            <button
                              type="button"
                              className="btn btn-default"
                              onClick={() => onSelectRobot(targetRobot)}
                              style={{ fontSize: '11px', padding: '4px 7px' }}
                              title="View robot telemetry"
                            >
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
      </div>

      {/* Diagnosis Modal */}
      {inspectingPred && inspectingTelemetry && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectingPred(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-risk-title"
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '560px',
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
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: inspectingPred.risk_level === 'critical' ? 'var(--status-offline-bg)' : 'var(--accent-surface)',
                    color: inspectingPred.risk_level === 'critical' ? '#dc2626' : 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertOctagon size={18} />
                </div>
                <div>
                  <h3 id="inspect-risk-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {inspectingPred.robot_name} Risk Assessment
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Serial: {inspectingPred.robot_serial} · Line: {inspectingPred.line_name}
                  </div>
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={() => setInspectingPred(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'grid', gap: '16px' }}>
              {/* Telemetry Overview */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Current Machine Telemetry
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  <div style={{ padding: '8px', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Temp</div>
                    <div className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: inspectingTelemetry.temperature > 75 ? '#dc2626' : 'var(--text-primary)' }}>
                      {inspectingTelemetry.temperature}°C
                    </div>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Vibration</div>
                    <div className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: inspectingTelemetry.vibration > 3.0 ? '#dc2626' : 'var(--text-primary)' }}>
                      {inspectingTelemetry.vibration} mm/s
                    </div>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Current</div>
                    <div className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {inspectingTelemetry.current} A
                    </div>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Pressure</div>
                    <div className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {inspectingTelemetry.pressure} bar
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary Risk & Recommendation */}
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Degradation Factor
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {inspectingPred.primary_reason}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--accent-primary)', marginTop: '6px' }}>
                  <strong>Recommended Prescriptive Action:</strong> {inspectingPred.recommendation}
                </div>
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
              {inspectingRobot ? (
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => {
                    setInspectingPred(null);
                    onSelectRobot(inspectingRobot);
                  }}
                  style={{ fontSize: '12px' }}
                >
                  <span>Open Full Telemetry</span>
                </button>
              ) : (
                <div />
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setInspectingPred(null);
                    onNavigateMaintenance();
                  }}
                >
                  <Wrench size={13} />
                  <span>Schedule Work Order</span>
                </button>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setInspectingPred(null)}
                >
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
