import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Robot } from '../../types/robot';
import type { PredictionInsight } from '../../types/prediction';
import type { ProductionLine } from '../../types/productionLine';

interface HealthScoreDistributionProps {
  robots: Robot[];
  predictions: PredictionInsight[];
  productionLines?: ProductionLine[];
}

export const HealthScoreDistribution: React.FC<HealthScoreDistributionProps> = ({
  robots,
  predictions,
  productionLines = [],
}) => {
  const [selectedLine, setSelectedLine] = useState<string>('all');

  // Filter robots by line
  const filteredRobots = useMemo(() => {
    if (selectedLine === 'all') return robots;
    return robots.filter((r) => r.line_id === selectedLine);
  }, [robots, selectedLine]);

  // Compute distribution of health scores
  const distributionData = useMemo(() => {
    const predMap = new Map<string, PredictionInsight>();
    predictions.forEach((p) => predMap.set(p.robot_id, p));

    const bins = [
      { range: '0-20', count: 0, color: '#dc2626', label: 'Critical' },
      { range: '20-40', count: 0, color: '#f97316', label: 'High Risk' },
      { range: '40-60', count: 0, color: '#f59e0b', label: 'Warning' },
      { range: '60-80', count: 0, color: '#22c55e', label: 'Good' },
      { range: '80-100', count: 0, color: '#16a34a', label: 'Optimal' },
    ];

    filteredRobots.forEach((robot) => {
      const pred = predMap.get(robot.id);
      const score = pred
        ? Number(pred.health_score)
        : robot.status === 'operational'
        ? 92
        : robot.status === 'attention'
        ? 62
        : robot.status === 'maintenance'
        ? 52
        : 18;

      if (score <= 20) bins[0].count++;
      else if (score <= 40) bins[1].count++;
      else if (score <= 60) bins[2].count++;
      else if (score <= 80) bins[3].count++;
      else bins[4].count++;
    });

    return bins;
  }, [filteredRobots, predictions]);

  return (
    <div
      className="card"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Health Score Distribution
          </h3>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Fleet-wide health tier clustering
          </div>
        </div>

        <select
          className="select-input"
          value={selectedLine}
          onChange={(e) => setSelectedLine(e.target.value)}
          aria-label="Filter by Production Line"
          style={{ fontSize: '11.5px', padding: '4px 24px 4px 8px' }}
        >
          <option value="all">All Machines</option>
          {productionLines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.name}
            </option>
          ))}
        </select>
      </div>

      {/* Bar Chart Canvas */}
      <div style={{ flex: 1, minHeight: '180px', width: '100%' }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={distributionData}
            margin={{ top: 12, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 10px',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        Tier: {d.label} ({d.range}%)
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Machines:{' '}
                        <strong className="font-mono" style={{ color: d.color }}>
                          {d.count} units
                        </strong>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {distributionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          textAlign: 'center',
          marginTop: '6px',
        }}
      >
        Health Score (%)
      </div>
    </div>
  );
};
