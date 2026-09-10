import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  Factory,
  UsersRound,
  Radio,
  Sparkles,
  Bell,
  Wrench,
  FileBarChart,
  Settings,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Sun,
  Moon,
  Flashlight,
  X,
} from 'lucide-react';
import type { HealthStatus } from '../../types/api';
import { useTheme } from '../../context/ThemeContext';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeVariant?: 'red' | 'amber';
}

interface SidebarProps {
  currentPath: string;
  health: HealthStatus | null;
  healthError: boolean;
  alertCount?: number;
  user?: { name?: string } | null;
  onLogout: () => void;
  collapsed?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  health,
  healthError,
  alertCount = 0,
  user,
  onLogout,
  collapsed = true,
  onClose,
}) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleNavClick = (path: string) => {
    navigate(path);
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      onClose?.();
    }
  };

  const handleBrandClick = () => {
    navigate(user ? '/overview' : '/');
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      onClose?.();
    }
  };

  const handleLogoutClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      onClose?.();
    }
    onLogout();
  };

  const navItems: NavItem[] = [
    {
      path: '/overview',
      label: 'Overview',
      icon: <LayoutDashboard size={18} strokeWidth={2} />,
    },
    {
      path: '/robots',
      label: 'Robots',
      icon: <Cpu size={18} strokeWidth={2} />,
    },
    {
      path: '/production-lines',
      label: 'Production Lines',
      icon: <Factory size={18} strokeWidth={2} />,
    },
    {
      path: '/live-monitoring',
      label: 'Live Monitoring',
      icon: <Radio size={18} strokeWidth={2} />,
    },
    {
      path: '/predictions',
      label: 'Predictions',
      icon: <Sparkles size={18} strokeWidth={2} />,
    },
    {
      path: '/alerts',
      label: 'Alerts',
      icon: <Bell size={18} strokeWidth={2} />,
      badge: alertCount > 0 ? alertCount : undefined,
      badgeVariant: 'red',
    },
    {
      path: '/maintenance',
      label: 'Maintenance',
      icon: <Wrench size={18} strokeWidth={2} />,
    },
    {
      path: '/technicians',
      label: 'Technicians',
      icon: <UsersRound size={18} strokeWidth={2} />,
    },
    {
      path: '/reports',
      label: 'Reports',
      icon: <FileBarChart size={18} strokeWidth={2} />,
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: <Settings size={18} strokeWidth={2} />,
    },
  ];

  const isConnected = !healthError && health?.status === 'operational';
  const isChecking = !healthError && health === null;

  const isActive = (path: string) => {
    if (path === '/overview') {
      return currentPath === '/overview' || currentPath === '/';
    }
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  return (
    <aside
      className={`sidebar-container ${collapsed ? 'collapsed' : ''}`}
      style={{
        width: 'var(--sidebar-width)',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
        visibility: collapsed ? 'hidden' : 'visible',
        transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.22s ease',
      }}
    >
      {/* Brand Header with Hamburger Button */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handleBrandClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0,
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              padding: '2px',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <img src="/logo.svg" alt="RoboPulse logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              <span style={{ color: '#1769D1' }}>Robo</span><span style={{ color: '#F57C00' }}>Pulse</span>
            </div>
            <div
              style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                marginTop: '1px',
              }}
            >
              FLEET TELEMETRY
            </div>
          </div>
        </button>

        <button
          type="button"
          className="topbar-hamburger-btn"
          onClick={onClose}
          aria-label="Close Sidebar Navigation"
          title="Close Sidebar Navigation"
          style={{
            width: '34px',
            height: '34px',
            flexShrink: 0,
          }}
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* Nav List - scrollable, flex-grows to fill space */}
      <nav
        style={{
          flex: 1,
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          overflowY: 'auto',
        }}
      >
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNavClick(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 11px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: active ? 'var(--accent-surface)' : 'transparent',
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 500,
                fontSize: '13px',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                border: active
                  ? '1px solid var(--accent-border)'
                  : '1px solid transparent',
                width: '100%',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span
                  style={{
                    color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                    display: 'flex',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    backgroundColor: item.badgeVariant === 'red' ? 'var(--status-offline-bg)' : 'var(--status-attention-bg)',
                    color: item.badgeVariant === 'red' ? 'var(--status-offline-fg)' : 'var(--status-attention-fg)',
                    border: `1px solid ${
                      item.badgeVariant === 'red' ? 'var(--status-offline-border)' : 'var(--status-attention-border)'
                    }`,
                    flexShrink: 0,
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 1. Theme Toggle — Directly above SYSTEM HEALTH */}
      <div
        style={{
          padding: '8px 10px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 11px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface-secondary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            {theme === 'dark' ? (
              <Moon size={15} strokeWidth={2} style={{ color: '#38bdf8' }} />
            ) : (
              <Sun size={15} strokeWidth={2} style={{ color: '#f59e0b' }} />
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme === 'dark' ? '#f59e0b' : 'var(--text-muted)',
              transition: 'color 0.15s ease',
            }}
          >
            <Flashlight size={15} strokeWidth={2.2} />
          </div>
        </button>
      </div>

      {/* 2. System Health Status — Below Theme Toggle, Above Logout */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-secondary)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '4px',
          }}
        >
          SYSTEM HEALTH
        </div>

        {isChecking ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 600 }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                border: '2px solid currentColor',
                borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }}
            />
            <span>Connecting...</span>
          </div>
        ) : isConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--status-operational-fg)', fontSize: '11.5px', fontWeight: 600 }}>
            <CheckCircle2 size={13} />
            <span>API Connected</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--status-offline-fg)', fontSize: '11.5px', fontWeight: 600 }}>
            <AlertCircle size={13} />
            <span>API Disconnected</span>
          </div>
        )}

        <div className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Port: 5000
        </div>
      </div>

      {/* 3. Logout button — At the very bottom */}
      <div
        style={{
          padding: '8px 10px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handleLogoutClick}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '7px 11px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'transparent',
            color: 'var(--status-offline-fg)',
            fontWeight: 500,
            fontSize: '13px',
            border: '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--status-offline-bg)';
            e.currentTarget.style.borderColor = 'var(--status-offline-border)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
          title="Sign out of RoboPulse"
        >
          <LogOut size={16} style={{ color: 'var(--status-offline-fg)', flexShrink: 0 }} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
