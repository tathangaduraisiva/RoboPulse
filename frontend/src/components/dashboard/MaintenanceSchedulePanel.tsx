import React, { useMemo } from 'react';
import { Wrench, AlertTriangle, AlertCircle, ShieldCheck, ChevronRight } from 'lucide-react';
import type { Robot } from '../../types/robot';
import type { ProductionLine } from '../../types/productionLine';

interface MaintenanceSchedulePanelProps {
  robots: Robot[];
  productionLines?: ProductionLine[];
  onSelectRobot: (robot: Robot) => void;
  onNavigateMaintenance: () => void;
}

export const MaintenanceSchedulePanel: React.FC<MaintenanceSchedulePanelProps> = ({
  robots,
  productionLines = [],
  onSelectRobot,
  onNavigateMaintenance,
}) => {
  const lineMap = useMemo(() => {
    const map = new Map<string, ProductionLine>();
    productionLines.forEach((l) => map.set(l.id, l));
    return map;
  }, [productionLines]);

  // Prioritize robots currently in maintenance, offline, or attention, sorted by runtime hours
  const prioritizedRobots = useMemo(() => {
    const statusScore = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'maintenance':
          return 4;
        case 'offline':
          return 3;
        case 'attention':
          return 2;
        default:
          return 1;
      }
    };

    return [...robots]
      .sort((a, b) => {
        const scoreDiff = statusScore(b.status) - statusScore(a.status);
        if (scoreDiff !== 0) return scoreDiff;
        return Number(b.total_runtime_hours) - Number(a.total_runtime_hours);
      })
      .slice(0, 3);
  }, [robots]);

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'maintenance':
        return {
          icon: <Wrench size={18} />,
          bg: 'var(--status-maintenance-bg)',
          color: 'var(--status-maintenance-fg)',
          border: 'var(--status-maintenance-border)',
          label: 'Scheduled Maintenance Required',
        };
      case 'offline':
        return {
          icon: <AlertCircle size={18} />,
          bg: 'var(--status-offline-bg)',
          color: 'var(--status-offline-fg)',
          border: 'var(--status-offline-border)',
          label: 'Offline Diagnostic Pending',
        };
      case 'attention':
        return {
          icon: <AlertTriangle size={18} />,
          bg: 'var(--status-attention-bg)',
          color: 'var(--status-attention-fg)',
          border: 'var(--status-attention-border)',
          label: 'Condition Inspection Advised',
        };
      default:
        return {
          icon: <ShieldCheck size={18} />,
          bg: 'var(--status-operational-bg)',
          color: 'var(--status-operational-fg)',
          border: 'var(--status-operational-border)',
          label: 'Routine Service Interval',
        };
    }
  };

  const formatRuntime = (hours: number | string) => {
    const num = typeof hours === 'number' ? hours : parseFloat(hours) || 0;
    return `${num.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} hrs`;
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
      }}
    >
      {/* Card Header */}
      <div className="card-header">
        <div>
          <div className="card-title">
            <Wrench size={17} style={{ color: 'var(--accent-primary)' }} />
            <span>Maintenance & Service Priority</span>
          </div>
          <div className="card-subtitle">
            Lifecycle tracking based on runtime accumulation and unit status
          </div>
        </div>

        <button
          type="button"
          className="btn btn-default"
          onClick={onNavigateMaintenance}
          style={{ fontSize: '11.5px', padding: '4px 10px', fontWeight: 600 }}
        >
          View Log
        </button>
      </div>

      {/* Cards List matching reference Maintenance Schedule style */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flex: 1,
        }}
      >
        {prioritizedRobots.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No robot records available.
          </div>
        ) : (
          prioritizedRobots.map((robot) => {
            const line = robot.line_id ? lineMap.get(robot.line_id) : undefined;
            const statusConfig = getStatusIcon(robot.status);

            return (
              <div
                key={robot.id}
                onClick={() => onSelectRobot(robot)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  border: '1px solid var(--border-subtle)',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  {/* Left Icon Square */}
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: statusConfig.bg,
                      color: statusConfig.color,
                      border: `1px solid ${statusConfig.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {statusConfig.icon}
                  </div>

                  {/* Robot details */}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '13.5px',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{robot.name}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>·</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>
                        {robot.model}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '11.5px',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {statusConfig.label} {line ? `· ${line.name}` : ''}
                    </div>
                  </div>
                </div>

                {/* Right side runtime hours */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    className="tabular-nums font-mono"
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {formatRuntime(robot.total_runtime_hours)}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Runtime
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Navigation link */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-secondary)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          className="btn btn-default"
          onClick={onNavigateMaintenance}
          style={{ fontSize: '12.5px', fontWeight: 600 }}
        >
          <span>View All Maintenance Tasks</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
