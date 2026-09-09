import React, { useMemo } from 'react';
import { AlertTriangle, ChevronRight, Hash, CheckCircle2 } from 'lucide-react';
import type { Robot, RobotStatus } from '../../types/robot';
import type { ProductionLine } from '../../types/productionLine';
import type { Alert } from '../../types/alert';
import { StatusBadge } from '../common/StatusBadge';

interface RecentAttentionPanelProps {
  robots: Robot[];
  alerts: Alert[];
  productionLines?: ProductionLine[];
  onSelectRobot: (robot: Robot) => void;
  onNavigateRobots: () => void;
}

export const RecentAttentionPanel: React.FC<RecentAttentionPanelProps> = ({
  robots,
  alerts,
  productionLines = [],
  onSelectRobot,
  onNavigateRobots,
}) => {
  const lineMap = useMemo(() => {
    const map = new Map<string, ProductionLine>();
    productionLines.forEach((l) => map.set(l.id, l));
    return map;
  }, [productionLines]);

  // Build the set of robot IDs that have at least one active (unresolved) alert.
  // A robot whose every alert is resolved must NOT appear in this panel even if
  // its physical status column still reads 'offline' / 'attention' / 'maintenance'.
  const robotIdsWithActiveAlerts = useMemo(() => {
    const ids = new Set<string>();
    for (const a of alerts) {
      if (a.status !== 'resolved') {
        ids.add(a.robot_id);
      }
    }
    return ids;
  }, [alerts]);

  // Show only non-operational robots that also have at least one active alert.
  const attentionRobots = useMemo(() => {
    return robots.filter(
      (r) =>
        (r.status?.toLowerCase() === 'attention' ||
          r.status?.toLowerCase() === 'maintenance' ||
          r.status?.toLowerCase() === 'offline') &&
        robotIdsWithActiveAlerts.has(r.id)
    );
  }, [robots, robotIdsWithActiveAlerts]);

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
            <AlertTriangle size={17} style={{ color: 'var(--status-attention-dot)' }} />
            <span>Recent Attention</span>
          </div>
          <div className="card-subtitle">
            Robotic units requiring engineering inspection or service
          </div>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor:
              attentionRobots.length > 0
                ? 'var(--status-attention-bg)'
                : 'var(--status-operational-bg)',
            color:
              attentionRobots.length > 0
                ? 'var(--status-attention-fg)'
                : 'var(--status-operational-fg)',
            border: `1px solid ${
              attentionRobots.length > 0
                ? 'var(--status-attention-border)'
                : 'var(--status-operational-border)'
            }`,
          }}
        >
          {attentionRobots.length} Flagged
        </span>
      </div>

      {/* Content Table or Nominal State */}
      <div style={{ flex: 1, overflowX: 'auto' }}>
        {attentionRobots.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text-muted)',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-operational-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--status-operational-fg)',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
              All Units Operating Nominally
            </div>
            <div style={{ fontSize: '12px' }}>
              No robots in the fleet currently require immediate attention or maintenance.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Robot</th>
                <th>Model / Maker</th>
                <th>Production Line</th>
                <th>Status</th>
                <th>Runtime</th>
                <th style={{ textAlign: 'right' }}>Telemetry</th>
              </tr>
            </thead>
            <tbody>
              {attentionRobots.map((robot) => {
                const line = robot.line_id ? lineMap.get(robot.line_id) : undefined;
                return (
                  <tr
                    key={robot.id}
                    className="clickable"
                    onClick={() => onSelectRobot(robot)}
                  >
                    {/* Robot Name & Serial */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {robot.name}
                        </span>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Hash size={10} />
                          {robot.serial_number}
                        </span>
                      </div>
                    </td>

                    {/* Model & Manufacturer */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{robot.model}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {robot.manufacturer}
                        </span>
                      </div>
                    </td>

                    {/* Production Line */}
                    <td>
                      {line ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 500 }}>{line.name}</span>
                          <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {line.code}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td>
                      <StatusBadge status={robot.status as RobotStatus} />
                    </td>

                    {/* Runtime */}
                    <td>
                      <span className="tabular-nums font-mono" style={{ fontSize: '12px' }}>
                        {formatRuntime(robot.total_runtime_hours)}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-default"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRobot(robot);
                        }}
                      >
                        <span>Inspect</span>
                        <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer link: View All Robots */}
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
          onClick={onNavigateRobots}
          style={{ fontSize: '12.5px', fontWeight: 600 }}
        >
          <span>View All Robots</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
