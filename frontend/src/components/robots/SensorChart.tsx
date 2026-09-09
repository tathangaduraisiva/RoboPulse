import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SensorReading } from '../../types/sensor';
import type { TelemetryMetricKey } from '../../utils/telemetrySmoothing';

interface SensorChartProps {
  title: string;
  metricKey: TelemetryMetricKey;
  unit: string;
  color: string;
  readings: SensorReading[];
  robotName?: string;
  latestValue?: number;
  height?: number;
}

export const SensorChart: React.FC<SensorChartProps> = ({
  title,
  metricKey,
  unit,
  color,
  readings,
  latestValue,
  height = 180,
}) => {
  // Same chartData shape as Overview: last 40 points, oldest→newest,
  // with formattedTime / fullTimestamp / val fields.
  const chartData = useMemo(() => {
    if (!readings || readings.length === 0) return [];
    const sorted = [...readings].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
    const points = sorted.length > 40 ? sorted.slice(-40) : sorted;
    return points.map((r) => {
      const d = new Date(r.recorded_at);
      const isValid = !Number.isNaN(d.getTime());
      return {
        ...r,
        formattedTime: isValid
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
          : 'Live',
        fullTimestamp: isValid
          ? `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
          : 'Recent',
        val: Number(r[metricKey] ?? 0),
      };
    });
  }, [readings, metricKey]);

  const latestVal =
    latestValue !== undefined
      ? latestValue
      : chartData.length > 0
      ? chartData[chartData.length - 1].val
      : null;

  return (
    <div
      className="card"
      style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <h4
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            margin: 0,
          }}
        >
          {title}
        </h4>

        {latestVal !== null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              className="tabular-nums font-mono"
              style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              {typeof latestVal === 'number' ? latestVal.toFixed(2) : latestVal}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color }}>
              {unit}
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      {chartData.length === 0 ? (
        <div
          style={{
            height: `${height}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
            backgroundColor: 'var(--bg-surface-secondary)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          No telemetry points recorded
        </div>
      ) : (
        <div style={{ width: '100%', height: `${height}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="recorded_at"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-subtle)' }}
                padding={{ left: 8, right: 8 }}
                minTickGap={45}
                tickFormatter={(val: string) => {
                  const d = new Date(val);
                  if (Number.isNaN(d.getTime())) return '';
                  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                }}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-subtle)' }}
                unit={` ${unit}`}
                domain={['auto', 'auto']}
                width={42}
              />
              <Tooltip
                isAnimationActive={false}
                wrapperStyle={{ pointerEvents: 'none', outline: 'none', zIndex: 50 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0];
                    const v = typeof item.value === 'number'
                      ? item.value.toFixed(2)
                      : item.value;
                    const timestamp =
                      item.payload?.fullTimestamp ||
                      item.payload?.formattedTime ||
                      'Recent';
                    return (
                      <div
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 14px',
                          boxShadow: 'var(--shadow-lg)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          minWidth: '160px',
                          pointerEvents: 'none',
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>
                          {title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                          <span
                            className="font-mono tabular-nums"
                            style={{ fontSize: '20px', fontWeight: 700, color }}
                          >
                            {v}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {unit}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '5px' }}>
                          {timestamp}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
                cursor={{ stroke: 'var(--accent-primary)', strokeWidth: 1.5, strokeDasharray: '3 3' }}
              />
              <Line
                type="monotone"
                dataKey="val"
                name={title}
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: color, stroke: 'var(--bg-surface)', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: color, stroke: '#ffffff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
