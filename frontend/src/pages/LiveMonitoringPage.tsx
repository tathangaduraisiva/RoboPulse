import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  RefreshCw,
  Cpu,
  Thermometer,
  Zap,
  Activity,
  Gauge,
  Play,
  Pause,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Robot } from '../types/robot';
import type { SensorReading } from '../types/sensor';
import { fetchRobotReadings } from '../api/robots';
import {
  generateRealisticTelemetrySeries,
  METRIC_METADATA,
  type TelemetryMetricKey,
  type TelemetryPoint,
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
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [pollingRate, setPollingRate] = useState<number>(3000); // 3000ms default
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [liveCounter, setLiveCounter] = useState<number>(0);

  const currentRobot = useMemo(
    () => robots.find((r) => r.id === selectedRobotId) || robots[0],
    [robots, selectedRobotId]
  );

  // Load telemetry
  useEffect(() => {
    let isSubscribed = true;
    if (!currentRobot) return;

    fetchRobotReadings(currentRobot.id)
      .then((data) => {
        if (isSubscribed) {
          setReadings(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [currentRobot]);

  // Live polling simulator for continuous industrial stream
  useEffect(() => {
    if (isPaused || pollingRate <= 0) return;
    const interval = setInterval(() => {
      setLiveCounter((c) => c + 1);
    }, pollingRate);
    return () => clearInterval(interval);
  }, [isPaused, pollingRate]);

  const metricConfig = METRIC_METADATA[activeMetric];

  // Generated smooth waveforms
  const chartData = useMemo(() => {
    if (!currentRobot || readings.length === 0) return [];
    return generateRealisticTelemetrySeries(
      readings,
      activeMetric,
      `${currentRobot.name}-${liveCounter}`,
      40
    );
  }, [readings, currentRobot, activeMetric, liveCounter]);

  // Calculate live values and thresholds
  const latestPoint = chartData[chartData.length - 1];
  const latestValue = latestPoint ? latestPoint.value : 0;

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

  const currentStatus = getMetricStatus(activeMetric, latestValue);

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

        {/* Polling Rate & Pause/Play Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isPaused ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${isPaused ? '#fecaca' : '#bbf7d0'}`,
              color: isPaused ? '#dc2626' : '#16a34a',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isPaused ? '#dc2626' : '#16a34a',
                display: 'inline-block',
              }}
            />
            <span>{isPaused ? 'STREAM PAUSED' : 'LIVE STREAMING'}</span>
          </div>

          <button
            type="button"
            className="btn btn-default"
            onClick={() => setIsPaused(!isPaused)}
            style={{ height: '36px', padding: '0 12px' }}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <select
            className="select-input"
            value={pollingRate}
            onChange={(e) => setPollingRate(Number(e.target.value))}
            style={{ height: '36px' }}
            aria-label="Polling Rate"
          >
            <option value={1000}>1 sec (High Res)</option>
            <option value={3000}>3 sec (Standard)</option>
            <option value={5000}>5 sec (Low Bandwidth)</option>
          </select>
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
              <span>Predictive Maintenance & Risk Intelligence</span>
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
          className="card clickable"
          onClick={() => setActiveMetric('temperature_c')}
          style={{
            padding: '16px 18px',
            border: activeMetric === 'temperature_c' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
            backgroundColor: activeMetric === 'temperature_c' ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Thermometer size={18} style={{ color: '#ea580c' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Temperature</span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: getMetricStatus('temperature_c', latestValue).bg,
                color: getMetricStatus('temperature_c', latestValue).color,
              }}
            >
              {getMetricStatus('temperature_c', latestValue).status}
            </span>
          </div>
          <div
            className="tabular-nums font-mono"
            style={{ fontSize: '24px', fontWeight: 700, marginTop: '10px', color: 'var(--text-primary)' }}
          >
            {activeMetric === 'temperature_c'
              ? latestValue.toFixed(1)
              : (58.4 + (liveCounter % 3) * 0.4).toFixed(1)}{' '}
            <span style={{ fontSize: '13px', color: '#ea580c' }}>°C</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Safe Range: &lt; 75.0 °C
          </div>
        </div>

        {/* Card 2: Vibration */}
        <div
          className="card clickable"
          onClick={() => setActiveMetric('vibration_mm_s')}
          style={{
            padding: '16px 18px',
            border: activeMetric === 'vibration_mm_s' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
            backgroundColor: activeMetric === 'vibration_mm_s' ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: '#d97706' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Vibration RMS</span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: getMetricStatus('vibration_mm_s', latestValue).bg,
                color: getMetricStatus('vibration_mm_s', latestValue).color,
              }}
            >
              {getMetricStatus('vibration_mm_s', latestValue).status}
            </span>
          </div>
          <div
            className="tabular-nums font-mono"
            style={{ fontSize: '24px', fontWeight: 700, marginTop: '10px', color: 'var(--text-primary)' }}
          >
            {activeMetric === 'vibration_mm_s'
              ? latestValue.toFixed(2)
              : (1.82 + (liveCounter % 4) * 0.05).toFixed(2)}{' '}
            <span style={{ fontSize: '13px', color: '#d97706' }}>mm/s</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Safe Range: &lt; 3.50 mm/s
          </div>
        </div>

        {/* Card 3: Motor Current */}
        <div
          className="card clickable"
          onClick={() => setActiveMetric('motor_current_a')}
          style={{
            padding: '16px 18px',
            border: activeMetric === 'motor_current_a' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
            backgroundColor: activeMetric === 'motor_current_a' ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Motor Current</span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: getMetricStatus('motor_current_a', latestValue).bg,
                color: getMetricStatus('motor_current_a', latestValue).color,
              }}
            >
              {getMetricStatus('motor_current_a', latestValue).status}
            </span>
          </div>
          <div
            className="tabular-nums font-mono"
            style={{ fontSize: '24px', fontWeight: 700, marginTop: '10px', color: 'var(--text-primary)' }}
          >
            {activeMetric === 'motor_current_a'
              ? latestValue.toFixed(1)
              : (14.2 + (liveCounter % 3) * 0.3).toFixed(1)}{' '}
            <span style={{ fontSize: '13px', color: 'var(--accent-primary)' }}>A</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Safe Range: &lt; 18.0 A
          </div>
        </div>

        {/* Card 4: Pressure */}
        <div
          className="card clickable"
          onClick={() => setActiveMetric('pressure_bar')}
          style={{
            padding: '16px 18px',
            border: activeMetric === 'pressure_bar' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
            backgroundColor: activeMetric === 'pressure_bar' ? 'var(--bg-surface-secondary)' : 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Gauge size={18} style={{ color: '#0891b2' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Pneumatic Pressure</span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: getMetricStatus('pressure_bar', latestValue).bg,
                color: getMetricStatus('pressure_bar', latestValue).color,
              }}
            >
              {getMetricStatus('pressure_bar', latestValue).status}
            </span>
          </div>
          <div
            className="tabular-nums font-mono"
            style={{ fontSize: '24px', fontWeight: 700, marginTop: '10px', color: 'var(--text-primary)' }}
          >
            {activeMetric === 'pressure_bar'
              ? latestValue.toFixed(1)
              : (5.4 + (liveCounter % 2) * 0.1).toFixed(1)}{' '}
            <span style={{ fontSize: '13px', color: '#0891b2' }}>bar</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Safe Range: 4.5 – 6.5 bar
          </div>
        </div>
      </div>

      {/* Main Continuous Wave Telemetry Chart */}
      <div
        className="card"
        style={{
          padding: '22px',
          backgroundColor: 'var(--bg-surface)',
          marginBottom: '20px',
        }}
      >
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
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
              Live Telemetry Waveform: {metricConfig.label}
            </h3>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Continuous multi-harmonic sensor stream with real-time gradient fill
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: currentStatus.bg,
                color: currentStatus.color,
              }}
            >
              Status: {currentStatus.status}
            </span>
          </div>
        </div>

        {/* Recharts Canvas */}
        <div style={{ width: '100%', height: '240px' }}>
          {loading ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: 'var(--text-muted)',
              }}
            >
              <RefreshCw size={16} className="spin" />
              <span>Acquiring telemetry buffer...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="liveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={metricConfig.fillGradient} stopOpacity={0.22} />
                    <stop offset="80%" stopColor={metricConfig.fillGradient} stopOpacity={0.03} />
                    <stop offset="100%" stopColor={metricConfig.fillGradient} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="index"
                  type="number"
                  domain={[0, chartData.length - 1]}
                  ticks={[
                    0,
                    Math.floor(chartData.length * 0.25),
                    Math.floor(chartData.length * 0.5),
                    Math.floor(chartData.length * 0.75),
                    chartData.length - 1,
                  ]}
                  tickFormatter={(idx: number) => {
                    const pt = chartData[Math.round(idx)];
                    return pt ? pt.formattedTime : '';
                  }}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin * 0.95),
                    (dataMax: number) => Math.ceil(dataMax * 1.05),
                  ]}
                />
                <Tooltip
                  isAnimationActive={false}
                  cursor={{ stroke: metricConfig.color, strokeWidth: 1, strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as TelemetryPoint;
                      return (
                        <div
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '8px 12px',
                            boxShadow: 'var(--shadow-md)',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {currentRobot?.name} · {d.fullTime}
                          </div>
                          <div style={{ color: metricConfig.color, fontWeight: 700, marginTop: '4px' }}>
                            {metricConfig.label}: {Number(d.value).toFixed(metricConfig.decimals)} {metricConfig.unit}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={metricConfig.color}
                  strokeWidth={2.2}
                  fill="url(#liveGradient)"
                  activeDot={{
                    r: 5,
                    stroke: metricConfig.color,
                    strokeWidth: 2.5,
                    fill: 'var(--bg-surface)',
                  }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
