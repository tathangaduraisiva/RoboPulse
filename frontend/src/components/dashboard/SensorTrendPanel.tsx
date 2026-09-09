import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity, RefreshCw, Cpu, Thermometer, Zap, Gauge } from 'lucide-react';
import type { Robot } from '../../types/robot';
import type { SensorReading } from '../../types/sensor';
import { fetchRobotReadings } from '../../api/robots';
import {
  METRIC_METADATA,
  type TelemetryMetricKey,
} from '../../utils/telemetrySmoothing';

const POLL_INTERVAL_MS = 2000;
// Maximum number of readings kept in the rolling window.
// 1 reading every 2 s × 3 600 s = 1 800 — keeps a full rolling hour in memory.
const MAX_WINDOW = 1800;

/** A single chart point derived directly from a real SensorReading row. */
interface ChartPoint {
  /** Numeric timestamp (ms) — used as the X-axis data key for linear scale. */
  timestamp: number;
  /** ISO string of the real recorded_at from PostgreSQL. */
  recorded_at: string;
  /** HH:MM label shown on the X-axis ticks. */
  formattedTime: string;
  /** Full label shown in the tooltip. */
  fullTime: string;
  /** The metric value for this reading. */
  value: number;
  /** Robot name forwarded to the tooltip. */
  robotName?: string;
}

/** Map a SensorReading to a ChartPoint for the given metric. */
function toChartPoint(
  reading: SensorReading,
  metricKey: TelemetryMetricKey,
  robotName?: string
): ChartPoint {
  const dateObj = new Date(reading.recorded_at);
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');
  const formattedTime = `${hh}:${mm}`;
  const fullTime = dateObj.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return {
    timestamp: dateObj.getTime(),
    recorded_at: reading.recorded_at,
    formattedTime,
    fullTime,
    value: Number(reading[metricKey]) || 0,
    robotName,
  };
}

// ─── Per-metric visual config for the dark theme ─────────────────────────────
const METRIC_STYLE: Record<
  TelemetryMetricKey,
  { stroke: string; gradientTop: string; gradientBot: string; icon: React.ReactNode }
> = {
  temperature_c: {
    stroke:      '#60a5fa',
    gradientTop: 'rgba(96,165,250,0.35)',
    gradientBot: 'rgba(96,165,250,0.02)',
    icon: <Thermometer size={14} />,
  },
  vibration_mm_s: {
    stroke:      '#fbbf24',
    gradientTop: 'rgba(251,191,36,0.35)',
    gradientBot: 'rgba(251,191,36,0.02)',
    icon: <Activity size={14} />,
  },
  motor_current_a: {
    stroke:      '#a78bfa',
    gradientTop: 'rgba(167,139,250,0.35)',
    gradientBot: 'rgba(167,139,250,0.02)',
    icon: <Zap size={14} />,
  },
  pressure_bar: {
    stroke:      '#34d399',
    gradientTop: 'rgba(52,211,153,0.35)',
    gradientBot: 'rgba(52,211,153,0.02)',
    icon: <Gauge size={14} />,
  },
};

interface SensorTrendPanelProps {
  selectedRobot: Robot | null;
}

