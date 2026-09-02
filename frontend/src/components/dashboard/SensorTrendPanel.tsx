import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity, RefreshCw, Cpu, TrendingUp } from 'lucide-react';
import type { Robot } from '../../types/robot';
import type { SensorReading } from '../../types/sensor';
import { fetchRobotReadings } from '../../api/robots';
import {
  generateRealisticTelemetrySeries,
  METRIC_METADATA,
  type TelemetryMetricKey,
  type TelemetryPoint,
} from '../../utils/telemetrySmoothing';

interface SensorTrendPanelProps {
  selectedRobot: Robot | null;
}


export const SensorTrendPanel: React.FC<SensorTrendPanelProps> = ({ selectedRobot }) => {
  const [metric, setMetric] = useState<TelemetryMetricKey>('temperature_c');
  // fetchedRobotId tracks which robot's readings we have loaded
  const [fetchedRobotId, setFetchedRobotId] = useState<string | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const robotId = selectedRobot?.id;

  // loading is true while robotId is set but readings haven't been fetched for it yet
  const loading = Boolean(robotId && fetchedRobotId !== robotId && !loadError);

  useEffect(() => {
    if (!robotId) return;

    let isMounted = true;

    fetchRobotReadings(robotId)
      .then((data) => {
        if (isMounted) {
          setReadings(data);
          setFetchedRobotId(robotId);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Unable to load sensor readings';
          setLoadError(msg);
          setFetchedRobotId(robotId);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [robotId]);

  const error = loadError;

  const currentConfig = METRIC_METADATA[metric];

  // Generate smooth, continuous telemetry series
  const chartData = useMemo(() => {
    if (!selectedRobot || readings.length === 0) return [];
    return generateRealisticTelemetrySeries(readings, metric, selectedRobot.name, 40);
  }, [readings, selectedRobot, metric]);

  const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : null;

  // Stats
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return { min, max, avg };
  }, [chartData]);

  // Use sparse x-axis ticks to avoid clutter
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
    if (!stats) return ['auto', 'auto'] as ['auto', 'auto'];
    const pad = (stats.max - stats.min) * 0.08 || 1;
    return [
      parseFloat((stats.min - pad).toFixed(currentConfig.decimals)),
      parseFloat((stats.max + pad).toFixed(currentConfig.decimals)),
    ];
  }, [stats, currentConfig.decimals]);

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '20px 22px',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '14px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={17} style={{ color: currentConfig.color }} />
            <span>Health &amp; Sensor Telemetry</span>
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {selectedRobot ? (
              <>
                <Cpu size={12} />
                <span>
                  Continuous feed for{' '}
                  <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {selectedRobot.name}
                  </strong>{' '}
                  · {selectedRobot.model}
                </span>
              </>
            ) : (
              <span>Select a robot to view sensor readings</span>
            )}
          </div>
        </div>

        {/* Metric Selector Tabs */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'var(--bg-surface-secondary)',
            padding: '3px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            gap: '2px',
          }}
        >
          {(Object.keys(METRIC_METADATA) as TelemetryMetricKey[]).map((key) => {
            const isSelected = metric === key;
            const item = METRIC_METADATA[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMetric(key)}
                style={{
                  padding: '5px 11px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11.5px',
                  fontWeight: isSelected ? 600 : 500,
                  backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                  boxShadow: isSelected ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.15s ease',
                  border: isSelected ? '1px solid var(--border-subtle)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats bar */}
      {latestValue !== null && stats && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-surface-secondary)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '12px',
            border: '1px solid var(--border-subtle)',
            fontSize: '11.5px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '10.5px' }}>
              Live Value:
            </span>
            <span
              className="tabular-nums font-mono"
              style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              {latestValue.toFixed(currentConfig.decimals)}
            </span>
            <span style={{ fontWeight: 600, color: currentConfig.color }}>
              {currentConfig.unit}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: 'var(--text-secondary)' }}>
            <span>
              Min:{' '}
              <strong className="font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {stats.min.toFixed(currentConfig.decimals)}
              </strong>
            </span>
            <span>
              Avg:{' '}
              <strong className="font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {stats.avg.toFixed(currentConfig.decimals)}
              </strong>
            </span>
            <span>
              Max:{' '}
              <strong className="font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {stats.max.toFixed(currentConfig.decimals)}
              </strong>
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                color: 'var(--status-operational-fg)',
                fontWeight: 500,
              }}
            >
              <TrendingUp size={12} />
              Continuous Sampling
            </span>
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ flex: 1, minHeight: '165px', width: '100%' }}>
        {loading ? (
          <div
            style={{
              height: '165px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            <RefreshCw size={14} className="spin" />
            <span>Loading telemetry stream...</span>
          </div>
        ) : error ? (
          <div
            style={{
              height: '165px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-offline-fg)',
              fontSize: '12px',
              textAlign: 'center',
              padding: '0 20px',
            }}
          >
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div
            style={{
              height: '165px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            No sensor readings logged for this unit.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={175}>
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
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
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                width={38}
                domain={yDomain}
                tickFormatter={(v: number) => v.toFixed(currentConfig.decimals === 0 ? 0 : 1)}
              />
              <Tooltip
                isAnimationActive={false}
                cursor={{
                  stroke: currentConfig.color,
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                  strokeOpacity: 0.5,
                }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload as TelemetryPoint;
                  return (
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', padding: '8px 12px', boxShadow: '0 4px 12px rgba(15,23,42,0.08)', fontSize: '12px', pointerEvents: 'none', minWidth: '160px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '11.5px' }}>{d.robotName || selectedRobot?.name || 'Unit'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{d.formattedTime}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>{currentConfig.label}:</span>
                        <span className="tabular-nums font-mono" style={{ fontWeight: 700, color: currentConfig.color, fontSize: '12.5px' }}>
                          {Number(d.value).toFixed(currentConfig.decimals)}&nbsp;{currentConfig.unit}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={currentConfig.color}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 5,
                  stroke: currentConfig.color,
                  strokeWidth: 2.5,
                  fill: '#ffffff',
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
