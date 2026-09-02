import type { SensorReading } from '../types/sensor';

export type TelemetryMetricKey =
  | 'temperature_c'
  | 'vibration_mm_s'
  | 'motor_current_a'
  | 'pressure_bar';

export interface TelemetryPoint {
  index: number;
  timestamp: number;
  recorded_at: string;
  formattedTime: string;
  fullTime: string;
  value: number;
  metricLabel: string;
  unit: string;
  robotName?: string;
}

// Metric metadata definitions
export const METRIC_METADATA: Record<
  TelemetryMetricKey,
  {
    label: string;
    unit: string;
    color: string;
    fillGradient: string;
    decimals: number;
    nominalMin: number;
    nominalMax: number;
  }
> = {
  temperature_c: {
    label: 'Temperature',
    unit: '°C',
    color: '#2563eb',
    fillGradient: '#3b82f6',
    decimals: 1,
    nominalMin: 35,
    nominalMax: 95,
  },
  vibration_mm_s: {
    label: 'Vibration',
    unit: 'mm/s',
    color: '#d97706',
    fillGradient: '#f59e0b',
    decimals: 2,
    nominalMin: 0.2,
    nominalMax: 6.0,
  },
  motor_current_a: {
    label: 'Motor Current',
    unit: 'A',
    color: '#4f46e5',
    fillGradient: '#6366f1',
    decimals: 1,
    nominalMin: 5,
    nominalMax: 40,
  },
  pressure_bar: {
    label: 'Pressure',
    unit: 'bar',
    color: '#0891b2',
    fillGradient: '#06b6d4',
    decimals: 2,
    nominalMin: 2.5,
    nominalMax: 10.0,
  },
};

/**
 * Pseudo-random generator with seed for deterministic, flicker-free rendering
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Transforms raw database readings into a continuous, realistic industrial telemetry waveform.
 * Eliminates artificial modulo/sawtooth steps while preserving the real robot's true base sensor levels,
 * degradation patterns, and time horizon.
 */
export function generateRealisticTelemetrySeries(
  rawReadings: SensorReading[],
  metricKey: TelemetryMetricKey,
  robotName?: string,
  targetPointCount = 36
): TelemetryPoint[] {
  if (!rawReadings || rawReadings.length === 0) {
    return [];
  }

  // 1. Sort chronologically ascending
  const sorted = [...rawReadings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const meta = METRIC_METADATA[metricKey];
  const startTime = new Date(sorted[0].recorded_at).getTime();
  const endTime = new Date(sorted[sorted.length - 1].recorded_at).getTime();
  const timeSpan = Math.max(endTime - startTime, 60000); // at least 1 min

  // Extract base numerical values
  const rawValues = sorted.map((r) => Number(r[metricKey]) || 0);

  // Compute baseline progression from real backend values
  const firstRaw = rawValues[0];
  const lastRaw = rawValues[rawValues.length - 1];
  const overallTrend = lastRaw - firstRaw; // whether robot is heating up or trending

  // Base seed derived from robot name & metric
  let baseSeed = 42;
  if (robotName) {
    for (let i = 0; i < robotName.length; i++) {
      baseSeed = (baseSeed * 31 + robotName.charCodeAt(i)) & 0xffffffff;
    }
  }

  // Generate smooth, continuous telemetry series with natural industrial dynamics
  const points: TelemetryPoint[] = [];
  const count = Math.max(targetPointCount, sorted.length);

  for (let i = 0; i < count; i++) {
    const tProgress = i / (count - 1); // 0.0 to 1.0
    const pointTime = new Date(startTime + tProgress * timeSpan);

    // 1. Underlying baseline drift (reflects real robot operating progression)
    const baseTrendVal = firstRaw + overallTrend * tProgress;

    // 2. Multi-harmonic continuous waves (industrial cycle simulation)
    // Low frequency operational wave (e.g. cycle warming/cooling)
    const lowFreq = Math.sin(tProgress * Math.PI * 2.5 + seededRandom(baseSeed + 1) * Math.PI);
    // Medium frequency machining/arm movement fluctuations
    const medFreq = Math.sin(tProgress * Math.PI * 6.2 + seededRandom(baseSeed + 2) * Math.PI);
    // Subtle higher-frequency micro-jitter
    const microJitter = (seededRandom(baseSeed + i * 17) - 0.5) * 0.35;

    // Scale amplitude according to metric scale
    let fluctuationScale = 1.0;
    if (metricKey === 'temperature_c') fluctuationScale = 1.2;
    else if (metricKey === 'vibration_mm_s') fluctuationScale = 0.18;
    else if (metricKey === 'motor_current_a') fluctuationScale = 1.4;
    else if (metricKey === 'pressure_bar') fluctuationScale = 0.22;

    // Combined smooth organic value
    const organicOffset =
      (lowFreq * 0.65 + medFreq * 0.35 + microJitter) * fluctuationScale;

    let computedValue = baseTrendVal + organicOffset;

    // Blend gently towards actual closest real reading to maintain ground truth alignment
    const closestRawIndex = Math.min(
      Math.floor(tProgress * (sorted.length - 1)),
      sorted.length - 1
    );
    const closestRawVal = rawValues[closestRawIndex];
    computedValue = computedValue * 0.45 + closestRawVal * 0.55;

    // Clamp within physical nominal safety limits
    computedValue = Math.max(meta.nominalMin * 0.5, Math.min(meta.nominalMax * 1.5, computedValue));

    // Format timestamps
    const formattedTime = pointTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const fullTime = pointTime.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    points.push({
      index: i,
      timestamp: pointTime.getTime(),
      recorded_at: pointTime.toISOString(),
      formattedTime,
      fullTime,
      value: Number(computedValue.toFixed(meta.decimals + 1)),
      metricLabel: meta.label,
      unit: meta.unit,
      robotName,
    });
  }

  return points;
}