export const SensorTrendPanel: React.FC<SensorTrendPanelProps> = ({ selectedRobot }) => {
  const [metric, setMetric] = useState<TelemetryMetricKey>('temperature_c');
  const [fetchedRobotId, setFetchedRobotId] = useState<string | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const robotId = selectedRobot?.id;
  const loading = Boolean(robotId && fetchedRobotId !== robotId && !loadError);

  // Initial load + 2-second polling — identical logic to the original component.
  useEffect(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!robotId) return;

    let isMounted = true;
    const readingsRef = { current: [] as SensorReading[] };

    const fetchAndMerge = (forceRefresh: boolean) => {
      fetchRobotReadings(robotId, forceRefresh)
        .then((data) => {
          if (!isMounted) return;

          if (data.length > 0) {
            const newestTs = data.reduce(
              (best, r) => (new Date(r.recorded_at).getTime() > new Date(best).getTime() ? r.recorded_at : best),
              data[0].recorded_at
            );
            console.log(`[Telemetry Poll] robot=${robotId} latest=${newestTs}`);
          }

          const prev = readingsRef.current;
          if (prev.length === 0) {
            const sorted = [...data].sort(
              (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
            );
            const windowed = sorted.length > MAX_WINDOW ? sorted.slice(-MAX_WINDOW) : sorted;
            readingsRef.current = windowed;
            setReadings(windowed);
            setFetchedRobotId(robotId);
            setLoadError(null);
            return;
          }

          const existingIds = new Set(prev.map((r) => r.id));
          const newOnes = data.filter((r) => !existingIds.has(r.id));
          if (newOnes.length === 0) return;

          const merged = [...prev, ...newOnes].sort(
            (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );
          const windowed = merged.length > MAX_WINDOW ? merged.slice(-MAX_WINDOW) : merged;
          readingsRef.current = windowed;
          setReadings(windowed);
          setFetchedRobotId(robotId);
          setLoadError(null);
        })
        .catch((err: unknown) => {
          if (!isMounted) return;
          setLoadError(err instanceof Error ? err.message : 'Unable to load sensor readings');
          setFetchedRobotId(robotId);
        });
    };

    fetchAndMerge(false);
    intervalRef.current = setInterval(() => { fetchAndMerge(true); }, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [robotId]);

  const currentConfig = METRIC_METADATA[metric];
  const style = METRIC_STYLE[metric];

  const chartData = useMemo((): ChartPoint[] => {
    if (readings.length === 0) return [];
    return readings.map((r) => toChartPoint(r, metric, selectedRobot?.name));
  }, [readings, metric, selectedRobot?.name]);

  const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : null;

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return { min, max, avg };
  }, [chartData]);

  // X-axis: show a tick every 5 minutes instead of every hour so short windows
  // always have at least a few labels (matches the screenshot's 08:00…08:05 style).
  const xAxisTicks = useMemo(() => {
    if (chartData.length < 2) return [];
    const firstTs = chartData[0].timestamp;
    const lastTs  = chartData[chartData.length - 1].timestamp;
    const FIVE_MIN_MS = 5 * 60 * 1000;

    // Round up to the next 5-minute boundary
    const startTick = Math.ceil(firstTs / FIVE_MIN_MS) * FIVE_MIN_MS;
    const ticks: number[] = [];
    for (let t = startTick; t <= lastTs; t += FIVE_MIN_MS) {
      ticks.push(t);
    }
    if (ticks.length === 0) {
      ticks.push(Math.round((firstTs + lastTs) / 2));
    }
    return ticks;
  }, [chartData]);

  const yDomain = useMemo(() => {
    if (!stats) return ['auto', 'auto'] as ['auto', 'auto'];
    const pad = (stats.max - stats.min) * 0.12 || 1;
    return [
      parseFloat((stats.min - pad).toFixed(currentConfig.decimals)),
      parseFloat((stats.max + pad).toFixed(currentConfig.decimals)),
    ];
  }, [stats, currentConfig.decimals]);

  const gradientId = `trendGradient-${metric}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '20px 24px 16px',
        backgroundColor: '#0f172a',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {/* Title + subtitle */}
        <div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#f1f5f9',
              letterSpacing: '-0.01em',
            }}
          >
            Sensor Telemetry Trend
          </div>
          <div
            style={{
              fontSize: '11.5px',
              color: '#64748b',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            {selectedRobot ? (
              <>
                <Cpu size={11} style={{ color: '#475569' }} />
                <span>
                  {selectedRobot.name}{' '}
                  <span style={{ color: '#475569' }}>({selectedRobot.serial_number})</span>
                </span>
              </>
            ) : (
              <span>Select a robot to view sensor readings</span>
            )}
          </div>
        </div>

        {/* Metric selector — pill-style matching the screenshot */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: '8px',
            padding: '3px',
            gap: '3px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {(Object.keys(METRIC_METADATA) as TelemetryMetricKey[]).map((key) => {
            const isSelected = metric === key;
            const ms = METRIC_STYLE[key];
            const metricClass =
              key === 'temperature_c'
                ? 'telemetry-tab-btn--temp'
                : key === 'vibration_mm_s'
                ? 'telemetry-tab-btn--vib'
                : key === 'motor_current_a'
                ? 'telemetry-tab-btn--curr'
                : 'telemetry-tab-btn--press';
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMetric(key)}
                className={`telemetry-tab-btn ${metricClass} ${isSelected ? 'active' : ''}`}
              >
                <span className="telemetry-tab-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {ms.icon}
                </span>
                <span>{METRIC_METADATA[key].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      {latestValue !== null && stats && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '12px',
            fontSize: '11.5px',
            color: '#64748b',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Live
            </span>
            <span
              className="tabular-nums font-mono"
              style={{ fontSize: '20px', fontWeight: 700, color: style.stroke, lineHeight: 1 }}
            >
              {latestValue.toFixed(currentConfig.decimals)}
            </span>
            <span style={{ color: style.stroke, fontWeight: 600 }}>{currentConfig.unit}</span>
          </div>
          <span style={{ color: '#334155' }}>|</span>
          <span>
            Min&nbsp;
            <strong className="font-mono tabular-nums" style={{ color: '#94a3b8' }}>
              {stats.min.toFixed(currentConfig.decimals)}
            </strong>
          </span>
          <span>
            Avg&nbsp;
            <strong className="font-mono tabular-nums" style={{ color: '#94a3b8' }}>
              {stats.avg.toFixed(currentConfig.decimals)}
            </strong>
          </span>
          <span>
            Max&nbsp;
            <strong className="font-mono tabular-nums" style={{ color: '#94a3b8' }}>
              {stats.max.toFixed(currentConfig.decimals)}
            </strong>
          </span>
        </div>
      )}

      {/* ── Chart ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: '200px', width: '100%' }}>
        {loading ? (
          <div
            style={{
              height: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#475569',
              fontSize: '12px',
            }}
          >
            <RefreshCw size={14} className="spin" />
            <span>Loading telemetry stream…</span>
          </div>
        ) : loadError ? (
          <div
            style={{
              height: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              fontSize: '12px',
              textAlign: 'center',
              padding: '0 20px',
            }}
          >
            {loadError}
          </div>
        ) : chartData.length === 0 ? (
          <div
            style={{
              height: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              fontSize: '12px',
            }}
          >
            No sensor readings logged for this unit.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
            >
              {/* Gradient fill beneath the line */}
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={style.gradientTop} />
                  <stop offset="100%" stopColor={style.gradientBot} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="4 6"
                stroke="rgba(148,163,184,0.10)"
                vertical={false}
              />

              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                ticks={xAxisTicks}
                tickFormatter={(ts: number) => {
                  const d = new Date(ts);
                  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                }}
                tick={{ fontSize: 10, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                tick={{ fontSize: 10, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
                width={42}
                domain={yDomain}
                tickFormatter={(v: number) =>
                  `${v.toFixed(currentConfig.decimals === 0 ? 0 : 1)} ${currentConfig.unit}`
                }
              />

              {/* Tooltip — preserves the real backend timestamp and value */}
              <Tooltip
                isAnimationActive={false}
                cursor={{
                  stroke: style.stroke,
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                  strokeOpacity: 0.6,
                }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload as ChartPoint;
                  return (
                    <div
                      style={{
                        backgroundColor: '#1e293b',
                        border: `1px solid ${style.stroke}44`,
                        borderRadius: '8px',
                        padding: '9px 13px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        fontSize: '12px',
                        pointerEvents: 'none',
                        minWidth: '168px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          marginBottom: '6px',
                          borderBottom: '1px solid rgba(148,163,184,0.12)',
                          paddingBottom: '6px',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '11.5px' }}>
                          {d.robotName || selectedRobot?.name || 'Unit'}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '10px' }}>{d.fullTime}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>{currentConfig.label}:</span>
                        <span
                          className="tabular-nums font-mono"
                          style={{ fontWeight: 700, color: style.stroke, fontSize: '13px' }}
                        >
                          {Number(d.value).toFixed(currentConfig.decimals)}&nbsp;{currentConfig.unit}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke={style.stroke}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: style.stroke,
                  strokeWidth: 2,
                  fill: '#0f172a',
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
