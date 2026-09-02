import React from 'react';
import { Factory, Bot, MapPin } from 'lucide-react';
import type { ProductionLine } from '../types/productionLine';
import type { Robot } from '../types/robot';
import { StatusBadge } from '../components/common/StatusBadge';
import { ErrorState, EmptyState } from '../components/common/FeedbackStates';

interface ProductionLinesPageProps {
  productionLines: ProductionLine[];
  robots: Robot[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectRobot: (robot: Robot) => void;
}

export const ProductionLinesPage: React.FC<ProductionLinesPageProps> = ({
  productionLines,
  robots,
  loading,
  error,
  onRetry,
  onSelectRobot,
}) => {

  if (error && productionLines.length === 0) {
    return (
      <ErrorState
        title="Production Lines Unavailable"
        message={error}
        onRetry={onRetry}
        isRetrying={loading}
      />
    );
  }

  if (!loading && productionLines.length === 0) {
    return (
      <EmptyState
        title="No Production Lines Configured"
        message="No manufacturing production lines found in the RoboPulse system."
      />
    );
  }

  return (
    <div>
      {/* Top Header info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Active Facility Lines ({productionLines.length})
          </h2>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '2px',
            }}
          >
            Physical manufacturing plant floors, assigned robotics cells, and telemetry status
          </p>
        </div>
      </div>

      {/* Grid of detailed Production Lines */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '20px',
        }}
      >
        {productionLines.map((line) => {
          const lineRobots = robots.filter((r) => r.line_id === line.id);

          return (
            <div
              key={line.id}
              className="card"
              style={{
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Line Card Header */}
              <div
                style={{
                  padding: '18px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Factory size={18} style={{ color: 'var(--accent-primary)' }} />
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        margin: 0,
                      }}
                    >
                      {line.name}
                    </h3>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      marginTop: '4px',
                    }}
                  >
                    {line.description}
                  </div>
                </div>

                <span
                  className="font-mono"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {line.code}
                </span>
              </div>

              {/* Line Metadata bar */}
              <div
                style={{
                  padding: '10px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <MapPin size={13} />
                  <span>{line.location}</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  <Bot size={14} style={{ color: 'var(--accent-primary)' }} />
                  <span className="tabular-nums">
                    {line.robot_count} Assigned {line.robot_count === 1 ? 'Robot' : 'Robots'}
                  </span>
                </div>
              </div>

              {/* Robots in this line */}
              <div style={{ padding: '16px 20px', flex: 1 }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '10px',
                  }}
                >
                  Assigned Robotic Units
                </div>

                {lineRobots.length === 0 ? (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      padding: '16px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-surface-secondary)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    No robotic units currently mapped to this line.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {lineRobots.map((robot) => (
                      <div
                        key={robot.id}
                        onClick={() => onSelectRobot(robot)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-surface)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                          e.currentTarget.style.borderColor = 'var(--border-default)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '13px',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {robot.name}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              display: 'flex',
                              gap: '8px',
                              marginTop: '2px',
                            }}
                          >
                            <span>
                              {robot.manufacturer} {robot.model}
                            </span>
                            <span>·</span>
                            <span className="font-mono">SN: {robot.serial_number}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <StatusBadge status={robot.status} />
                          <button
                            type="button"
                            className="btn btn-default"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectRobot(robot);
                            }}
                          >
                            Telemetry
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
