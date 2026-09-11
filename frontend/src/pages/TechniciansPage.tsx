import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  UsersRound,
  Search,
  Plus,
  UserCheck,
  UserX,
  Wrench,
  Edit2,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import type { Technician, TechnicianStatus } from '../types/technician';
import type { Robot } from '../types/robot';
import {
  fetchTechnicians,
  createTechnicianApi,
  updateTechnicianApi,
  deleteTechnicianApi,
  assignTechnicianRobotApi,
  removeTechnicianRobotApi,
  type TechnicianApiRecord,
  type CreateTechnicianPayload,
} from '../api/technicians';

interface TechniciansPageProps {
  robots: Robot[];
}

function normalizeTechnician(record: TechnicianApiRecord): Technician {
  return {
    id: record.id,
    name: record.name,
    technician_id: record.employee_code,
    specialization: (record.specialization ?? 'general') as Technician['specialization'],
    assigned_robots: record.assigned_robots?.map((robot) => robot.robot_code ?? robot.robot_id ?? robot.id ?? '').filter(Boolean) ?? [],
    status: (record.status ?? 'available') as TechnicianStatus,
    last_activity: record.updated_at ?? null,
    phone: record.phone ?? undefined,
    email: record.email ?? undefined,
  };
}

function formatLastActivity(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SPEC_LABELS: Record<string, string> = {
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  hydraulic: 'Hydraulic',
  controls: 'Controls',
  robotics: 'Robotics',
  software: 'Software',
  preventive: 'Preventive',
  general: 'General',
};

const renderSpecBadge = (spec: string) => {
  const norm = (spec || 'general').toLowerCase();
  const label = SPEC_LABELS[norm] ?? spec;
  const badgeClass = `spec-badge ${norm}`;
  return (
    <span className={badgeClass}>
      {label}
    </span>
  );
};

const STATUS_STYLE: Record<TechnicianStatus, { bg: string; color: string; border: string; label: string }> = {
  available: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Available' },
  assigned: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Assigned' },
  offline: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', label: 'Offline' },
};

export const TechniciansPage: React.FC<TechniciansPageProps> = ({ robots = [] }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rawRecords, setRawRecords] = useState<TechnicianApiRecord[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [specFilter, setSpecFilter] = useState<string>('all');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [viewingTech, setViewingTech] = useState<TechnicianApiRecord | null>(null);
  const [deletingTech, setDeletingTech] = useState<Technician | null>(null);

  // Form inputs for Add / Edit
  const [formData, setFormData] = useState<{
    name: string;
    employee_code: string;
    email: string;
    phone: string;
    specialization: string;
    status: TechnicianStatus;
  }>({
    name: '',
    employee_code: '',
    email: '',
    phone: '',
    specialization: 'mechanical',
    status: 'available',
  });

  // Selected robot to assign in view modal
  const [selectedRobotToAssign, setSelectedRobotToAssign] = useState<string>('');

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const loadTechnicians = useCallback(async () => {
    try {
      setLoading(true);
      const records = await fetchTechnicians();
      const safeRecords = Array.isArray(records) ? records : [];
      setRawRecords(safeRecords);
      setTechnicians(safeRecords.map(normalizeTechnician));
    } catch (err) {
      console.error('Failed to load technicians:', err);
      showToast('error', 'Unable to load technicians.');
      setRawRecords([]);
      setTechnicians([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTechnicians();
  }, [loadTechnicians]);

  // Sync the ?filter= query param to statusFilter so that clicking a summary
  // card navigates directly to the correct filtered view.
  useEffect(() => {
    const f = searchParams.get('filter');
    if (f === 'available' || f === 'assigned' || f === 'offline') {
      setStatusFilter(f);
    } else {
      // 'all' param or absent param both show all technicians
      setStatusFilter('all');
    }
  }, [searchParams]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    const nextCodeNum = technicians.length + 1;
    const defaultCode = `TECH-${String(nextCodeNum).padStart(3, '0')}`;
    setFormData({
      name: '',
      employee_code: defaultCode,
      email: '',
      phone: '',
      specialization: 'mechanical',
      status: 'available',
    });
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (tech: Technician) => {
    setFormData({
      name: tech.name,
      employee_code: tech.technician_id,
      email: tech.email || '',
      phone: tech.phone || '',
      specialization: tech.specialization,
      status: tech.status,
    });
    setEditingTech(tech);
  };

  // Open View Modal
  const handleOpenViewModal = (tech: Technician) => {
    const raw = rawRecords.find((r) => r.id === tech.id);
    if (raw) {
      setViewingTech(raw);
    } else {
      setViewingTech({
        id: tech.id,
        name: tech.name,
        employee_code: tech.technician_id,
        specialization: tech.specialization,
        status: tech.status,
        email: tech.email,
        phone: tech.phone,
        assigned_robots: tech.assigned_robots.map((code) => ({ robot_code: code, robot_name: code })),
      });
    }
    setSelectedRobotToAssign(robots[0]?.id || '');
  };

  // Submit Add Technician
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('error', 'Full Name is required.');
      return;
    }

    try {
      setActionLoading(true);
      const payload: CreateTechnicianPayload = {
        name: formData.name.trim(),
        employee_code: formData.employee_code.trim() || undefined,
        specialization: formData.specialization,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        status: formData.status,
      };

      await createTechnicianApi(payload);
      setShowAddModal(false);
      showToast('success', `Technician "${formData.name.trim()}" added successfully.`);
      await loadTechnicians();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to create technician.';
      showToast('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Edit Technician
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTech) return;
    if (!formData.name.trim()) {
      showToast('error', 'Full Name is required.');
      return;
    }

    try {
      setActionLoading(true);
      const payload: Partial<CreateTechnicianPayload> = {
        name: formData.name.trim(),
        employee_code: formData.employee_code.trim(),
        specialization: formData.specialization,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        status: formData.status,
      };

      await updateTechnicianApi(editingTech.id, payload);
      setEditingTech(null);
      showToast('success', `Technician "${formData.name.trim()}" updated successfully.`);
      await loadTechnicians();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to update technician.';
      showToast('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!deletingTech) return;
    try {
      setActionLoading(true);
      await deleteTechnicianApi(deletingTech.id);
      showToast('success', `Technician "${deletingTech.name}" deleted.`);
      setDeletingTech(null);
      await loadTechnicians();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to delete technician.';
      showToast('error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Assign Robot in View Modal
  const handleAssignRobot = async () => {
    if (!viewingTech || !selectedRobotToAssign) return;
    try {
      setActionLoading(true);
      await assignTechnicianRobotApi(viewingTech.id, selectedRobotToAssign);
      showToast('success', 'Robot assigned successfully.');
      await loadTechnicians();
      // Update viewing modal state
      const updated = await fetchTechnicians();
      const fresh = updated.find((r) => r.id === viewingTech.id);
      if (fresh) setViewingTech(fresh);
    } catch {
      showToast('error', 'Unable to assign robot to technician.');
    } finally {
      setActionLoading(false);
    }
  };

  // Unassign Robot in View Modal
  const handleRemoveAssignment = async (robotId: string) => {
    if (!viewingTech) return;
    try {
      setActionLoading(true);
      await removeTechnicianRobotApi(viewingTech.id, robotId);
      showToast('success', 'Robot assignment removed.');
      await loadTechnicians();
      // Update viewing modal state
      const updated = await fetchTechnicians();
      const fresh = updated.find((r) => r.id === viewingTech.id);
      if (fresh) setViewingTech(fresh);
    } catch {
      showToast('error', 'Unable to remove robot assignment.');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return technicians.filter((t) => {
      const matchesSearch =
        search === '' ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.technician_id.toLowerCase().includes(search.toLowerCase()) ||
        t.specialization.toLowerCase().includes(search.toLowerCase()) ||
        (t.email && t.email.toLowerCase().includes(search.toLowerCase())) ||
        (t.phone && t.phone.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesSpec = specFilter === 'all' || t.specialization.toLowerCase() === specFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesSpec;
    });
  }, [search, statusFilter, specFilter, technicians]);

  const available = technicians.filter((t) => t.status === 'available').length;
  const assigned = technicians.filter((t) => t.status === 'assigned').length;
  const offline = technicians.filter((t) => t.status === 'offline').length;

  return (
    <div>
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 100,
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: notification.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${notification.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: notification.type === 'success' ? '#15803d' : '#b91c1c',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: '6px', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UsersRound size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>Technicians & Maintenance Roster</span>
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Manage robotic maintenance specialists, contact information, and robot assignments
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-default"
            onClick={loadTechnicians}
            disabled={loading}
            title="Refresh technician roster"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAddModal}
            style={{ height: '36px', padding: '0 14px', fontWeight: 600 }}
          >
            <Plus size={15} />
            <span>Add Technician</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {/* Card 1 — Total Technicians */}
        <div
          className="card"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/technicians?filter=all')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/technicians?filter=all')}
          onMouseEnter={() => setHoveredCard('all')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, border-color 0.15s',
            ...(hoveredCard === 'all' ? { boxShadow: '0 4px 16px rgba(37,99,235,0.10)', borderColor: '#93c5fd' } : {}),
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Technicians</div>
            <div className="tabular-nums font-mono" style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px' }}>{technicians.length}</div>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UsersRound size={17} />
          </div>
        </div>

        {/* Card 2 — Available */}
        <div
          className="card"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/technicians?filter=available')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/technicians?filter=available')}
          onMouseEnter={() => setHoveredCard('available')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, border-color 0.15s',
            ...(hoveredCard === 'available' ? { boxShadow: '0 4px 16px rgba(22,163,74,0.10)', borderColor: '#86efac' } : {}),
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Available</div>
            <div className="tabular-nums font-mono" style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#16a34a' }}>{available}</div>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', backgroundColor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={17} />
          </div>
        </div>

        {/* Card 3 — Assigned */}
        <div
          className="card"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/technicians?filter=assigned')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/technicians?filter=assigned')}
          onMouseEnter={() => setHoveredCard('assigned')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, border-color 0.15s',
            ...(hoveredCard === 'assigned' ? { boxShadow: '0 4px 16px rgba(37,99,235,0.10)', borderColor: '#93c5fd' } : {}),
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Assigned</div>
            <div className="tabular-nums font-mono" style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#2563eb' }}>{assigned}</div>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wrench size={17} />
          </div>
        </div>

        {/* Card 4 — Offline */}
        <div
          className="card"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/technicians?filter=offline')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/technicians?filter=offline')}
          onMouseEnter={() => setHoveredCard('offline')}
          onMouseLeave={() => setHoveredCard(null)}
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, border-color 0.15s',
            ...(hoveredCard === 'offline' ? { boxShadow: '0 4px 16px rgba(100,116,139,0.12)', borderColor: '#cbd5e1' } : {}),
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Offline</div>
            <div className="tabular-nums font-mono" style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px', color: '#64748b' }}>{offline}</div>
          </div>
          <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', backgroundColor: '#f8fafc', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserX size={17} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div className="search-input-wrapper" style={{ width: '100%', maxWidth: '300px' }}>
          <Search size={14} />
          <input
            type="text"
            className="search-input"
            placeholder="Search technician, ID, specialization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            className="select-input"
            value={specFilter}
            onChange={(e) => setSpecFilter(e.target.value)}
            aria-label="Filter by Specialization"
          >
            <option value="all">All Specializations</option>
            <option value="mechanical">Mechanical</option>
            <option value="electrical">Electrical</option>
            <option value="hydraulic">Hydraulic</option>
            <option value="software">Software</option>
            <option value="general">General</option>
          </select>

          <select
            className="select-input"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); navigate('/technicians?filter=' + e.target.value); }}
            aria-label="Filter by Status"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>

      {/* Technicians Table */}
      {loading && technicians.length === 0 ? (
        <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={20} className="spin" style={{ margin: '0 auto 10px' }} />
          <div>Loading technicians from PostgreSQL...</div>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Technician</th>
                <th>Employee Code</th>
                <th>Specialization</th>
                <th>Assigned Robots</th>
                <th>Status</th>
                <th>Last Activity</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    {technicians.length === 0
                      ? 'No technicians found in the roster. Click "Add Technician" to register a specialist.'
                      : 'No technicians match the current filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((tech) => {
                  const st = STATUS_STYLE[tech.status] || STATUS_STYLE.available;
                  return (
                    <tr key={tech.id} className="clickable" onClick={() => handleOpenViewModal(tech)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: '#e2e8f0',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '12px',
                              flexShrink: 0,
                            }}
                          >
                            {tech.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                              {tech.name}
                            </span>
                            {tech.email && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tech.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {tech.technician_id}
                        </span>
                      </td>
                      <td>
                        {renderSpecBadge(tech.specialization)}
                      </td>
                      <td>
                        {tech.assigned_robots.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {tech.assigned_robots.map((r) => (
                              <span
                                key={r}
                                className="font-mono"
                                style={{
                                  fontSize: '11px',
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-xs)',
                                  backgroundColor: '#eff6ff',
                                  color: '#2563eb',
                                  border: '1px solid #bfdbfe',
                                }}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None</span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: st.bg,
                            color: st.color,
                            border: `1px solid ${st.border}`,
                          }}
                        >
                          <span
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              backgroundColor: st.color,
                              flexShrink: 0,
                            }}
                          />
                          {st.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatLastActivity(tech.last_activity)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-default"
                            onClick={() => handleOpenViewModal(tech)}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            title="View technician profile & robot assignments"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-default"
                            onClick={() => handleOpenEditModal(tech)}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            title="Edit technician details"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-default"
                            onClick={() => setDeletingTech(tech)}
                            style={{ fontSize: '11px', padding: '4px 8px', color: '#dc2626' }}
                            title="Delete technician"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-secondary)', fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {filtered.length} of {technicians.length} technicians
          </div>
        </div>
      )}

      {/* Add / Edit Technician Modal */}
      {(showAddModal || editingTech) && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              setShowAddModal(false);
              setEditingTech(null);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tech-modal-title"
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '520px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 id="tech-modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {editingTech ? 'Edit Technician' : 'Add Technician'}
              </h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTech(null);
                }}
                disabled={actionLoading}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={editingTech ? handleEditSubmit : handleAddSubmit}>
              <div style={{ padding: '20px 24px', display: 'grid', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="e.g. Marcus Webb"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Employee Code
                    </label>
                    <input
                      type="text"
                      className="search-input font-mono"
                      placeholder="e.g. TECH-001"
                      value={formData.employee_code}
                      onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Specialization
                    </label>
                    <select
                      className="select-input"
                      value={formData.specialization}
                      onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="mechanical">Mechanical</option>
                      <option value="electrical">Electrical</option>
                      <option value="hydraulic">Hydraulic</option>
                      <option value="software">Software</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      className="search-input"
                      placeholder="name@robopulse.io"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      className="search-input"
                      placeholder="+1 (555) 000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Status
                  </label>
                  <select
                    className="select-input"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TechnicianStatus })}
                    style={{ width: '100%' }}
                  >
                    <option value="available">Available</option>
                    <option value="assigned">Assigned</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  padding: '14px 24px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingTech(null);
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                  style={{ minWidth: '120px' }}
                >
                  {actionLoading ? <RefreshCw size={13} className="spin" /> : null}
                  <span>{editingTech ? 'Save Changes' : 'Add Technician'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Technician & Robot Assignments Modal */}
      {viewingTech && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setViewingTech(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-tech-title"
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '560px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-surface)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {viewingTech.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 id="view-tech-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                    {viewingTech.name}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span className="font-mono">ID: {viewingTech.employee_code}</span>
                    <span>·</span>
                    {renderSpecBadge(viewingTech.specialization)}
                  </div>
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={() => setViewingTech(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'grid', gap: '16px' }}>
              {/* Contact Information */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: 'var(--bg-surface-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px', wordBreak: 'break-all' }}>
                    {viewingTech.email || 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Phone</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {viewingTech.phone || 'Not provided'}
                  </div>
                </div>
              </div>

              {/* Assigned Robots */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                  Assigned Robot Units
                </h4>

                {viewingTech.assigned_robots && viewingTech.assigned_robots.length > 0 ? (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {viewingTech.assigned_robots.map((robot) => {
                      const robotIdentifier = robot.robot_id ?? robot.id ?? '';
                      return (
                        <div
                          key={robot.robot_code || robot.id || robotIdentifier}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-surface-secondary)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Cpu size={14} style={{ color: 'var(--accent-primary)' }} />
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '12.5px' }}>{robot.robot_name || robot.robot_code}</span>
                              <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                ({robot.robot_code})
                              </span>
                            </div>
                          </div>

                          {robotIdentifier && (
                            <button
                              type="button"
                              className="btn btn-default"
                              onClick={() => handleRemoveAssignment(robotIdentifier)}
                              disabled={actionLoading}
                              style={{ fontSize: '11px', padding: '2px 6px', color: '#dc2626' }}
                              title="Unassign robot"
                            >
                              Unassign
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    No robotic units currently assigned to this technician.
                  </div>
                )}
              </div>

              {/* Assign a Robot */}
              {robots.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Assign Robot to {viewingTech.name}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="select-input"
                      value={selectedRobotToAssign}
                      onChange={(e) => setSelectedRobotToAssign(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      {robots.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.serial_number}) - {r.model}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAssignRobot}
                      disabled={actionLoading || !selectedRobotToAssign}
                      style={{ padding: '0 12px', fontSize: '12px' }}
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '12px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <button type="button" className="btn btn-default" onClick={() => setViewingTech(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTech && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) setDeletingTech(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-tech-title"
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
              width: '100%',
              maxWidth: '440px',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-offline-bg)',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                }}
              >
                <Trash2 size={20} />
              </div>
              <h3 id="delete-tech-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Delete Technician
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                Are you sure you want to delete technician <strong>{deletingTech.name}</strong> ({deletingTech.technician_id})? This action will permanently remove their record from PostgreSQL.
              </p>
            </div>

            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <button
                type="button"
                className="btn btn-default"
                onClick={() => setDeletingTech(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDeleteConfirm}
                disabled={actionLoading}
                style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
              >
                {actionLoading ? <RefreshCw size={13} className="spin" /> : null}
                <span>Delete Technician</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

