import React from 'react';
import { ChevronDown, ExternalLink, Cpu, MapPin, Clock } from 'lucide-react';
import type { Robot, RobotStatus } from '../../types/robot';
import type { ProductionLine } from '../../types/productionLine';
import { StatusBadge } from '../common/StatusBadge';

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
            {/* Robot Arm Industrial Illustration (SVG) */}
            <div
              style={{
                width: '105px',
                height: '115px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg
                width="100"
                height="110"
                viewBox="0 0 100 110"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Base pedestal */}
                <ellipse cx="50" cy="98" rx="36" ry="7" fill="#cbd5e1" />
                <rect x="26" y="86" width="48" height="12" rx="4" fill="#334155" />
                <rect x="30" y="82" width="40" height="6" rx="2" fill="#475569" />
                <circle cx="50" cy="85" r="3" fill="#2563eb" />

                {/* Lower joint & link */}
                <circle cx="50" cy="74" r="10" fill="#1e293b" />
                <circle cx="50" cy="74" r="5" fill="#64748b" />
                <path
                  d="M45 74 L32 44 L42 40 L55 70 Z"
                  fill="#3b82f6"
                  stroke="#1d4ed8"
                  strokeWidth="1.5"
                />

                {/* Elbow joint */}
                <circle cx="37" cy="42" r="9" fill="#1e293b" />
                <circle cx="37" cy="42" r="4" fill="#94a3b8" />

                {/* Forearm link */}
                <path
                  d="M37 42 L68 24 L72 32 L41 50 Z"
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth="1.5"
                />

                {/* Wrist joint & end effector */}
                <circle cx="70" cy="28" r="7" fill="#2563eb" />
                <rect
                  x="72"
                  y="22"
                  width="10"
                  height="12"
                  rx="2"
                  fill="#475569"
                  transform="rotate(25 72 22)"
                />
                {/* Gripper / tool */}
                <path
                  d="M80 19 L88 15 M80 27 L88 31"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
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
