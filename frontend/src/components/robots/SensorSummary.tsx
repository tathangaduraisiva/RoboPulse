import React from 'react';
import { Thermometer, Activity, Zap, Gauge } from 'lucide-react';
import type { SensorReading } from '../../types/sensor';

interface SensorSummaryProps {
  readings: SensorReading[];
}

export const SensorSummary: React.FC<SensorSummaryProps> = ({ readings }) => {
  if (readings.length === 0) return null;

  // Latest reading is the first element if ordered DESC or last if ASC; find the latest by recorded_at
  const sorted = [...readings].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );
  const latest = sorted[0];

  const calculateStats = (key: keyof SensorReading) => {
    const values = readings.map((r) => Number(r[key])).filter((v) => !isNaN(v));
    if (values.length === 0) return { min: 0, max: 0, avg: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    return { min, max, avg };
  };

  const tempStats = calculateStats('temperature_c');
  const vibStats = calculateStats('vibration_mm_s');
  const currentStats = calculateStats('motor_current_a');
  const pressureStats = calculateStats('pressure_bar');

  const metrics = [
    {
      label: 'Core Temperature',
      key: 'temperature_c',
      value: Number(latest.temperature_c),
      unit: '°C',
      icon: <Thermometer size={16} />,
      color: '#ea580c',
      stats: tempStats,
    },
    {
      label: 'Vibration Velocity',
      key: 'vibration_mm_s',
      value: Number(latest.vibration_mm_s),
      unit: 'mm/s',
      icon: <Activity size={16} />,
      color: '#d97706',
      stats: vibStats,
    },
    {
      label: 'Motor Current',
      key: 'motor_current_a',
      value: Number(latest.motor_current_a),
      unit: 'A',
      icon: <Zap size={16} />,
      color: '#2563eb',
      stats: currentStats,
    },
    {
      label: 'Hydraulic Pressure',
      key: 'pressure_bar',
      value: Number(latest.pressure_bar),
      unit: 'bar',
      icon: <Gauge size={16} />,
      color: '#0891b2',
      stats: pressureStats,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
      }}
    >
      {metrics.map((m) => (
        <div
          key={m.label}
          className="card"
          style={{
            padding: '14px 16px',
            borderLeft: `3px solid ${m.color}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {m.label}
            </span>
            <span style={{ color: m.color, display: 'flex' }}>{m.icon}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              className="tabular-nums font-mono"
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {m.value.toFixed(2)}
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-muted)',
              }}
            >
              {m.unit}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginTop: '8px',
              paddingTop: '6px',
              borderTop: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>Min: {m.stats.min.toFixed(1)}</span>
            <span>Avg: {m.stats.avg.toFixed(1)}</span>
            <span>Max: {m.stats.max.toFixed(1)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
