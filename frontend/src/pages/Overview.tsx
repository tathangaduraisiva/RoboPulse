import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CircleAlert,
  Clock3,
  Factory,
  ShieldCheck,
  Wrench,
  Activity,
  Thermometer,
  Zap,
  Gauge,
  Sparkles,
  Eye,
  RefreshCw,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import type { Robot, RobotStatus } from '../types/robot';
import type { ProductionLine } from '../types/productionLine';
import type { Alert } from '../types/alert';
import type { MaintenanceTask } from '../types/maintenance';
import type { PredictionInsight } from '../types/prediction';
import type { SensorReading } from '../types/sensor';
import { fetchSensorReadings } from '../api/sensors';
import { StatusBadge } from '../components/common/StatusBadge';

interface OverviewProps {
  robots: Robot[];
  productionLines: ProductionLine[];
  alerts: Alert[];
  maintenance: MaintenanceTask[];
  predictions: PredictionInsight[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectRobot: (robot: Robot) => void;
  onNavigateTo: (path: string) => void;
}

type MetricKey = 'temperature_c' | 'vibration_mm_s' | 'motor_current_a' | 'pressure_bar';

const METRIC_CONFIG: Record<MetricKey, { label: string; unit: string; color: string; decimals: number }> = {
  temperature_c: { label: 'Temperature', unit: '°C', color: '#ea580c', decimals: 1 },
  vibration_mm_s: { label: 'Vibration', unit: 'mm/s', color: '#0ea5e9', decimals: 2 },
  motor_current_a: { label: 'Motor Current', unit: 'A', color: '#8b5cf6', decimals: 1 },
  pressure_bar: { label: 'Pressure', unit: 'bar', color: '#10b981', decimals: 1 },
};

const formatDate = (value: string | undefined | null) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
};

const formatRuntime = (hours: number | string | undefined) => {
  const numeric = typeof hours === 'number' ? hours : Number(hours) || 0;
  return `${numeric.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} hrs`;
};

const getMetricStatus = (metric: MetricKey, value: number) => {
  switch (metric) {
    case 'temperature_c':
      if (value > 80) return { label: 'Critical', color: '#dc2626', bg: 'var(--status-offline-bg)' };
      if (value > 65) return { label: 'Elevated', color: '#d97706', bg: 'var(--status-attention-bg)' };
      return { label: 'Normal', color: '#16a34a', bg: 'var(--status-operational-bg)' };
    case 'vibration_mm_s':
      if (value > 4.5) return { label: 'Critical', color: '#dc2626', bg: 'var(--status-offline-bg)' };
      if (value > 2.8) return { label: 'Elevated', color: '#d97706', bg: 'var(--status-attention-bg)' };
      return { label: 'Normal', color: '#16a34a', bg: 'var(--status-operational-bg)' };
    case 'motor_current_a':
      if (value > 22) return { label: 'Critical', color: '#dc2626', bg: 'var(--status-offline-bg)' };
      if (value > 16) return { label: 'Elevated', color: '#d97706', bg: 'var(--status-attention-bg)' };
      return { label: 'Normal', color: '#16a34a', bg: 'var(--status-operational-bg)' };
    case 'pressure_bar':
      if (value < 4.0 || value > 7.0) return { label: 'Critical', color: '#dc2626', bg: 'var(--status-offline-bg)' };
      if (value < 4.6 || value > 6.4) return { label: 'Elevated', color: '#d97706', bg: 'var(--status-attention-bg)' };
      return { label: 'Normal', color: '#16a34a', bg: 'var(--status-operational-bg)' };
    default:
      return { label: 'Normal', color: '#16a34a', bg: 'var(--status-operational-bg)' };
  }
};

interface FleetHealthTooltipPayloadEntry {
  name: string;
  value: number;
  payload: {
    name: string;
    value: number;
    color: string;
  };
}

interface FleetHealthTooltipProps {
  active?: boolean;
  payload?: FleetHealthTooltipPayloadEntry[];
}

const FleetHealthTooltip: React.FC<FleetHealthTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: `1px solid ${data.payload.color || 'var(--border-subtle)'}`,
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
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{data.name}:</span>
        <span className="font-mono tabular-nums" style={{ fontWeight: 700, color: data.payload.color }}>
          {data.value} {Number(data.value) === 1 ? 'machine' : 'machines'}
        </span>
      </div>
    );
  }
  return null;
};

