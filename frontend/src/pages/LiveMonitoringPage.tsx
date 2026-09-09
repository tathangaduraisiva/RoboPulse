import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  Cpu,
  Thermometer,
  Zap,
  Activity,
  Gauge,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Robot } from '../types/robot';
import type { SensorReading } from '../types/sensor';
import { fetchSensorReadings } from '../api/sensors';
import {
  METRIC_METADATA,
  type TelemetryMetricKey,
} from '../utils/telemetrySmoothing';

interface LiveMonitoringPageProps {
  robots: Robot[];
  onSelectRobot: (robot: Robot) => void;
}

export const LiveMonitoringPage: React.FC<LiveMonitoringPageProps> = ({
  robots,
  onSelectRobot,
}) => {
  const navigate = useNavigate();
  const [selectedRobotId, setSelectedRobotId] = useState<string>(robots[0]?.id || '');
  const [activeMetric, setActiveMetric] = useState<TelemetryMetricKey>('temperature_c');
  const [hoveredMetric, setHoveredMetric] = useState<TelemetryMetricKey | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SENSOR_POLL_MS = 2000;

  const currentRobot = useMemo(
    () => robots.find((r) => r.id === selectedRobotId) || robots[0],
    [robots, selectedRobotId]
  );

  // Live polling — same pattern as the Overview graph.
  // Clears and restarts whenever the selected robot changes.
  useEffect(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!currentRobot?.id) {
      setReadings([]);
      return;
    }

    const robotId = currentRobot.id;
    let active = true;
    setLoading(true);
    setSensorError(null);

    const readingsRef = { current: [] as SensorReading[] };

    const fetchAndMerge = (forceRefresh: boolean) => {
      fetchSensorReadings(robotId, forceRefresh)
        .then((data) => {
          if (!active) return;
          const incoming = Array.isArray(data) ? data : [];
          const prev = readingsRef.current;
          if (prev.length === 0) {
            readingsRef.current = incoming;
            setReadings(incoming);
            setLoading(false);
            setSensorError(null);
            return;
          }
          const existingIds = new Set(prev.map((r) => r.id));
          const newOnes = incoming.filter((r) => !existingIds.has(r.id));
          if (newOnes.length === 0) return;
          const merged = [...prev, ...newOnes].sort(
            (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );
          readingsRef.current = merged;
          setReadings(merged);
          setLoading(false);
          setSensorError(null);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setReadings([]);
          setSensorError(err instanceof Error ? err.message : 'Sensor telemetry unavailable');
          setLoading(false);
        });
    };

    fetchAndMerge(false);
    intervalRef.current = setInterval(() => fetchAndMerge(true), SENSOR_POLL_MS);

    return () => {
      active = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRobot?.id]);

  const metricConfig = METRIC_METADATA[activeMetric];

  // Same chartData shape as Overview: last 40 points, val field, fullTimestamp for tooltip.
  const chartData = useMemo(() => {
    if (readings.length === 0) return [];
    const sorted = [...readings].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
    const points = sorted.length > 40 ? sorted.slice(-40) : sorted;
    return points.map((reading) => {
      const dateObj = new Date(reading.recorded_at);
      const isValidDate = !Number.isNaN(dateObj.getTime());
      const formattedTime = isValidDate
        ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        : 'Live';
      const fullTimestamp = isValidDate
        ? `${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
        : 'Recent';
      return {
        ...reading,
        formattedTime,
        fullTimestamp,
        val: Number(reading[activeMetric] ?? 0),
      };
    });
  }, [readings, activeMetric]);

  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;

  const getMetricStatus = (key: TelemetryMetricKey, val: number) => {
    switch (key) {
      case 'temperature_c':
        if (val > 80) return { status: 'Critical', color: '#dc2626', bg: '#fee2e2' };
        if (val > 65) return { status: 'Warning', color: '#d97706', bg: '#fef3c7' };
        return { status: 'Normal', color: '#16a34a', bg: '#f0fdf4' };
      case 'vibration_mm_s':
        if (val > 4.5) return { status: 'Critical', color: '#dc2626', bg: '#fee2e2' };
        if (val > 2.8) return { status: 'Warning', color: '#d97706', bg: '#fef3c7' };
        return { status: 'Normal', color: '#16a34a', bg: '#f0fdf4' };
      case 'motor_current_a':
        if (val > 22) return { status: 'Critical', color: '#dc2626', bg: '#fee2e2' };
        if (val > 16) return { status: 'Warning', color: '#d97706', bg: '#fef3c7' };
        return { status: 'Normal', color: '#16a34a', bg: '#f0fdf4' };
      case 'pressure_bar':
      default:
        if (val < 4.0 || val > 7.0) return { status: 'Critical', color: '#dc2626', bg: '#fee2e2' };
        if (val < 4.6 || val > 6.4) return { status: 'Warning', color: '#d97706', bg: '#fef3c7' };
        return { status: 'Normal', color: '#16a34a', bg: '#f0fdf4' };
    }
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Radio size={20} style={{ color: '#2563eb' }} />
            <span>Live Industrial Telemetry Stream</span>
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            High-frequency sensor acquisition, real-time threshold validation, and wave telemetry
          </p>
        </div>
      </div>

      {/* Robot Selection Banner */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Cpu size={22} />
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              ACTIVE TARGET MACHINE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <select
                className="select-input"
                value={selectedRobotId}
                onChange={(e) => setSelectedRobotId(e.target.value)}
                style={{ fontSize: '14px', fontWeight: 700, padding: '4px 28px 4px 8px' }}
                aria-label="Select Machine for Live Monitoring"
              >
                {robots.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.model} (SN: {r.serial_number})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {currentRobot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/predictions')}
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Sparkles size={14} />
              <span>Predictive Maintenance &amp; Risk Intelligence</span>
            </button>

            <button
              type="button"
              className="btn btn-default"
              onClick={() => onSelectRobot(currentRobot)}
              style={{ fontSize: '12px' }}
            >
              <Sliders size={14} />
              <span>Full Diagnostics</span>
            </button>
          </div>
        )}
      </div>

      {/* 4 Sensor Telemetry Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        {/* Card 1: Temperature */}
        <div
          className="card clickable card-interactive"
          onClick={() => setActiveMetric('temperature_c')}
          onMouseEnter={() => setHoveredMetric('temperature_c')}
          onMouseLeave={() => setHoveredMetric(null)}
          style={{
            padding: '16px 18px',
            border: activeMetric === 'temperature_c'
              ? '2px solid var(--accent-primary)'
              : hoveredMetric === 'temperature_c'
              ? '1px solid var(--border-default)'
              : '1px solid var(--border-subtle)',
            backgroundColor: activeMetric === 'temperature_c'
              ? 'var(--bg-surface-secondary)'
              : hoveredMetric === 'temperature_c'
              ? 'var(--bg-surface-hover)'
              : 'var(--bg-surface)',
            boxShadow: hoveredMetric === 'temperature_c' && activeMetric !== 'temperature_c'
              ? 'var(--shadow-md)'
              : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Thermometer size={18} style={{ color: '#ea580c' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Temperature</span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--radius-xs)', backgroundColor: getMetricStatus('temperature_c', latestReading ? Number(latestReading.temperature_c) : 0).bg, color: getMetricStatus('temperature_c', latestReading ? Number(latestReading.temperature_c) : 0).color }}>
              {getMetricStatus('temperature_c', latestReading ? Number(latestReading.temperature_c) : 0).status}
            </span>
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: '24px', fontWeight: 700, marginTop: '10px', color: 'var(--text-primary)' }}>
            {latestReading ? Number(latestReading.temperature_c).toFixed(1) : '—'}{' '}
            <span style={{ fontSize: '13px', color: '#ea580c' }}>°C</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Safe Range: &lt; 75.0 °C</div>
        </div>

        {/* Card 2: Vibration */}
        <div
          className="card clickable card-interactive"
          onClick={() => setActiveMetric('vibration_mm_s')}
          onMouseEnter={() => setHoveredMetric('vibration_mm_s')}
          onMouseLeave={() => setHoveredMetric(null)}
          style={{
            padding: '16px 18px',
            border: activeMetric === 'vibration_mm_s'
              ? '2px solid var(--accent-primary)'
              : hoveredMetric === 'vibration_mm_s'
              ? '1px solid var(--border-default)'
              : '1px solid var(--border-subtle)',
            backgroundColor: activeMetric === 'vibration_mm_s'
              ? 'var(--bg-surface-secondary)'
              : hoveredMetric === 'vibration_mm_s'
              ? 'var(--bg-surface-hover)'
              : 'var(--bg-surface)',
            boxShadow: hoveredMetric === 'vibration_mm_s' && activeMetric !== 'vibration_mm_s'
              ? 'var(--shadow-md)'
              : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: '#d97706' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Vibration RMS</span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--radius-xs)', backgroundColor: getMetricStatus('vibration_mm_s', latestReading ? Number(latestReading.vibration_mm_s) : 0).bg, color: getMetricStatus('vibration_mm_s', latestReading ? Number(latestReading.vibration_mm_s) : 0).color }}>
              {getMetricStatus('vibration_mm_s', latestReading ? Number(latestReading.vibration_mm_s) : 0).status}
            </span>
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: '24px', fontWeight: 700, marginTop: '10px', color: 'var(--text-primary)' }}>
            {latestReading ? Number(latestReading.vibration_mm_s).toFixed(2) : '—'}{' '}
            <span style={{ fontSize: '13px', color: '#d97706' }}>mm/s</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Safe Range: &lt; 3.50 mm/s</div>
        </div>

        {/* Card 3: Motor Current */}
        <div
          className="card clickable card-interactive"
          onClick={() => setActiveMetric('motor_current_a')}
          onMouseEnter={() => setHoveredMetric('motor_current_a')}
          onMouseLeave={() => setHoveredMetric(null)}
          style={{
            padding: '16px 18px',
            border: activeMetric === 'motor_current_a'
              ? '2px solid var(--accent-primary)'
              : hoveredMetric === 'motor_current_a'
              ? '1px solid var(--border-default)'
              : '1px solid var(--border-subtle)',
            backgroundColor: activeMetric === 'motor_current_a'
              ? 'var(--bg-surface-secondary)'
              : hoveredMetric === 'motor_current_a'
              ? 'var(--bg-surface-hover)'
              : 'var(--bg-surface)',
            boxShadow: hoveredMetric === 'motor_current_a' && activeMetric !== 'motor_current_a'
              ? 'var(--shadow-md)'
              : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Motor Current</span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--radius-xs)', backgroundColor: getMetricStatus('motor_current_a', latestReading ? Number(latestReading.motor_current_a) : 0).bg, color: getMetricStatus('motor_current_a', latestReading ? Number(latestReading.motor_current_a) : 0).color }}>
              {getMetricStatus('motor_current_a', latestReading ? Number(latestReading.motor_current_a) : 0).status}
            </span>
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: '24px', fontWeight: 700, marginTop: '10px', color: 'var(--text-primary)' }}>
            {latestReading ? Number(latestReading.motor_current_a).toFixed(1) : '—'}{' '}
            <span style={{ fontSize: '13px', color: 'var(--accent-primary)' }}>A</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Safe Range: &lt; 18.0 A</div>
        </div>

        {/* Card 4: Pressure */}
        <div
          className="card clickable card-interactive"
          onClick={() => setActiveMetric('pressure_bar')}
          onMouseEnter={() => setHoveredMetric('pressure_bar')}
          onMouseLeave={() => setHoveredMetric(null)}
          style={{
            padding: '16px 18px',
            border: activeMetric === 'pressure_bar'
              ? '2px solid var(--accent-primary)'
              : hoveredMetric === 'pressure_bar'
              ? '1px solid var(--border-default)'
              : '1px solid var(--border-subtle)',
            backgroundColor: activeMetric === 'pressure_bar'
              ? 'var(--bg-surface-secondary)'
              : hoveredMetric === 'pressure_bar'
              ? 'var(--bg-surface-hover)'
              : 'var(--bg-surface)',
            boxShadow: hoveredMetric === 'pressure_bar' && activeMetric !== 'pressure_bar'
              ? 'var(--shadow-md)'
              : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Gauge size={18} style={{ color: '#0891b2' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Pneumatic Pressure</span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--radius-xs)', backgroundColor: getMetricStatus('pressure_bar', latestReading ? Number(latestReading.pressure_bar) : 0).bg, color: getMetricStatus('pressure_bar', latestReading ? Number(latestReading.pressure_bar) : 0).color }}>
              {getMetricStatus('pressure_bar', latestReading ? Number(latestReading.pressure_bar) : 0).status}
            </span>
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: '24px', fontWeight: 700, marginTop: '10px', color: 'var(--text-primary)' }}>
            {latestReading ? Number(latestReading.pressure_bar).toFixed(1) : '—'}{' '}
            <span style={{ fontSize: '13px', color: '#0891b2' }}>bar</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Safe Range: 4.5 – 6.5 bar</div>
        </div>
      </div>

      {/* Main Telemetry Chart — same design as Overview */}
      <div className="card" style={{ padding: '20px 22px', marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Sensor Telemetry Trend
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              {currentRobot ? `${currentRobot.name} (${currentRobot.serial_number})` : 'Select a robot to view telemetry stream'}
            </p>
          </div>

          {/* Metric selector tabs — same style as Overview */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: 'var(--bg-surface-secondary)',
              padding: '3px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {(['temperature_c', 'vibration_mm_s', 'motor_current_a', 'pressure_bar'] as TelemetryMetricKey[]).map((key) => {
              const isActive = activeMetric === key;
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
                  onClick={() => setActiveMetric(key)}
                  className={`telemetry-tab-btn ${metricClass} ${isActive ? 'active' : ''}`}
                >
                  <span className="telemetry-tab-dot" />
                  <span>{METRIC_METADATA[key].label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {loading && chartData.length === 0 ? (
          <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-sm)' }} />
          </div>
        ) : chartData.length === 0 ? (
          <div
            style={{
              height: '200px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
              gap: '8px',
            }}
          >
            <span>Sensor telemetry unavailable</span>
            {sensorError && (
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>({sensorError})</span>
            )}
          </div>
        ) : (
          <div style={{ height: '260px', width: '100%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 16, right: 28, left: 10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="recorded_at"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  padding={{ left: 16, right: 16 }}
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
                  unit={` ${metricConfig.unit}`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  isAnimationActive={false}
                  wrapperStyle={{ pointerEvents: 'none', outline: 'none', zIndex: 50 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0];
                      const val = typeof item.value === 'number'
                        ? item.value.toFixed(metricConfig.decimals)
                        : item.value;
                      const timestamp = item.payload?.fullTimestamp || item.payload?.formattedTime || 'Recent';
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
                            minWidth: '170px',
                            pointerEvents: 'none',
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>
                            {metricConfig.label}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                            <span
                              className="font-mono tabular-nums"
                              style={{ fontSize: '20px', fontWeight: 700, color: metricConfig.color }}
                            >
                              {val}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {metricConfig.unit}
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
                  name={metricConfig.label}
                  stroke={metricConfig.color}
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: metricConfig.color, stroke: 'var(--bg-surface)', strokeWidth: 1 }}
                  activeDot={{ r: 6, fill: metricConfig.color, stroke: '#ffffff', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
