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
import {
  generateRealisticTelemetrySeries,
  type TelemetryMetricKey,
  type TelemetryPoint,
} from '../../utils/telemetrySmoothing';

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
  robotName,
  latestValue,
  height = 180,
}) => {
  const chartData = useMemo(() => {
    if (!readings || readings.length === 0) return [];
    return generateRealisticTelemetrySeries(readings, metricKey, robotName, 40);
  }, [readings, metricKey, robotName]);

  const latestVal =
    latestValue !== undefined
      ? latestValue
      : chartData.length > 0
      ? chartData[chartData.length - 1].value
      : null;

  // Sparse x-axis ticks
  const xAxisTicks = useMemo(() => {
    if (chartData.length < 2) return [];
    const n = chartData.length;
    const step = Math.ceil(n / 5);
    const indices: number[] = [];
    for (let i = 0; i < n; i += step) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== n - 1) indices.push(n - 1);
    return indices;
  }, [chartData]);

  const yDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto'] as ['auto', 'auto'];
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.08 || 1;
    return [min - pad, max + pad] as [number, number];
  }, [chartData]);

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
              margin={{ top: 8, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="index"
                type="number"
                scale="linear"
                domain={[0, chartData.length - 1]}
                ticks={xAxisTicks}
                tickFormatter={(idx: number) => {
                  const rounded = Math.round(idx);
                  const point = chartData[Math.min(rounded, chartData.length - 1)];
                  return point ? point.formattedTime : '';
                }}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-subtle)' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-subtle)' }}
                width={38}
                domain={yDomain}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                isAnimationActive={false}
                cursor={{
                  stroke: color,
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                  strokeOpacity: 0.5,
                }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload as TelemetryPoint;
                  return (
                    <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', boxShadow: 'var(--shadow-md)', fontSize: '12px', pointerEvents: 'none' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10.5px', marginBottom: '3px' }}>{d.fullTime}</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {title}:{' '}
                        <span className="font-mono tabular-nums" style={{ color }}>
                          {Number(d.value).toFixed(2)} {unit}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4.5,
                  stroke: color,
                  strokeWidth: 2,
                  fill: 'var(--bg-surface)',
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
