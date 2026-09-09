import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Activity, CheckCircle2, AlertTriangle, Wrench, Radio } from 'lucide-react';
import type { Robot } from '../types/robot';
import type { ProductionLine } from '../types/productionLine';
import { RobotTable } from '../components/dashboard/RobotTable';
import { RobotAvatar } from '../components/common/RobotAvatar';
import { TableSkeleton, ErrorState } from '../components/common/FeedbackStates';

interface RobotsPageProps {
  robots: Robot[];
  productionLines: ProductionLine[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectRobot: (robot: Robot) => void;
}

export const RobotsPage: React.FC<RobotsPageProps> = ({
  robots,
  productionLines,
  loading,
  error,
  onRetry,
  onSelectRobot,
}) => {
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const operational = robots.filter((r) => r.status.toLowerCase() === 'operational').length;
    const attention = robots.filter((r) => r.status.toLowerCase() === 'attention').length;
    const maintenance = robots.filter((r) => ['maintenance', 'offline'].includes(r.status.toLowerCase())).length;
    return {
      total: robots.length,
      operational,
      attention,
      maintenance,
    };
  }, [robots]);

  if (error && robots.length === 0) {
    return (
      <ErrorState
        title="Fleet Registry Unavailable"
        message={error}
        onRetry={onRetry}
        isRetrying={loading}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Fleet Hero Banner */}
      <div
        className="card"
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--accent-surface) 100%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg, 12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              border: '2px solid var(--accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.15)',
              flexShrink: 0,
            }}
          >
            <RobotAvatar colorTheme="blue" size={64} showGlow />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Robotic Fleet Registry
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: 'var(--accent-surface)',
                  color: 'var(--accent-primary)',
                  border: '1px solid var(--accent-border)',
                }}
              >
                <Radio size={12} className="animate-pulse" />
                {stats.total} Total Units
              </span>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                margin: '6px 0 0 0',
                maxWidth: '620px',
                lineHeight: 1.5,
              }}
            >
              Complete industrial robotics inventory, real-time sensor telemetry streaming, and predictive health monitoring across production facilities.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/predictions')}
            style={{
              height: '40px',
              padding: '0 16px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Sparkles size={16} />
            <span>Predictive Intelligence</span>
          </button>
        </div>
      </div>

      {/* Scoped Hover Styles for Fleet Summary Stats Cards */}
      <style>{`
        .fleet-stat-card {
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md, 10px);
          cursor: default;
          transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1),
                      box-shadow 220ms cubic-bezier(0.4, 0, 0.2, 1),
                      border-color 220ms cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform, box-shadow, border-color;
        }

        /* 1. Operational → Green hover glow & border */
        .fleet-stat-card--operational {
          border-left: 4px solid var(--status-operational-fg);
        }
        .fleet-stat-card--operational:hover {
          transform: translateY(-2px);
          border-color: var(--status-operational-border);
          border-left: 4px solid var(--status-operational-fg);
          box-shadow: 0 6px 18px -4px rgba(22, 163, 74, 0.22), 0 2px 6px -1px rgba(22, 163, 74, 0.12);
        }
        [data-theme="dark"] .fleet-stat-card--operational:hover,
        .dark .fleet-stat-card--operational:hover {
          border-color: rgba(74, 222, 128, 0.45);
          border-left: 4px solid var(--status-operational-fg);
          box-shadow: 0 6px 20px -3px rgba(74, 222, 128, 0.24), 0 0 12px 0 rgba(74, 222, 128, 0.12);
        }

        /* 2. Needs Attention → Amber/Orange hover glow & border */
        .fleet-stat-card--attention {
          border-left: 4px solid var(--status-attention-fg);
        }
        .fleet-stat-card--attention:hover {
          transform: translateY(-2px);
          border-color: var(--status-attention-border);
          border-left: 4px solid var(--status-attention-fg);
          box-shadow: 0 6px 18px -4px rgba(217, 119, 6, 0.22), 0 2px 6px -1px rgba(217, 119, 6, 0.12);
        }
        [data-theme="dark"] .fleet-stat-card--attention:hover,
        .dark .fleet-stat-card--attention:hover {
          border-color: rgba(251, 191, 36, 0.45);
          border-left: 4px solid var(--status-attention-fg);
          box-shadow: 0 6px 20px -3px rgba(251, 191, 36, 0.24), 0 0 12px 0 rgba(251, 191, 36, 0.12);
        }

        /* 3. Maintenance / Offline → Purple hover glow & border */
        .fleet-stat-card--maintenance {
          border-left: 4px solid var(--status-maintenance-fg);
        }
        .fleet-stat-card--maintenance:hover {
          transform: translateY(-2px);
          border-color: var(--status-maintenance-border);
          border-left: 4px solid var(--status-maintenance-fg);
          box-shadow: 0 6px 18px -4px rgba(147, 51, 234, 0.22), 0 2px 6px -1px rgba(147, 51, 234, 0.12);
        }
        [data-theme="dark"] .fleet-stat-card--maintenance:hover,
        .dark .fleet-stat-card--maintenance:hover {
          border-color: rgba(192, 132, 252, 0.45);
          border-left: 4px solid var(--status-maintenance-fg);
          box-shadow: 0 6px 20px -3px rgba(192, 132, 252, 0.24), 0 0 12px 0 rgba(192, 132, 252, 0.12);
        }

        /* 4. Active Lines → Blue hover glow & border */
        .fleet-stat-card--lines {
          border-left: 4px solid var(--accent-primary);
        }
        .fleet-stat-card--lines:hover {
          transform: translateY(-2px);
          border-color: var(--accent-border);
          border-left: 4px solid var(--accent-primary);
          box-shadow: 0 6px 18px -4px rgba(37, 99, 235, 0.22), 0 2px 6px -1px rgba(37, 99, 235, 0.12);
        }
        [data-theme="dark"] .fleet-stat-card--lines:hover,
        .dark .fleet-stat-card--lines:hover {
          border-color: rgba(96, 165, 250, 0.45);
          border-left: 4px solid var(--accent-primary);
          box-shadow: 0 6px 20px -3px rgba(59, 130, 246, 0.24), 0 0 12px 0 rgba(59, 130, 246, 0.12);
        }
      `}</style>

      {/* Fleet Summary Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        <div className="card fleet-stat-card fleet-stat-card--operational">
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Operational
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {stats.operational}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'var(--status-operational-bg)',
              color: 'var(--status-operational-fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="card fleet-stat-card fleet-stat-card--attention">
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Needs Attention
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {stats.attention}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'var(--status-attention-bg)',
              color: 'var(--status-attention-fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={18} />
          </div>
        </div>

        <div className="card fleet-stat-card fleet-stat-card--maintenance">
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Maintenance / Offline
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {stats.maintenance}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'var(--status-maintenance-bg)',
              color: 'var(--status-maintenance-fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wrench size={18} />
          </div>
        </div>

        <div className="card fleet-stat-card fleet-stat-card--lines">
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Lines
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {productionLines.length}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-surface)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Activity size={18} />
          </div>
        </div>
      </div>

      {loading && robots.length === 0 ? (
        <TableSkeleton rows={8} cols={6} />
      ) : (
        <RobotTable
          robots={robots}
          productionLines={productionLines}
          onSelectRobot={onSelectRobot}
          showFilters={true}
        />
      )}
    </div>
  );
};
