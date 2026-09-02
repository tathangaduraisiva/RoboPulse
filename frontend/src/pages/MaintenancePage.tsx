import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  Search,
  DollarSign,
  User,
  X,
  Sparkles,
} from 'lucide-react';
import type { MaintenanceTask, MaintenanceType, CreateMaintenanceInput } from '../types/maintenance';
import type { Robot } from '../types/robot';
import { scheduleMaintenanceApi, completeMaintenanceApi } from '../api/maintenance';

interface MaintenancePageProps {
  maintenance: MaintenanceTask[];
  robots: Robot[];
  onSelectRobot: (robot: Robot) => void;
  onRefreshMaintenance: () => void;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({
  maintenance,
  robots,
  onSelectRobot,
  onRefreshMaintenance,
}) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'upcoming' | 'overdue' | 'completed'>('upcoming');
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Form state for scheduling with lazy initializer
  const [formData, setFormData] = useState<CreateMaintenanceInput>(() => ({
    robot_id: robots[0]?.id || '',
    maintenance_type: 'preventive',
    description: '',
    technician: 'Fleet Tech Team',
    cost: 450,
    next_due_at: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  }));

  // KPI calculations
  const upcomingList = useMemo(
    () => maintenance.filter((m) => m.status === 'upcoming'),
    [maintenance]
  );
  const overdueList = useMemo(
    () => maintenance.filter((m) => m.status === 'overdue'),
    [maintenance]
  );
  const completedList = useMemo(
    () => maintenance.filter((m) => m.status === 'completed'),
    [maintenance]
  );

  const totalCost = useMemo(() => {
    return maintenance.reduce((sum, m) => sum + (Number(m.cost) || 0), 0);
  }, [maintenance]);

