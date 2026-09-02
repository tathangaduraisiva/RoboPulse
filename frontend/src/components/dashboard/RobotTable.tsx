import React, { useState, useMemo } from 'react';
import { Search, Filter, ChevronRight, Clock, Hash } from 'lucide-react';
import type { Robot, RobotStatus } from '../../types/robot';
import type { ProductionLine } from '../../types/productionLine';
import { StatusBadge } from '../common/StatusBadge';

interface RobotTableProps {
  robots: Robot[];
  productionLines?: ProductionLine[];
  onSelectRobot: (robot: Robot) => void;
  selectedRobotId?: string | null;
  showFilters?: boolean;
}

export const RobotTable: React.FC<RobotTableProps> = ({
  robots,
  productionLines = [],
  onSelectRobot,
  selectedRobotId,
  showFilters = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');

  // Map line_id to production line for fast lookup
  const lineMap = useMemo(() => {
    const map = new Map<string, ProductionLine>();
    productionLines.forEach((l) => map.set(l.id, l));
    return map;
  }, [productionLines]);

  // Format runtime hours with locale commas and 1 decimal place
  const formatRuntime = (hours: number | string) => {
    const num = typeof hours === 'number' ? hours : parseFloat(hours) || 0;
    return `${num.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} hrs`;
  };

  // Filtered dataset
  const filteredRobots = useMemo(() => {
    return robots.filter((robot) => {
      // Search term matches name, serial, model, or manufacturer
      const matchesSearch =
        searchTerm === '' ||
        robot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        robot.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        robot.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        robot.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === 'all' ||
        robot.status.toLowerCase() === statusFilter.toLowerCase();

      // Line filter
      const matchesLine =
        lineFilter === 'all' || robot.line_id === lineFilter;

      return matchesSearch && matchesStatus && matchesLine;
    });
  }, [robots, searchTerm, statusFilter, lineFilter]);

  return (
    <div className="table-container">
      {/* Table Toolbar / Filters */}
      {showFilters && (
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          {/* Search box */}
          <div className="search-input-wrapper">
            <Search size={15} />
            <input
              type="text"
              className="search-input"
              placeholder="Search robot, serial, model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter dropdowns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                className="select-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Status"
              >
                <option value="all">All Statuses</option>
                <option value="operational">Operational</option>
                <option value="attention">Attention</option>
                <option value="maintenance">Maintenance</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            {productionLines.length > 0 && (
              <select
                className="select-input"
                value={lineFilter}
                onChange={(e) => setLineFilter(e.target.value)}
                aria-label="Filter by Production Line"
              >
                <option value="all">All Production Lines</option>
                {productionLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name} ({line.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Table Content */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Robot Identifier</th>
            <th>Model & Manufacturer</th>
            <th>Production Line</th>
            <th>Status</th>
            <th>Total Runtime</th>
            <th style={{ textAlign: 'right' }}>Telemetry</th>
          </tr>
        </thead>
        <tbody>
          {filteredRobots.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                style={{
                  textAlign: 'center',
                  padding: '36px 20px',
                  color: 'var(--text-muted)',
                }}
              >
                No robotic units match the current filter criteria.
              </td>
            </tr>
          ) : (
            filteredRobots.map((robot) => {
              const line = robot.line_id ? lineMap.get(robot.line_id) : undefined;
              const isSelected = selectedRobotId === robot.id;

              return (
                <tr
                  key={robot.id}
                  className="clickable"
                  onClick={() => onSelectRobot(robot)}
                  style={{
                    backgroundColor: isSelected ? 'var(--accent-surface)' : undefined,
                  }}
                >
                  {/* Robot Identifier & Serial */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                        }}
                      >
                        {robot.name}
                      </span>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          marginTop: '1px',
                        }}
                      >
                        <Hash size={11} />
                        {robot.serial_number}
                      </span>
                    </div>
                  </td>

                  {/* Model & Manufacturer */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500 }}>{robot.model}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {robot.manufacturer}
                      </span>
                    </div>
                  </td>

                  {/* Production Line */}
                  <td>
                    {line ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{line.name}</span>
                        <span
                          className="font-mono"
                          style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                        >
                          {line.code} · {line.location}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td>
                    <StatusBadge status={robot.status as RobotStatus} />
                  </td>

                  {/* Total Runtime Hours */}
                  <td>
                    <span
                      className="tabular-nums font-mono"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                      {formatRuntime(robot.total_runtime_hours)}
                    </span>
                  </td>

                  {/* Telemetry Action */}
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-default"
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        borderColor: isSelected ? 'var(--accent-primary)' : undefined,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRobot(robot);
                      }}
                    >
                      <span>Inspect</span>
                      <ChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Table Footer Count */}
      <div
        style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-secondary)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          Showing <strong className="tabular-nums">{filteredRobots.length}</strong> of{' '}
          <strong className="tabular-nums">{robots.length}</strong> robots
        </span>
        <span style={{ fontSize: '11px' }}>Click any row to view live telemetry</span>
      </div>
    </div>
  );
};
