import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  RefreshCw,
  Calendar,
  Clock,
  Hash,
  Factory,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { Robot, RobotStatus } from '../../types/robot';
import type { SensorReading } from '../../types/sensor';
import type { ProductionLine } from '../../types/productionLine';
import { fetchSensorReadings } from '../../api/sensors';
import { StatusBadge } from '../common/StatusBadge';
import { RobotAvatar } from '../common/RobotAvatar';
import { SensorChart } from './SensorChart';
import { SensorSummary } from './SensorSummary';
import { ErrorState, EmptyState } from '../common/FeedbackStates';

interface RobotDetailsModalProps {
  robot: Robot | null;
  onClose: () => void;
  productionLines?: ProductionLine[];
}

export const RobotDetailsModal: React.FC<RobotDetailsModalProps> = ({
  robot,
  onClose,
  productionLines = [],
}) => {
  const navigate = useNavigate();
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live polling — same pattern as Overview and LiveMonitoringPage.
  // Clears and restarts whenever the robot changes (or modal opens/closes).
  useEffect(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!robot) return;

    const robotId = robot.id;
    let active = true;
    setLoading(true);
    setError(null);

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
            setError(null);
            setLoading(false);
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
          setError(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : 'Failed to retrieve sensor readings');
          setLoading(false);
        });
    };

    fetchAndMerge(false);
    intervalRef.current = setInterval(() => fetchAndMerge(true), 2000);

    return () => {
      active = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robot?.id]);

  // Manual refresh: force-fetch and let the merge logic handle deduplication.
  const handleRefreshReadings = useCallback(() => {
    if (!robot) return;
    fetchSensorReadings(robot.id, true)
      .then((data) => {
        if (!Array.isArray(data)) return;
        setReadings((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newOnes = data.filter((r) => !existingIds.has(r.id));
          if (newOnes.length === 0) return prev;
          return [...prev, ...newOnes].sort(
            (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );
        });
      })
      .catch(() => {/* silent — polling will retry */});
  }, [robot]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!robot) return null;

  const assignedLine = robot.line_id
    ? productionLines.find((l) => l.id === robot.line_id)
    : null;

  const formatRuntime = (hours: number | string) => {
    const num = typeof hours === 'number' ? hours : parseFloat(hours) || 0;
    return `${num.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} hrs`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="robot-modal-title"
    >
      <div className="modal-container">
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                backgroundColor: 'var(--accent-surface)',
                border: '1px solid var(--accent-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                padding: '4px',
              }}
            >
              <RobotAvatar
                robot={robot}
                productionLines={productionLines}
                size={46}
                showGlow
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2
                  id="robot-modal-title"
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  {robot.name}
                </h2>
                <StatusBadge status={robot.status as RobotStatus} />
              </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginTop: '6px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Cpu size={13} style={{ color: 'var(--text-muted)' }} />
                <span>
                  {robot.manufacturer} · {robot.model}
                </span>
              </span>

              <span
                className="font-mono"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                <span>SN: {robot.serial_number}</span>
              </span>

              {assignedLine && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Factory size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>
                    {assignedLine.name} ({assignedLine.code})
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

          {/* Actions: Refresh, Predictions, & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-default"
              onClick={() => {
                onClose();
                navigate('/predictions');
              }}
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              title="View predictive risk intelligence"
            >
              <Sparkles size={13} style={{ color: 'var(--accent-primary)' }} />
              <span>Predictive Intelligence</span>
            </button>

            <button
              type="button"
              className="btn btn-default"
              onClick={handleRefreshReadings}
              disabled={loading}
              title="Refresh telemetry readings"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span>Refresh Readings</span>
            </button>

            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              aria-label="Close telemetry panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: 'var(--bg-app)',
          }}
        >
          {/* Hardware & Installation Specs Card */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Manufacturer & Model
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginTop: '2px',
                }}
              >
                {robot.manufacturer} {robot.model}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Serial Number
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginTop: '2px',
                }}
              >
                {robot.serial_number}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Installation Date
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                {formatDate(robot.installation_date)}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Total Runtime Hours
              </div>
              <div
                className="tabular-nums font-mono"
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                {formatRuntime(robot.total_runtime_hours)}
              </div>
            </div>
          </div>

          {/* Sensor Telemetry Section Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  margin: 0,
                }}
              >
                <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
                Sensor Telemetry & Time-Series History
              </h3>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginTop: '2px',
                }}
              >
                Last {readings.length} recorded telemetry samples from onboard sensors
              </p>
            </div>
          </div>

          {/* Feedback states or Charts */}
          {loading && readings.length === 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '16px',
              }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card" style={{ padding: '20px', height: '220px' }}>
                  <div className="skeleton" style={{ height: '14px', width: '30%', marginBottom: '16px' }} />
                  <div className="skeleton" style={{ height: '140px', width: '100%' }} />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState
              title="Unable to Load Sensor Readings"
              message={error}
              onRetry={handleRefreshReadings}
              isRetrying={loading}
            />
          ) : readings.length === 0 ? (
            <EmptyState
              title="No Sensor Readings Recorded"
              message="No telemetry readings have been logged for this robot yet in the database."
            />
          ) : (
            <>
              {/* Summary KPIs */}
              <SensorSummary readings={readings} />

              {/* 4 Recharts Time-Series Charts Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                  gap: '16px',
                }}
              >
                <SensorChart
                  title="Temperature Trend"
                  metricKey="temperature_c"
                  unit="°C"
                  color="#ea580c"
                  readings={readings}
                  robotName={robot.name}
                  height={190}
                />

                <SensorChart
                  title="Vibration Velocity"
                  metricKey="vibration_mm_s"
                  unit="mm/s"
                  color="#d97706"
                  readings={readings}
                  robotName={robot.name}
                  height={190}
                />

                <SensorChart
                  title="Motor Current Load"
                  metricKey="motor_current_a"
                  unit="A"
                  color="#2563eb"
                  readings={readings}
                  robotName={robot.name}
                  height={190}
                />

                <SensorChart
                  title="Hydraulic / Pneumatic Pressure"
                  metricKey="pressure_bar"
                  unit="bar"
                  color="#0891b2"
                  readings={readings}
                  robotName={robot.name}
                  height={190}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
