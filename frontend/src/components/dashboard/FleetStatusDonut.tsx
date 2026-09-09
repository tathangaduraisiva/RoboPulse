import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Robot } from '../../types/robot';

interface FleetStatusDonutProps {
  robots: Robot[];
  onNavigateRobots?: () => void;
}

interface FleetStatusTooltipPayloadEntry {
  name: string;
  value: number;
  payload: {
    name: string;
    value: number;
    color: string;
  };
}

interface FleetStatusTooltipProps {
  active?: boolean;
  payload?: FleetStatusTooltipPayloadEntry[];
}

const FleetStatusTooltip: React.FC<FleetStatusTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div
        style={{
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: `1px solid ${data.payload.color || 'var(--border-subtle, #cbd5e1)'}`,
          borderRadius: '8px',
          padding: '5px 10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: data.payload.color,
            display: 'inline-block',
          }}
        />
        <span style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{data.name}:</span>
        <span className="font-mono tabular-nums" style={{ fontWeight: 700, color: data.payload.color }}>
          {data.value} {Number(data.value) === 1 ? 'machine' : 'machines'}
        </span>
      </div>
    );
  }
  return null;
};

export const FleetStatusDonut: React.FC<FleetStatusDonutProps> = ({
  robots,
}) => {
  const totalRobots = robots.length;

  const counts = React.useMemo(() => {
    const healthy = robots.filter((r) => r.status?.toLowerCase() === 'operational').length;
    const warning = robots.filter((r) => r.status?.toLowerCase() === 'attention').length;
    const maintenance = robots.filter((r) => r.status?.toLowerCase() === 'maintenance').length;
    const critical = robots.filter((r) => r.status?.toLowerCase() === 'offline').length;
    return { healthy, warning, maintenance, critical };
  }, [robots]);

  const chartData = [
    { name: 'Healthy', value: counts.healthy, color: '#16a34a' },
    { name: 'Warning', value: counts.warning, color: '#f59e0b' },
    { name: 'Critical', value: counts.critical, color: '#dc2626' },
    { name: 'Maintenance', value: counts.maintenance, color: '#9333ea' },
  ].filter((item) => item.value > 0);

  const getPercentage = (count: number) => {
    if (totalRobots === 0) return '0%';
    return `${Math.round((count / totalRobots) * 100)}%`;
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Machines by Status
        </h3>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Operational health distribution across all active lines
        </div>
      </div>

      {/* Donut & Legend Container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flex: 1,
        }}
      >
        {/* Donut Chart */}
        <div
          style={{
            width: '130px',
            height: '130px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {totalRobots > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={<FleetStatusTooltip />}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 40, pointerEvents: 'none' }}
                    position={{ y: -8 }}
                  />
                  <Pie
                    data={chartData}
                    innerRadius={46}
                    outerRadius={62}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Total Count inside Donut */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  lineHeight: 1.1,
                }}
              >
                <span
                  className="tabular-nums font-mono"
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {totalRobots}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  Total
                </span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No data</div>
          )}
        </div>

        {/* Legend Breakdown on Right */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '12.5px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Healthy</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className="tabular-nums font-mono" style={{ fontWeight: 600 }}>{counts.healthy}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({getPercentage(counts.healthy)})</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Warning</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className="tabular-nums font-mono" style={{ fontWeight: 600 }}>{counts.warning}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({getPercentage(counts.warning)})</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Critical</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className="tabular-nums font-mono" style={{ fontWeight: 600 }}>{counts.critical}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({getPercentage(counts.critical)})</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#9333ea' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Maintenance</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className="tabular-nums font-mono" style={{ fontWeight: 600 }}>{counts.maintenance}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({getPercentage(counts.maintenance)})</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: '14px' }} />
    </div>
  );
};
