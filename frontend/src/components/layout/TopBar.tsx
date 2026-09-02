import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Search,
  Bell,
  CheckCircle2,
  AlertCircle,
  Menu,
  User,
  LogOut,
  Settings,
  ChevronDown,
  X,
  Clock,
} from 'lucide-react';
import type { HealthStatus } from '../../types/api';
import type { Robot } from '../../types/robot';

interface SearchResult {
  robot: Robot;
}

interface UserProfile {
  name: string;
  role: string;
  initials: string;
}

interface TopBarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  health: HealthStatus | null;
  healthError: boolean;
  alertCount?: number;
  onNavigateAlerts?: () => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  onToggleSidebar?: () => void;
  robots?: Robot[];
  onSelectRobot?: (robot: Robot) => void;
  user?: UserProfile;
  onLogout?: () => void;
  onNavigateSettings?: () => void;
  currentPath?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  onRefresh,
  isRefreshing,
  lastUpdated,
  health,
  healthError,
  alertCount = 0,
  onNavigateAlerts,
  searchTerm = '',
  onSearchChange,
  onToggleSidebar,
  robots = [],
  onSelectRobot,
  user = { name: 'Admin', role: 'Administrator', initials: 'AD' },
  onLogout,
  onNavigateSettings,
}) => {
  const navigate = useNavigate();

  // Connected = health check succeeded and returned operational status
  // Show as connecting (neither connected nor offline label) if not yet checked
  const isConnected = !healthError && health?.status === 'operational';
  const isChecking = !healthError && health === null;

  // Search state
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // User dropdown state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(
    (term: string) => {
      if (!term.trim() || robots.length === 0) {
        setSearchResults([]);
        return;
      }
      const q = term.toLowerCase().trim();
      const results: SearchResult[] = robots
        .filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q) ||
            r.serial_number.toLowerCase().includes(q) ||
            r.model.toLowerCase().includes(q) ||
            r.manufacturer.toLowerCase().includes(q) ||
            r.status.toLowerCase().includes(q)
        )
        .slice(0, 6)
        .map((r) => ({ robot: r }));
      setSearchResults(results);
      setActiveResultIndex(-1);
    },
    [robots]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(searchTerm);
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, performSearch]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
        setActiveResultIndex(-1);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveResultIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveResultIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeResultIndex >= 0 && searchResults[activeResultIndex]) {
        selectRobot(searchResults[activeResultIndex].robot);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchFocused(false);
      setActiveResultIndex(-1);
      inputRef.current?.blur();
    }
  };

  const selectRobot = (robot: Robot) => {
    onSelectRobot?.(robot);
    onSearchChange?.('');
    setSearchFocused(false);
    setSearchResults([]);
    setActiveResultIndex(-1);
  };

  const clearSearch = () => {
    onSearchChange?.('');
    setSearchResults([]);
    setActiveResultIndex(-1);
    inputRef.current?.focus();
  };

  const showDropdown = searchFocused && searchTerm.trim().length > 0;

  // Live real-time browser clock in 24-hour format (HH:mm:ss, updates every 1 second)
  const get24HourTime = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const [currentTime, setCurrentTime] = useState<string>(get24HourTime);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(get24HourTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px 0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        gap: '16px',
      }}
    >
      {/* Left: 1. Hamburger button (☰) + 2. RoboPulse Brand (Clickable -> /overview) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button
          type="button"
          className="btn-icon"
          onClick={onToggleSidebar}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-surface-secondary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
          }}
          aria-label="Toggle Sidebar Navigation"
        >
          <Menu size={20} strokeWidth={2.2} />
        </button>

        {/* RoboPulse Logo + Brand Title */}
        <button
          type="button"
          onClick={() => navigate('/overview')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            backgroundColor: 'transparent',
            border: 'none',
            padding: '4px 6px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            textAlign: 'left',
            flexShrink: 0,
            transition: 'opacity 0.15s ease',
          }}
          title="RoboPulse Overview"
          aria-label="RoboPulse Overview"
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
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
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              RoboPulse
            </span>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              FLEET TELEMETRY
            </span>
          </div>
        </button>
      </div>

      {/* Center: 3. Global Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '440px' }}>
        {/* Search with dropdown */}
        <div ref={searchRef} style={{ position: 'relative', width: '100%' }}>
          <div className="search-input-wrapper" style={{ width: '100%' }}>
            <Search size={15} />
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Search robot, ID, serial, model, manufacturer..."
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={handleSearchKeyDown}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-surface-secondary)',
                borderColor: searchFocused ? 'var(--accent-primary)' : 'var(--border-subtle)',
                height: '38px',
                fontSize: '13px',
                paddingRight: searchTerm ? '32px' : '12px',
                boxShadow: searchFocused ? '0 0 0 2px rgba(37,99,235,0.15)' : 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              autoComplete="off"
              spellCheck={false}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={clearSearch}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: '2px',
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                overflow: 'hidden',
                maxHeight: '360px',
                overflowY: 'auto',
              }}
            >
              {searchResults.length === 0 ? (
                <div
                  style={{
                    padding: '16px 18px',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                    textAlign: 'center',
                  }}
                >
                  No robots found for &quot;{searchTerm}&quot;
                </div>
              ) : (
                <>
                  <div
                    style={{
                      padding: '8px 14px 6px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    {searchResults.length} Robot{searchResults.length !== 1 ? 's' : ''} Found
                  </div>
                  {searchResults.map((result, idx) => (
                    <button
                      key={result.robot.id}
                      type="button"
                      onClick={() => selectRobot(result.robot)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 14px',
                        backgroundColor: idx === activeResultIndex ? 'var(--accent-surface)' : 'transparent',
                        border: 'none',
                        borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                        setActiveResultIndex(idx);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          idx === activeResultIndex ? 'var(--accent-surface)' : 'transparent';
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            marginBottom: '2px',
                          }}
                        >
                          {result.robot.name}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span className="font-mono">SN: {result.robot.serial_number}</span>
                          <span>·</span>
                          <span>{result.robot.manufacturer} {result.robot.model}</span>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color:
                            result.robot.status === 'operational'
                              ? 'var(--status-operational-fg)'
                              : result.robot.status === 'attention'
                              ? 'var(--status-attention-fg)'
                              : result.robot.status === 'maintenance'
                              ? 'var(--status-maintenance-fg)'
                              : 'var(--status-offline-fg)',
                          backgroundColor:
                            result.robot.status === 'operational'
                              ? 'var(--status-operational-bg)'
                              : result.robot.status === 'attention'
                              ? 'var(--status-attention-bg)'
                              : result.robot.status === 'maintenance'
                              ? 'var(--status-maintenance-bg)'
                              : 'var(--status-offline-bg)',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          border: `1px solid ${
                            result.robot.status === 'operational'
                              ? 'var(--status-operational-border)'
                              : result.robot.status === 'attention'
                              ? 'var(--status-attention-border)'
                              : result.robot.status === 'maintenance'
                              ? 'var(--status-maintenance-border)'
                              : 'var(--status-offline-border)'
                          }`,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          textTransform: 'capitalize',
                        }}
                      >
                        {result.robot.status}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Date, Alerts, Status, Refresh, User */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        {/* Live Clock Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-surface-secondary)',
            border: '1px solid var(--border-subtle)',
            whiteSpace: 'nowrap',
          }}
          title="Local Time"
        >
          <Clock size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span className="font-mono tabular-nums">{currentTime}</span>
        </div>

        {/* Live API Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11.5px',
            fontWeight: 600,
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isChecking
              ? 'var(--bg-surface-secondary)'
              : isConnected
              ? 'var(--status-operational-bg)'
              : 'var(--status-offline-bg)',
            border: `1px solid ${
              isChecking
                ? 'var(--border-subtle)'
                : isConnected
                ? 'var(--status-operational-border)'
                : 'var(--status-offline-border)'
            }`,
            color: isChecking
              ? 'var(--text-muted)'
              : isConnected
              ? 'var(--status-operational-fg)'
              : 'var(--status-offline-fg)',
            whiteSpace: 'nowrap',
          }}
        >
          {isChecking ? (
            <>
              <span
                style={{
                  display: 'inline-block',
                  width: '11px',
                  height: '11px',
                  borderRadius: '50%',
                  border: '2px solid currentColor',
                  borderTopColor: 'transparent',
                  flexShrink: 0,
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>Connecting...</span>
            </>
          ) : isConnected ? (
            <>
              <CheckCircle2 size={13} />
              <span>API Live</span>
            </>
          ) : (
            <>
              <AlertCircle size={13} />
              <span>API Offline</span>
            </>
          )}
        </div>

        {/* Notification Bell with Badge */}
        <button
          type="button"
          onClick={onNavigateAlerts}
          className="btn-icon"
          style={{
            position: 'relative',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-secondary)',
          }}
          title={alertCount > 0 ? `${alertCount} active alerts` : 'No active alerts'}
        >
          <Bell size={17} style={{ color: 'var(--text-secondary)' }} />
          {alertCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '9px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-surface)',
              }}
            >
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>

        {/* Refresh Button */}
        <button
          type="button"
          className="btn btn-default"
          onClick={onRefresh}
          disabled={isRefreshing}
          title={
            lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : 'Refresh fleet telemetry'
          }
          style={{ height: '36px', padding: '0 12px', fontWeight: 600, fontSize: '12px' }}
        >
          <RefreshCw
            size={13}
            className={isRefreshing ? 'spin' : ''}
            style={{ color: 'var(--accent-primary)' }}
          />
          <span style={{ display: 'none' }}>Refresh</span>
        </button>

        {/* User Profile with Dropdown */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingLeft: '10px',
              paddingRight: '8px',
              paddingTop: '6px',
              paddingBottom: '6px',
              border: userMenuOpen ? '1px solid var(--accent-border)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              background: userMenuOpen ? 'var(--accent-surface)' : 'transparent',
              transition: 'background 0.15s ease',
            }}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            title="User menu"
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-surface)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
                flexShrink: 0,
                border: '1px solid var(--border-subtle)',
              }}
            >
              {user.initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, textAlign: 'left' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user.name}
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                {user.role}
              </span>
            </div>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-muted)',
                transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '200px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                overflow: 'hidden',
                animation: 'modal-fade-in 0.15s ease',
              }}
            >
              {/* Profile header */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface-secondary)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {user.role}
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: '6px 0' }}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 16px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <User size={15} style={{ color: 'var(--text-muted)' }} />
                  Profile
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onNavigateSettings?.();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 16px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Settings size={15} style={{ color: 'var(--text-muted)' }} />
                  Settings
                </button>

                <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout?.();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 16px',
                    fontSize: '13px',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <LogOut size={15} style={{ color: '#dc2626' }} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
