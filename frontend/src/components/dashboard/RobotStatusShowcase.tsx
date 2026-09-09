import React from 'react';
import { ChevronDown, ExternalLink, Cpu, MapPin, Clock } from 'lucide-react';
import type { Robot, RobotStatus } from '../../types/robot';
import type { ProductionLine } from '../../types/productionLine';
import { StatusBadge } from '../common/StatusBadge';
import { RobotAvatar } from '../common/RobotAvatar';

interface RobotStatusShowcaseProps {
  robots: Robot[];
  selectedRobot: Robot | null;
  onSelectRobot: (robot: Robot) => void;
  productionLines?: ProductionLine[];
  onOpenDetails: (robot: Robot) => void;
}

export const RobotStatusShowcase: React.FC<RobotStatusShowcaseProps> = ({
  robots,
  selectedRobot,
  onSelectRobot,
  productionLines = [],
  onOpenDetails,
}) => {
  const currentRobot = selectedRobot || (robots.length > 0 ? robots[0] : null);

  const assignedLine = currentRobot?.line_id
    ? productionLines.find((l) => l.id === currentRobot.line_id)
    : null;

  const formatRuntime = (hours: number | string | undefined) => {
    if (hours === undefined) return '0 hrs';
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
        padding: '20px 22px',
        position: 'relative',
      }}
    >
      {/* Top Header with title & robot switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Robot Status
        </div>

        {/* Robot quick switcher selector */}
        {robots.length > 0 && currentRobot && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              className="select-input"
              value={currentRobot.id}
              onChange={(e) => {
                const found = robots.find((r) => r.id === e.target.value);
                if (found) onSelectRobot(found);
              }}
              style={{
                fontSize: '12px',
                padding: '4px 26px 4px 10px',
                fontWeight: 600,
                color: 'var(--accent-primary)',
                backgroundColor: 'var(--accent-surface)',
                borderColor: 'var(--accent-border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {robots.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.model})
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              style={{
                position: 'absolute',
                right: '8px',
                color: 'var(--accent-primary)',
                pointerEvents: 'none',
              }}
            />
          </div>
        )}
      </div>

      {!currentRobot ? (
        <div
          style={{
            padding: '30px 10px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}
        >
          No robot telemetry available
        </div>
      ) : (
        <>
          {/* Middle Graphic & Info Showcase */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              margin: '8px 0 16px',
            }}
          >
            {/* Robot Image Showcase */}
            <div
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '16px',
                backgroundColor: 'var(--accent-surface)',
                border: '1px solid var(--accent-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.12)',
                flexShrink: 0,
              }}
            >
              <RobotAvatar
                robot={currentRobot}
                productionLines={productionLines}
                size={76}
                showGlow
              />
            </div>

            {/* Quick Specs metadata */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Robot ID
              </div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                {currentRobot.name}
              </div>

              <div style={{ marginTop: '6px' }}>
                <StatusBadge status={currentRobot.status as RobotStatus} />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  marginTop: '8px',
                }}
              >
                <MapPin size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={assignedLine ? `${assignedLine.name} (${assignedLine.code})` : 'Unassigned'}
                >
                  {assignedLine ? assignedLine.name : 'Unassigned Line'}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  marginTop: '4px',
                }}
              >
                <Cpu size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span>
                  {currentRobot.manufacturer} {currentRobot.model}
                </span>
              </div>
            </div>
          </div>

          {/* Runtime Bar & Action */}
          <div
            style={{
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Runtime:</span>
              <span
                className="tabular-nums font-mono"
                style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                {formatRuntime(currentRobot.total_runtime_hours)}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => onOpenDetails(currentRobot)}
              style={{
                fontSize: '12px',
                padding: '5px 12px',
                fontWeight: 600,
              }}
            >
              <span>View Details</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