export const Overview: React.FC<OverviewProps> = ({
  robots = [],
  productionLines = [],
  alerts = [],
  loading = false,
  error = null,
  onRetry,
  onSelectRobot,
  onNavigateTo,
}) => {
  const navigate = useNavigate();
  const [selectedRobotId, setSelectedRobotId] = useState<string>('');
  const [sensorMetric, setSensorMetric] = useState<MetricKey>('temperature_c');
  const [sensorReadings, setSensorReadings] = useState<SensorReading[]>([]);
  const [sensorLoading, setSensorLoading] = useState<boolean>(false);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const sensorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SENSOR_POLL_MS = 2000;

  // Set initial selected robot when robots arrive
  useEffect(() => {
    if (robots.length > 0 && (!selectedRobotId || !robots.some((r) => r.id === selectedRobotId))) {
      setSelectedRobotId(robots[0].id);
    }
  }, [robots, selectedRobotId]);

  // Fetch real sensor readings for the selected robot, polling every 2 000 ms.
  // When the selected robot changes, the previous interval is cleared automatically.
  useEffect(() => {
    // Clear any running interval for the previous robot.
    if (sensorIntervalRef.current !== null) {
      clearInterval(sensorIntervalRef.current);
      sensorIntervalRef.current = null;
    }

    if (!selectedRobotId) {
      setSensorReadings([]);
      return;
    }

    let active = true;
    setSensorLoading(true);
    setSensorError(null);

    // Local mirror so the interval closure always sees current readings.
    const readingsRef = { current: [] as SensorReading[] };

    const fetchAndMerge = (forceRefresh: boolean) => {
      fetchSensorReadings(selectedRobotId, forceRefresh)
        .then((data) => {
          if (!active) return;
          const incoming = Array.isArray(data) ? data : [];
          const prev = readingsRef.current;
          if (prev.length === 0) {
            // Sort ascending (oldest → newest) on first load so sensorReadings[last]
            // is always the most-recent reading regardless of backend return order.
            const sorted = [...incoming].sort(
              (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
            );
            readingsRef.current = sorted;
            setSensorReadings(sorted);
            setSensorLoading(false);
            setSensorError(null);
            return;
          }
          // Deduplicate by id — only add genuinely new readings.
          const existingIds = new Set(prev.map((r) => r.id));
          const newOnes = incoming.filter((r) => !existingIds.has(r.id));
          if (newOnes.length === 0) return; // nothing new — graph stays unchanged
          const merged = [...prev, ...newOnes].sort(
            (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );
          readingsRef.current = merged;
          setSensorReadings(merged);
          setSensorLoading(false);
          setSensorError(null);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setSensorReadings([]);
          setSensorError(err instanceof Error ? err.message : 'Sensor telemetry unavailable');
          setSensorLoading(false);
        });
    };

    fetchAndMerge(false);

    // Start exactly one 2-second polling interval for the selected robot.
    sensorIntervalRef.current = setInterval(() => {
      fetchAndMerge(true); // force-refresh bypasses the short client-side cache
    }, SENSOR_POLL_MS);

    return () => {
      active = false;
      if (sensorIntervalRef.current !== null) {
        clearInterval(sensorIntervalRef.current);
        sensorIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRobotId]);

  // Map of production lines for quick lookup by line_id
  const lineMap = useMemo(() => {
    const map = new Map<string, ProductionLine>();
    if (Array.isArray(productionLines)) {
      productionLines.forEach((line) => map.set(line.id, line));
    }
    return map;
  }, [productionLines]);

  // Dynamic KPI counts from real robots
  const statusCounts = useMemo(() => {
    const counts = {
      operational: 0,
      attention: 0,
      maintenance: 0,
      offline: 0,
    };
    if (Array.isArray(robots)) {
      robots.forEach((r) => {
        const s = (r.status || 'operational').toLowerCase() as RobotStatus;
        if (s in counts) {
          counts[s] += 1;
        } else {
          counts.operational += 1;
        }
      });
    }
    return counts;
  }, [robots]);

  const totalRobots = robots.length;
  const operationalPercent = totalRobots > 0 ? Math.round((statusCounts.operational / totalRobots) * 100) : 0;

  const fleetHealthData = useMemo(() => [
    { name: 'Operational', value: statusCounts.operational, color: '#16a34a' },
    { name: 'Attention', value: statusCounts.attention, color: '#d97706' },
    { name: 'Maintenance', value: statusCounts.maintenance, color: '#9333ea' },
    { name: 'Offline', value: statusCounts.offline, color: '#dc2626' },
  ], [statusCounts]);

  const selectedRobot = useMemo(
    () => robots.find((r) => r.id === selectedRobotId) ?? robots[0] ?? null,
    [robots, selectedRobotId]
  );

  // Time-series chart formatting (Oldest -> Newest left-to-right)
  const chartData = useMemo(() => {
    if (!sensorReadings || sensorReadings.length === 0) return [];
    // Sort ascending by time (oldest -> newest)
    const sorted = [...sensorReadings].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
    // Use historical readings (up to 40 data points)
    const points = sorted.length > 40 ? sorted.slice(-40) : sorted;
    return points.map((reading) => {
      const dateObj = new Date(reading.recorded_at);
      const isValidDate = !Number.isNaN(dateObj.getTime());
      const timeStr = isValidDate
        ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        : 'Live';
      const fullTimestampStr = isValidDate
        ? `${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
        : 'Recent';

      return {
        ...reading,
        formattedTime: timeStr,
        fullTimestamp: fullTimestampStr,
        val: Number(reading[sensorMetric] ?? 0),
      };
    });
  }, [sensorReadings, sensorMetric]);

  // Set of robot IDs that have at least one ACTIVE (unresolved) alert.
  // Used to determine which robots genuinely need attention right now.
  const robotIdsWithActiveAlerts = useMemo(() => {
    const ids = new Set<string>();
    if (Array.isArray(alerts)) {
      for (const a of alerts) {
        if (a.status !== 'resolved') {
          ids.add(a.robot_id);
        }
      }
    }
    return ids;
  }, [alerts]);

  // Robots requiring attention: must have at least one active (unresolved) alert.
  // A robot whose only alerts are all resolved is removed from this list even if
  // its physical status column still says 'offline'/'attention'/'maintenance'.
  const attentionRobots = useMemo(() => {
    return robots.filter(
      (r) =>
        (r.status === 'attention' || r.status === 'maintenance' || r.status === 'offline') &&
        robotIdsWithActiveAlerts.has(r.id)
    );
  }, [robots, robotIdsWithActiveAlerts]);

  // Recent alerts — only unresolved ones, newest first, capped at 5.
  // Resolved alerts are never shown in the Overview "Recent Alerts" panel.
  const recentAlerts = useMemo(() => {
    if (!Array.isArray(alerts)) return [];
    return alerts
      .filter((a) => a.status !== 'resolved')
      .slice(0, 5);
  }, [alerts]);

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Top Title Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
            }}
          >
            Overview
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Fleet health at a glance
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => navigate('/predictions')}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              padding: '7px 12px',
            }}
          >
            <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
            <span>Predictive Intelligence</span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Clock3 size={14} style={{ color: 'var(--text-muted)' }} />
            <span>
              {new Date().toLocaleDateString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Non-blocking API Alert Banner if partial failure occurs */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-attention-bg)',
            border: '1px solid var(--status-attention-border)',
            color: 'var(--status-attention-fg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="btn btn-default"
            style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 5 Dynamic Overview KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
        }}
      >
        {loading && totalRobots === 0 ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="card" style={{ padding: '18px 20px', minHeight: '104px' }}>
              <div className="skeleton" style={{ height: '12px', width: '60%', marginBottom: '12px' }} />
              <div className="skeleton" style={{ height: '28px', width: '40%', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '12px', width: '80%' }} />
            </div>
          ))
        ) : (
          <>
            {/* 1. Total Robots */}
            <div
              className="card card-interactive"
              onClick={() => onNavigateTo('/robots')}
              style={{ padding: '16px 18px', cursor: 'pointer', borderLeft: '4px solid var(--accent-primary)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  TOTAL ROBOTS
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--accent-surface)', color: 'var(--accent-primary)' }}>
                  <Factory size={17} />
                </div>
              </div>
              <div className="font-mono tabular-nums" style={{ marginTop: '12px', fontWeight: 700, fontSize: '28px', color: 'var(--text-primary)', lineHeight: 1 }}>
                {totalRobots}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Registered fleet units
              </div>
            </div>

            {/* 2. Operational */}
            <div
              className="card card-interactive"
              onClick={() => onNavigateTo('/robots')}
              style={{ padding: '16px 18px', cursor: 'pointer', borderLeft: '4px solid #16a34a' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  OPERATIONAL
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--status-operational-bg)', color: '#16a34a' }}>
                  <ShieldCheck size={17} />
                </div>
              </div>
              <div className="font-mono tabular-nums" style={{ marginTop: '12px', fontWeight: 700, fontSize: '28px', color: '#16a34a', lineHeight: 1 }}>
                {statusCounts.operational}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {operationalPercent}% of active fleet
              </div>
            </div>

            {/* 3. Attention */}
            <div
              className="card card-interactive"
              onClick={() => onNavigateTo('/alerts')}
              style={{ padding: '16px 18px', cursor: 'pointer', borderLeft: '4px solid #d97706' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ATTENTION
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--status-attention-bg)', color: '#d97706' }}>
                  <AlertTriangle size={17} />
                </div>
              </div>
              <div className="font-mono tabular-nums" style={{ marginTop: '12px', fontWeight: 700, fontSize: '28px', color: '#d97706', lineHeight: 1 }}>
                {statusCounts.attention}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Elevated telemetry alert
              </div>
            </div>

            {/* 4. Maintenance */}
            <div
              className="card card-interactive"
              onClick={() => onNavigateTo('/maintenance')}
              style={{ padding: '16px 18px', cursor: 'pointer', borderLeft: '4px solid #9333ea' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  MAINTENANCE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--status-maintenance-bg)', color: '#9333ea' }}>
                  <Wrench size={17} />
                </div>
              </div>
              <div className="font-mono tabular-nums" style={{ marginTop: '12px', fontWeight: 700, fontSize: '28px', color: '#9333ea', lineHeight: 1 }}>
                {statusCounts.maintenance}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Under service review
              </div>
            </div>

            {/* 5. Offline */}
            <div
              className="card card-interactive"
              onClick={() => onNavigateTo('/robots')}
              style={{ padding: '16px 18px', cursor: 'pointer', borderLeft: '4px solid #dc2626' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  OFFLINE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--status-offline-bg)', color: '#dc2626' }}>
                  <CircleAlert size={17} />
                </div>
              </div>
              <div className="font-mono tabular-nums" style={{ marginTop: '12px', fontWeight: 700, fontSize: '28px', color: '#dc2626', lineHeight: 1 }}>
                {statusCounts.offline}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Unpowered / disconnected
              </div>
            </div>
          </>
        )}
      </div>

      {/* Row 2: Fleet Health Distribution & Current Fleet Condition */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Fleet Health Distribution Card */}
        <div className="card card-interactive" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Fleet Health
            </h3>
            <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {operationalPercent}% operational
            </span>
          </div>

          {totalRobots === 0 ? (
            <div style={{ minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No robot data available.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
              <div style={{ height: '180px', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fleetHealthData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={3}
                      isAnimationActive={false}
                    >
                      {fleetHealthData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={<FleetHealthTooltip />}
                      allowEscapeViewBox={{ x: true, y: true }}
                      wrapperStyle={{ zIndex: 40, pointerEvents: 'none' }}
                      position={{ y: -8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <div className="font-mono" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {operationalPercent}%
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase' }}>
                    HEALTH
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                {fleetHealthData.map((item) => (
                  <div
                    key={item.name}
                    className="row-interactive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12.5px',
                      color: 'var(--text-secondary)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-surface-secondary)',
                      border: '1px solid transparent',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          backgroundColor: item.color,
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                    </span>
                    <strong className="font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Current Fleet Condition (Latest Telemetry Readings) */}
        <div className="card card-interactive" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Current Fleet Condition
            </h3>
            {/* Robot Selector dropdown */}
            {robots.length > 0 && (
              <select
                value={selectedRobotId}
                onChange={(e) => setSelectedRobotId(e.target.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {robots.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.model})
                  </option>
                ))}
              </select>
            )}
          </div>

          {sensorLoading && sensorReadings.length === 0 ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: '36px', borderRadius: 'var(--radius-sm)' }} />
              ))}
            </div>
          ) : sensorReadings.length === 0 ? (
            <div style={{ minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              {sensorError || 'Sensor telemetry unavailable'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {Object.entries(METRIC_CONFIG).map(([key, config]) => {
                // sensorReadings is sorted ascending; the last element is always
                // the most-recent reading from the 2-second telemetry stream.
                const latest = sensorReadings[sensorReadings.length - 1];
                const rawVal = Number(latest[key as MetricKey] ?? 0);
                const status = getMetricStatus(key as MetricKey, rawVal);

                return (
                  <div
                    key={key}
                    className="row-interactive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-surface-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: config.color }}>
                        {key === 'temperature_c' && <Thermometer size={15} />}
                        {key === 'vibration_mm_s' && <Activity size={15} />}
                        {key === 'motor_current_a' && <Zap size={15} />}
                        {key === 'pressure_bar' && <Gauge size={15} />}
                      </span>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {config.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="font-mono tabular-nums" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {rawVal.toFixed(config.decimals)} {config.unit}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: status.bg,
                          color: status.color,
                        }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Live Sensor Telemetry Trend (Recharts Line Chart) */}
      <div className="card" style={{ padding: '20px 22px' }}>
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
              {selectedRobot ? `${selectedRobot.name} (${selectedRobot.serial_number})` : 'Select a robot to view telemetry stream'}
            </p>
          </div>

          {/* Metric Selector Tabs */}
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
            {(['temperature_c', 'vibration_mm_s', 'motor_current_a', 'pressure_bar'] as MetricKey[]).map((key) => {
              const active = sensorMetric === key;
              const cfg = METRIC_CONFIG[key];
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
                  onClick={() => setSensorMetric(key)}
                  className={`telemetry-tab-btn ${metricClass} ${active ? 'active' : ''}`}
                >
                  <span className="telemetry-tab-dot" />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {sensorLoading && chartData.length === 0 ? (
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>({sensorError})</span>
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
                  unit={` ${METRIC_CONFIG[sensorMetric].unit}`}
                  domain={['auto', 'auto']}
                />
                <RechartsTooltip
                  isAnimationActive={false}
                  wrapperStyle={{ pointerEvents: 'none', outline: 'none', zIndex: 50 }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const point = payload[0]?.payload;
                    if (!point) return null;
                    const timestamp = point.fullTimestamp || point.formattedTime || 'Recent';
                    const allMetrics: MetricKey[] = ['temperature_c', 'vibration_mm_s', 'motor_current_a', 'pressure_bar'];
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
                          minWidth: '186px',
                          pointerEvents: 'none',
                        }}
                      >
                        {/* Timestamp header */}
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            fontWeight: 500,
                            marginBottom: '8px',
                            paddingBottom: '6px',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                        >
                          {timestamp}
                        </div>
                        {/* All four metrics */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {allMetrics.map((mk) => {
                            const cfg = METRIC_CONFIG[mk];
                            const raw = point[mk];
                            const numVal = typeof raw === 'number' ? raw : Number(raw ?? 0);
                            const isActive = mk === sensorMetric;
                            return (
                              <div
                                key={mk}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '12px',
                                  opacity: isActive ? 1 : 0.55,
                                  transition: 'opacity 0.1s ease',
                                }}
                              >
                                {/* Color swatch + label */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '96px' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: isActive ? '9px' : '7px',
                                      height: isActive ? '9px' : '7px',
                                      borderRadius: '50%',
                                      backgroundColor: cfg.color,
                                      flexShrink: 0,
                                      transition: 'width 0.1s ease, height 0.1s ease',
                                    }}
                                  />
                                  <span
                                    style={{
                                      fontSize: isActive ? '12px' : '11.5px',
                                      fontWeight: isActive ? 700 : 500,
                                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {cfg.label}
                                  </span>
                                </div>
                                {/* Value + unit */}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', flexShrink: 0 }}>
                                  <span
                                    className="font-mono tabular-nums"
                                    style={{
                                      fontSize: isActive ? '14px' : '12.5px',
                                      fontWeight: isActive ? 700 : 500,
                                      color: isActive ? cfg.color : 'var(--text-secondary)',
                                      transition: 'font-size 0.1s ease, color 0.1s ease',
                                    }}
                                  >
                                    {numVal.toFixed(cfg.decimals)}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: 500,
                                      color: isActive ? cfg.color : 'var(--text-muted)',
                                      opacity: isActive ? 0.85 : 0.7,
                                    }}
                                  >
                                    {cfg.unit}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                  cursor={{
                    stroke: METRIC_CONFIG[sensorMetric].color,
                    strokeWidth: 1.5,
                    strokeDasharray: '4 3',
                    strokeOpacity: 0.6,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="val"
                  name={METRIC_CONFIG[sensorMetric].label}
                  stroke={METRIC_CONFIG[sensorMetric].color}
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: METRIC_CONFIG[sensorMetric].color, stroke: 'var(--bg-surface)', strokeWidth: 1.5 }}
                  activeDot={{
                    r: 6,
                    fill: METRIC_CONFIG[sensorMetric].color,
                    stroke: 'var(--bg-surface)',
                    strokeWidth: 2.5,
                  }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Row 4: Robot Status Table & Recent Alerts */}
      <div className="overview-status-alerts-grid">
        {/* Robot Status Table */}
        <div className="card card-interactive" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Robot Fleet Status
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Click robot row to inspect details
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTo('/robots')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>View All Robots</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {robots.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No robot data available.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Robot</th>
                    <th>Model</th>
                    <th>Production Line</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Runtime</th>
                  </tr>
                </thead>
                <tbody>
                  {robots.slice(0, 6).map((robot) => {
                    const line = robot.line_id ? lineMap.get(robot.line_id) : null;
                    return (
                      <tr
                        key={robot.id}
                        className="clickable"
                        onClick={() => {
                          onSelectRobot(robot);
                          onNavigateTo(`/robots/${robot.id}`);
                        }}
                      >
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {robot.name}
                          </div>
                          <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {robot.serial_number}
                          </div>
                        </td>
                        <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {robot.model}
                        </td>
                        <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {line ? line.name : 'Unassigned'}
                        </td>
                        <td>
                          <StatusBadge status={robot.status} />
                        </td>
                        <td className="font-mono tabular-nums" style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {formatRuntime(robot.total_runtime_hours)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Alerts Column */}
        <div className="card card-interactive" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Recent Alerts
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Backed by real-time telemetry
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTo('/alerts')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>View All Alerts</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {recentAlerts.length === 0 ? (
            <div style={{ minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No active alerts.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {recentAlerts.map((alert) => {
                const isCritical = alert.severity === 'critical';
                const isHigh = alert.severity === 'high';
                const isMedium = alert.severity === 'medium';
                const sevColor = isCritical || isHigh ? '#dc2626' : isMedium ? '#d97706' : '#2563eb';
                const sevBg = isCritical || isHigh ? 'var(--status-offline-bg)' : isMedium ? 'var(--status-attention-bg)' : 'var(--accent-surface)';

                return (
                  <div
                    key={alert.id}
                    className="row-interactive"
                    onClick={() => onNavigateTo('/alerts')}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-surface-secondary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {alert.robot_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span
                          style={{
                            padding: '2px 7px',
                            borderRadius: '9999px',
                            backgroundColor: sevBg,
                            color: sevColor,
                            fontSize: '10.5px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {alert.severity}
                        </span>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--status-attention-bg)',
                            color: 'var(--status-attention-fg)',
                            fontSize: '10px',
                            fontWeight: 700,
                            border: '1px solid var(--status-attention-border)',
                          }}
                        >
                          UNRESOLVED
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', lineHeight: 1.4 }}>
                      {alert.description}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '4px' }}>
                      <span>{formatDate(alert.detected_at)}</span>
                      <span className="font-mono">{alert.anomaly_type}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 5: Attention Required Robots */}
      {attentionRobots.length > 0 && (
        <div className="card card-interactive" style={{ padding: '20px 22px', borderLeft: '4px solid #d97706' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} style={{ color: '#d97706' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Attention Required ({attentionRobots.length})
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Action recommended to prevent downtime
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {attentionRobots.map((robot) => {
              const line = robot.line_id ? lineMap.get(robot.line_id) : null;
              return (
                <div
                  key={robot.id}
                  className="row-interactive"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface-secondary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                        {robot.name}
                      </span>
                      <StatusBadge status={robot.status} />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {robot.model} • {line ? line.name : 'Unassigned Line'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatRuntime(robot.total_runtime_hours)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectRobot(robot);
                        onNavigateTo(`/robots/${robot.id}`);
                      }}
                      className="btn btn-secondary"
                      style={{
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Eye size={12} />
                      <span>View Robot</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
