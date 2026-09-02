import React from 'react';
import { ChevronRight, AlertTriangle, AlertCircle } from 'lucide-react';
import type { Robot } from '../../types/robot';
import type { PredictionInsight } from '../../types/prediction';

interface CriticalRobotsPanelProps {
  robots: Robot[];
  predictions: PredictionInsight[];
  onSelectRobot: (robot: Robot) => void;
  onViewAll: () => void;
}

export const CriticalRobotsPanel: React.FC<CriticalRobotsPanelProps> = ({
  robots,
  predictions,
  onSelectRobot,
  onViewAll,
}) => {
  // Merge prediction risk score with robots list
  const rankedRobots = React.useMemo(() => {
    const predMap = new Map<string, PredictionInsight>();
    predictions.forEach((p) => predMap.set(p.robot_id, p));

    return robots
      .map((robot) => {
        const pred = predMap.get(robot.id);
        const failureRisk = pred
          ? Math.round(Number(pred.risk_score))
          : robot.status === 'offline'
          ? 92
          : robot.status === 'attention'
          ? 58
          : robot.status === 'maintenance'
          ? 48
          : 12;

        const severity: 'Critical' | 'Warning' | 'Healthy' =
          failureRisk >= 70 || robot.status === 'offline'
            ? 'Critical'
            : failureRisk >= 40 || robot.status === 'attention' || robot.status === 'maintenance'
            ? 'Warning'
            : 'Healthy';

        return {
          robot,
          failureRisk,
          severity,
          pred,
        };
      })
      .sort((a, b) => b.failureRisk - a.failureRisk)
      .slice(0, 3); // Top 3 critical/at-risk units matching reference
  }, [robots, predictions]);

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
            Critical Machines
          </h3>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            High-risk units requiring prompt inspection
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

      {/* List of at-risk robots matching reference */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        {rankedRobots.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '30px 10px',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            No critical machines detected. All units nominal.
          </div>
        ) : (
          rankedRobots.map(({ robot, failureRisk, severity }) => {
            const isCritical = severity === 'Critical';

            return (
              <div
                key={robot.id}
                onClick={() => onSelectRobot(robot)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                {/* Robot Info & Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isCritical ? '#fee2e2' : '#fef3c7',
                      color: isCritical ? '#dc2626' : '#d97706',
                      border: `1px solid ${isCritical ? '#fecaca' : '#fde68a'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isCritical ? (
                      <AlertCircle size={20} />
                    ) : (
                      <AlertTriangle size={20} />
                    )}
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {robot.name}
                    </div>
                    <div
                      className="font-mono"
                      style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                    >
                      ID: {robot.serial_number}
                    </div>
                  </div>
                </div>

                {/* Risk score & Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'right' }}>
                  <div>
                    <div
                      className="tabular-nums font-mono"
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: isCritical ? '#dc2626' : '#d97706',
                      }}
                    >
                      {failureRisk}%
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Failure Risk
                    </div>
                  </div>

                  <span
                    className={`severity-badge ${isCritical ? 'critical' : 'warning'}`}
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                  >
                    {severity}
                  </span>
                </div>
              </div>
            );
          })
        )}
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
          <span>View all machines</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};
