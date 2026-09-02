import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
  RefreshCw,
  Check,
  AlertCircle,
  KeyRound,
  X,
  RotateCcw,
  Save,
} from 'lucide-react';
import type { HealthStatus } from '../types/api';
import type { Robot } from '../types/robot';
import { useTheme } from '../context/ThemeContext';
import { changeUserPassword } from '../api/auth';

interface UserSessionInfo {
  name?: string;
  username?: string;
  email?: string | null;
  role?: string;
}

interface SettingsPageProps {
  health: HealthStatus | null;
  healthError: boolean;
  onRefreshHealth: () => void | Promise<void>;
  lastUpdated?: Date | null;
  robots?: Robot[];
  user?: UserSessionInfo | null;
  sidebarCollapsed?: boolean;
  onSetSidebarCollapsed?: (collapsed: boolean) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  health,
  healthError,
  onRefreshHealth,
  lastUpdated,
  robots = [],
  user,
  sidebarCollapsed = false,
  onSetSidebarCollapsed,
}) => {
  const { theme, setTheme } = useTheme();

  // Preferences state backed by localStorage
  const [alertNotifications, setAlertNotifications] = useState<boolean>(() => {
    const saved = localStorage.getItem('robopulse_setting_alert_notifications');
    return saved !== null ? saved === 'true' : true;
  });

  const [maintReminders, setMaintReminders] = useState<boolean>(() => {
    const saved = localStorage.getItem('robopulse_setting_maint_reminders');
    return saved !== null ? saved === 'true' : true;
  });

  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    const saved = localStorage.getItem('robopulse_setting_auto_refresh');
    return saved !== null ? saved === 'true' : true;
  });

  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    const saved = localStorage.getItem('robopulse_refresh_interval');
    return saved ? Number(saved) : 30000;
  });

  const [defaultRobotId, setDefaultRobotId] = useState<string>(() => {
    const saved = localStorage.getItem('robopulse_default_robot');
    return saved || (robots[0]?.id ?? '');
  });

  useEffect(() => {
    if (!defaultRobotId && robots.length > 0) {
      setDefaultRobotId(robots[0].id);
    }
  }, [robots, defaultRobotId]);

  // UI state for Save/Reset feedback & health checking
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  // Password Modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordLoading, setPasswordLoading] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const isConnected = !healthError && health?.status === 'operational';

  const handleHealthCheck = async () => {
    setIsCheckingHealth(true);
    try {
      await onRefreshHealth();
    } finally {
      setTimeout(() => setIsCheckingHealth(false), 400);
    }
  };

  const handleSaveChanges = () => {
    localStorage.setItem('robopulse_setting_alert_notifications', String(alertNotifications));
    localStorage.setItem('robopulse_setting_maint_reminders', String(maintReminders));
    localStorage.setItem('robopulse_setting_auto_refresh', String(autoRefresh));
    localStorage.setItem('robopulse_refresh_interval', String(refreshInterval));
    if (defaultRobotId) {
      localStorage.setItem('robopulse_default_robot', defaultRobotId);
    }

    setSaveSuccessMsg('Settings saved successfully.');
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3500);
  };

  const handleResetToDefault = () => {
    setAlertNotifications(true);
    setMaintReminders(true);
    setAutoRefresh(true);
    setRefreshInterval(30000);
    const firstRobotId = robots[0]?.id ?? '';
    setDefaultRobotId(firstRobotId);
    setTheme('light');
    onSetSidebarCollapsed?.(false);

    localStorage.setItem('robopulse_setting_alert_notifications', 'true');
    localStorage.setItem('robopulse_setting_maint_reminders', 'true');
    localStorage.setItem('robopulse_setting_auto_refresh', 'true');
    localStorage.setItem('robopulse_refresh_interval', '30000');
    if (firstRobotId) {
      localStorage.setItem('robopulse_default_robot', firstRobotId);
    }

    setSaveSuccessMsg('Preferences reset to default values.');
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3500);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await changeUserPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPasswordSuccess(res.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess(null);
      }, 1800);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // User display values
  const displayName = user?.name || 'T A THANGADURAI SIVA';
  const displayUsername = user?.username || user?.email || 'siva@robopulse.io';
  const displayRole = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Operator';

  const formattedLastCheck = lastUpdated
    ? `${lastUpdated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div style={{ maxWidth: '940px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* 1. Page Header */}
      <div style={{ marginBottom: '22px' }}>
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.03em',
          }}
        >
          Settings
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Manage your preferences and system configuration
        </p>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: 'rgba(22, 163, 74, 0.12)',
            border: '1px solid rgba(22, 163, 74, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#16a34a',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '18px',
          }}
        >
          <Check size={16} />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* 2. Profile Card */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Profile
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Manage your account profile and security settings
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '18px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '6px',
                }}
              >
                Full Name
              </label>
              <div
                style={{
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {displayName}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '6px',
                }}
              >
                Username
              </label>
              <div
                style={{
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {displayUsername}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '6px',
                }}
              >
                Role
              </label>
              <div
                style={{
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {displayRole}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="btn btn-default"
              onClick={() => {
                setPasswordError(null);
                setPasswordSuccess(null);
                setPasswordModalOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12.5px',
                fontWeight: 600,
                padding: '8px 14px',
              }}
            >
              <KeyRound size={15} />
              <span>Change Password</span>
            </button>
          </div>
        </div>

        {/* 3. Appearance Card */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Appearance
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Customize the look and feel of the application
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
            }}
          >
            {/* Theme Selector */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                }}
              >
                Theme
              </label>
              <div
                style={{
                  display: 'inline-flex',
                  gap: '4px',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '12.5px',
                    fontWeight: theme === 'light' ? 700 : 500,
                    backgroundColor: theme === 'light' ? 'var(--bg-surface)' : 'transparent',
                    color: theme === 'light' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    boxShadow: theme === 'light' ? 'var(--shadow-xs)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Sun size={15} />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '12.5px',
                    fontWeight: theme === 'dark' ? 700 : 500,
                    backgroundColor: theme === 'dark' ? 'var(--bg-surface)' : 'transparent',
                    color: theme === 'dark' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    boxShadow: theme === 'dark' ? 'var(--shadow-xs)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Moon size={15} />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            {/* Sidebar State Selector */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                }}
              >
                Sidebar
              </label>
              <div
                style={{
                  display: 'inline-flex',
                  gap: '4px',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => onSetSidebarCollapsed?.(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '12.5px',
                    fontWeight: !sidebarCollapsed ? 700 : 500,
                    backgroundColor: !sidebarCollapsed ? 'var(--bg-surface)' : 'transparent',
                    color: !sidebarCollapsed ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    boxShadow: !sidebarCollapsed ? 'var(--shadow-xs)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <PanelLeft size={15} />
                  <span>Expanded</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetSidebarCollapsed?.(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '12.5px',
                    fontWeight: sidebarCollapsed ? 700 : 500,
                    backgroundColor: sidebarCollapsed ? 'var(--bg-surface)' : 'transparent',
                    color: sidebarCollapsed ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    boxShadow: sidebarCollapsed ? 'var(--shadow-xs)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <PanelLeftClose size={15} />
                  <span>Collapsed</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Notifications Card */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Notifications
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Configure how you receive alerts and notifications
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Alert Notifications */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-surface-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Alert Notifications
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Receive alerts for critical events and abnormal conditions
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setAlertNotifications((prev) => !prev)}
                role="switch"
                aria-checked={alertNotifications}
                style={{
                  width: '46px',
                  height: '24px',
                  borderRadius: '12px',
                  backgroundColor: alertNotifications ? 'var(--accent-primary)' : 'var(--border-strong)',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s ease',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    transform: alertNotifications ? 'translateX(22px)' : 'translateX(0)',
                    transition: 'transform 0.2s ease',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                />
              </button>
            </div>

            {/* Maintenance Reminders */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-surface-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Maintenance Reminders
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Get notified about upcoming maintenance schedules
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setMaintReminders((prev) => !prev)}
                role="switch"
                aria-checked={maintReminders}
                style={{
                  width: '46px',
                  height: '24px',
                  borderRadius: '12px',
                  backgroundColor: maintReminders ? 'var(--accent-primary)' : 'var(--border-strong)',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s ease',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    transform: maintReminders ? 'translateX(22px)' : 'translateX(0)',
                    transition: 'transform 0.2s ease',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 5. Monitoring Card */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Monitoring
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Configure monitoring and data refresh preferences
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Auto Refresh Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-surface-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Auto Refresh
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Automatically refresh live data and dashboard
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAutoRefresh((prev) => !prev)}
                role="switch"
                aria-checked={autoRefresh}
                style={{
                  width: '46px',
                  height: '24px',
                  borderRadius: '12px',
                  backgroundColor: autoRefresh ? 'var(--accent-primary)' : 'var(--border-strong)',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s ease',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    transform: autoRefresh ? 'translateX(22px)' : 'translateX(0)',
                    transition: 'transform 0.2s ease',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Refresh Interval */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Refresh Interval
                </label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    backgroundColor: 'var(--bg-surface-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>60 seconds</option>
                  <option value={300000}>5 minutes</option>
                </select>
              </div>

              {/* Default Robot */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Default Robot
                </label>
                <select
                  value={defaultRobotId}
                  onChange={(e) => setDefaultRobotId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    backgroundColor: 'var(--bg-surface-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {robots.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.serial_number}) - {r.model}
                    </option>
                  ))}
                  {robots.length === 0 && <option value="">No robots available</option>}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 6. System Card */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                System
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                View system status and connection information
              </p>
            </div>

            <button
              type="button"
              className="btn btn-default"
              onClick={handleHealthCheck}
              disabled={isCheckingHealth}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 12px',
              }}
            >
              <RefreshCw size={13} className={isCheckingHealth ? 'animate-spin' : ''} />
              <span>{isCheckingHealth ? 'Checking...' : 'Check Now'}</span>
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            {/* API Status */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-surface-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                API Status
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13.5px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isConnected ? '#16a34a' : '#dc2626',
                    display: 'inline-block',
                  }}
                />
                <span style={{ color: isConnected ? '#16a34a' : '#dc2626' }}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            {/* Backend Port */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-surface-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Backend Port
              </div>
              <div className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                5000
              </div>
            </div>

            {/* Database Status */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-surface-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Database Status
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13.5px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isConnected ? '#16a34a' : '#dc2626',
                    display: 'inline-block',
                  }}
                />
                <span style={{ color: isConnected ? '#16a34a' : '#dc2626' }}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            {/* Last Connection Check */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-surface-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Last Connection Check
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formattedLastCheck}
              </div>
            </div>
          </div>
        </div>

        {/* 7. Bottom Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
          }}
        >
          <button
            type="button"
            className="btn btn-default"
            onClick={handleResetToDefault}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              padding: '9px 16px',
            }}
          >
            <RotateCcw size={14} />
            <span>Reset to Default</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveChanges}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              padding: '9px 18px',
            }}
          >
            <Save size={14} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
          onClick={() => setPasswordModalOpen(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Change Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {passwordError && (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#dc2626',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={15} />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(22, 163, 74, 0.1)',
                  border: '1px solid rgba(22, 163, 74, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#16a34a',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Check size={15} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '5px',
                    }}
                  >
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-surface-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '5px',
                    }}
                  >
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 chars (uppercase, lowercase, number)"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-surface-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '5px',
                    }}
                  >
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-surface-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                    required
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    marginTop: '8px',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={() => setPasswordModalOpen(false)}
                    disabled={passwordLoading}
                    style={{ fontSize: '12.5px', padding: '7px 14px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={passwordLoading}
                    style={{ fontSize: '12.5px', padding: '7px 16px' }}
                  >
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