  // Filtered by current tab, search, and type
  const activeList = useMemo(() => {
    const list =
      tab === 'upcoming'
        ? upcomingList
        : tab === 'overdue'
        ? overdueList
        : completedList;

    return list.filter((item) => {
      const matchesSearch =
        search === '' ||
        item.robot_name.toLowerCase().includes(search.toLowerCase()) ||
        item.robot_serial.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase()) ||
        (item.technician && item.technician.toLowerCase().includes(search.toLowerCase())) ||
        item.line_name.toLowerCase().includes(search.toLowerCase());

      const matchesType =
        selectedType === 'all' || item.maintenance_type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [tab, upcomingList, overdueList, completedList, search, selectedType]);

  const handleComplete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setCompletingId(id);
      await completeMaintenanceApi(id);
      onRefreshMaintenance();
    } catch (err) {
      console.error('Failed to complete maintenance task:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.robot_id || !formData.description) return;

    try {
      setSubmitting(true);
      await scheduleMaintenanceApi(formData);
      setIsModalOpen(false);
      setFormData({
        robot_id: robots[0]?.id || '',
        maintenance_type: 'preventive',
        description: '',
        technician: 'Fleet Tech Team',
        cost: 450,
        next_due_at: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      });
      onRefreshMaintenance();
    } catch (err) {
      console.error('Failed to schedule maintenance:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatMaintenanceType = (type: MaintenanceType) => {
    switch (type) {
      case 'preventive':
        return 'Preventive';
      case 'corrective':
        return 'Corrective';
      case 'inspection':
        return 'Inspection';
      case 'component_replacement':
        return 'Replacement';
      default:
        return type;
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return 'N/A';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div>
      {/* Header with Title and "Schedule Maintenance" Button */}
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
            <Wrench size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>Maintenance Schedule & Work Orders</span>
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Preventive service intervals, component replacement logs, and technician assignments
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-default"
            onClick={() => navigate('/predictions')}
            style={{ height: '38px', padding: '0 14px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
            <span>Predictive Maintenance & Risk Intelligence</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
            style={{ height: '38px', padding: '0 16px', fontWeight: 600 }}
          >
            <Plus size={16} />
            <span>Schedule Maintenance</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Upcoming Tasks
            </div>
            <div
              className="font-mono tabular-nums"
              style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#9333ea' }}
            >
              {upcomingList.length}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#faf5ff',
              color: '#9333ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={18} />
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Overdue Tasks
            </div>
            <div
              className="font-mono tabular-nums"
              style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#dc2626' }}
            >
              {overdueList.length}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertCircle size={18} />
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Completed Service
            </div>
            <div
              className="font-mono tabular-nums"
              style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#16a34a' }}
            >
              {completedList.length}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Total Service Budget
            </div>
            <div
              className="font-mono tabular-nums"
              style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)' }}
            >
              ${totalCost.toLocaleString()}
            </div>
          </div>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DollarSign size={18} />
          </div>
        </div>
      </div>

      {/* Tabs & Search / Filter Controls */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Navigation Tabs */}
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
          <button
            type="button"
            onClick={() => setTab('upcoming')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
              fontWeight: tab === 'upcoming' ? 600 : 500,
              backgroundColor: tab === 'upcoming' ? 'var(--bg-surface)' : 'transparent',
              color: tab === 'upcoming' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              boxShadow: tab === 'upcoming' ? 'var(--shadow-xs)' : 'none',
              border: tab === 'upcoming' ? '1px solid var(--border-subtle)' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            Upcoming ({upcomingList.length})
          </button>

          <button
            type="button"
            onClick={() => setTab('overdue')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
              fontWeight: tab === 'overdue' ? 600 : 500,
              backgroundColor: tab === 'overdue' ? 'var(--bg-surface)' : 'transparent',
              color: tab === 'overdue' ? '#dc2626' : 'var(--text-secondary)',
              boxShadow: tab === 'overdue' ? 'var(--shadow-xs)' : 'none',
              border: tab === 'overdue' ? '1px solid var(--border-subtle)' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            Overdue ({overdueList.length})
          </button>

          <button
            type="button"
            onClick={() => setTab('completed')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
              fontWeight: tab === 'completed' ? 600 : 500,
              backgroundColor: tab === 'completed' ? 'var(--bg-surface)' : 'transparent',
              color: tab === 'completed' ? '#16a34a' : 'var(--text-secondary)',
              boxShadow: tab === 'completed' ? 'var(--shadow-xs)' : 'none',
              border: tab === 'completed' ? '1px solid var(--border-subtle)' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            Completed ({completedList.length})
          </button>
        </div>

        {/* Search & Type filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'flex-end' }}>
          <div className="search-input-wrapper" style={{ width: '100%', maxWidth: '280px' }}>
            <Search size={15} />
            <input
              type="text"
              className="search-input"
              placeholder="Search robot, task, technician..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <select
            className="select-input"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="Filter by Maintenance Type"
          >
            <option value="all">All Types</option>
            <option value="preventive">Preventive</option>
            <option value="corrective">Corrective</option>
            <option value="inspection">Inspection</option>
            <option value="component_replacement">Replacement</option>
          </select>
        </div>
      </div>

      {/* Maintenance Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Machine</th>
              <th>Production Line</th>
              <th>Task / Description</th>
              <th>Type</th>
              <th>Technician</th>
              <th>Est. Cost</th>
              <th>{tab === 'completed' ? 'Completed Date' : 'Due Date'}</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {activeList.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No maintenance records in this view.
                </td>
              </tr>
            ) : (
              activeList.map((record) => {
                const targetRobot = robots.find((r) => r.id === record.robot_id);

                return (
                  <tr
                    key={record.id}
                    className="clickable"
                    onClick={() => {
                      if (targetRobot) onSelectRobot(targetRobot);
                    }}
                  >
                    {/* Machine */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {record.robot_name}
                      </div>
                      <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {record.robot_serial}
                      </div>
                    </td>

                    {/* Line */}
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {record.line_name}
                    </td>

                    {/* Task Description */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12.5px' }}>
                        {record.description}
                      </div>
                      {record.component_name && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Component: {record.component_name}
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {formatMaintenanceType(record.maintenance_type)}
                      </span>
                    </td>

                    {/* Technician */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <User size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{record.technician || 'Unassigned'}</span>
                      </div>
                    </td>

                    {/* Cost */}
                    <td className="tabular-nums font-mono" style={{ fontWeight: 600 }}>
                      ${Number(record.cost || 0).toLocaleString()}
                    </td>

                    {/* Due / Completed Date */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                        <Clock size={13} style={{ color: record.status === 'overdue' ? '#dc2626' : 'var(--text-muted)' }} />
                        <span
                          style={{
                            fontWeight: record.status === 'overdue' ? 600 : 400,
                            color: record.status === 'overdue' ? '#dc2626' : 'var(--text-primary)',
                          }}
                        >
                          {formatDateTime(tab === 'completed' ? record.performed_at : record.next_due_at)}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: 'right' }}>
                      {record.status !== 'completed' && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={completingId === record.id}
                          onClick={(e) => handleComplete(record.id, e)}
                          style={{
                            fontSize: '11.5px',
                            padding: '4px 10px',
                            backgroundColor: '#16a34a',
                            borderColor: '#16a34a',
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>Complete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Schedule Maintenance Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', padding: '24px' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '18px',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Schedule Maintenance Task
              </h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Target Robotic Machine *
                </label>
                <select
                  className="select-input"
                  style={{ width: '100%', padding: '8px 12px' }}
                  value={formData.robot_id}
                  onChange={(e) => setFormData({ ...formData, robot_id: e.target.value })}
                  required
                >
                  {robots.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.serial_number} - {r.model})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Maintenance Type *
                </label>
                <select
                  className="select-input"
                  style={{ width: '100%', padding: '8px 12px' }}
                  value={formData.maintenance_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maintenance_type: e.target.value as MaintenanceType,
                    })
                  }
                >
                  <option value="preventive">Preventive Maintenance</option>
                  <option value="corrective">Corrective Repair</option>
                  <option value="inspection">Safety & Calibration Inspection</option>
                  <option value="component_replacement">Component Replacement</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Task Description *
                </label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="e.g. Joint 3 Bearing Lubrication & Harmonic Drive Inspection"
                  style={{ width: '100%', paddingLeft: '12px' }}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Assigned Technician
                  </label>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="e.g. Marcus Vance"
                    style={{ width: '100%', paddingLeft: '12px' }}
                    value={formData.technician}
                    onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Est. Cost ($)
                  </label>
                  <input
                    type="number"
                    className="search-input"
                    style={{ width: '100%', paddingLeft: '12px' }}
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Scheduled Due Date *
                </label>
                <input
                  type="date"
                  className="search-input"
                  style={{ width: '100%', paddingLeft: '12px' }}
                  value={formData.next_due_at}
                  onChange={(e) => setFormData({ ...formData, next_due_at: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Scheduling...' : 'Save Maintenance Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
