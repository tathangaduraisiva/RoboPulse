import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import type { Robot } from './types/robot';
import type { ProductionLine } from './types/productionLine';
import type { Alert } from './types/alert';
import type { MaintenanceTask } from './types/maintenance';
import type { PredictionInsight } from './types/prediction';
import type { HealthStatus } from './types/api';
import { fetchRobots } from './api/robots';
import { fetchProductionLines } from './api/productionLines';
import { fetchAlerts } from './api/alerts';
import { fetchMaintenance } from './api/maintenance';
import { fetchPredictions } from './api/predictions';
import { fetchHealthStatus } from './api/health';
import { clearSensorCache } from './api/sensors';
import { loginUser, registerUser } from './api/auth';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Overview } from './pages/Overview';
import { ProductionLinesPage } from './pages/ProductionLinesPage';
import { RobotsPage } from './pages/RobotsPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { PredictionsPage } from './pages/PredictionsPage';
import { AlertsPage } from './pages/AlertsPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TechniciansPage } from './pages/TechniciansPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { RobotDetailsModal } from './components/robots/RobotDetailsModal';
import { ThemeProvider } from './context/ThemeContext';

// -----------------------------------------------------------------
// Alert toast — shown once per login session per alert ID
// -----------------------------------------------------------------
interface AlertToast {
  id: string;           // alert.id — used as React key and dismiss key
  severity: Alert['severity'];
  robot_name: string;
  anomaly_type: string;
  description: string;
}

// Module-level map: sessionToken → Set of alert IDs already shown.
// Kept outside any component so React 18 StrictMode's artificial
// unmount→remount cycle cannot reset it.  A new token (new login)
// automatically gets a fresh Set; the previous session's Set is
// discarded when its token key is no longer referenced.
const sessionShownIds = new Map<string, Set<string>>();

function getShownIds(token: string): Set<string> {
  if (!sessionShownIds.has(token)) {
    sessionShownIds.set(token, new Set());
  }
  return sessionShownIds.get(token)!;
}

export interface UserSession {
  id: string;
  name: string;
  username: string;
  role: string;
  initials: string;
  token: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// -----------------------------------------------------------------
// AppShell — the authenticated application frame
// -----------------------------------------------------------------
interface AppShellProps {
  user: UserSession;
  onLogout: () => void;
}

function AppShell({ user, onLogout }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [robots, setRobots] = useState<Robot[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceTask[]>([]);
  const [predictions, setPredictions] = useState<PredictionInsight[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // ---- per-session alert toasts with 1-second queue drain ----
  // shownAlertIds lives in module scope so StrictMode remount cannot reset it.
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  // Queue of toasts waiting to be displayed, drained one per second.
  const queueRef = useRef<AlertToast[]>([]);
  // True while the drain interval is running — prevents duplicate intervals.
  const drainingRef = useRef<boolean>(false);
  const drainTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Per-toast auto-dismiss timers: id → setTimeout handle.
  const autoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Start draining the queue at 1-second intervals if not already running.
  const startDrain = useCallback(() => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    drainTimerRef.current = setInterval(() => {
      const next = queueRef.current.shift();
      if (next) {
        // Append at the END so newest sits at the bottom of the stack.
        setToasts((prev) => [...prev, next]);
      } else {
        // Queue empty — stop the interval.
        if (drainTimerRef.current !== null) {
          clearInterval(drainTimerRef.current);
          drainTimerRef.current = null;
        }
        drainingRef.current = false;
      }
    }, 1000);
  }, []);

  // Stop the drain timer and all auto-dismiss timers on unmount (logout).
  useEffect(() => {
    return () => {
      if (drainTimerRef.current !== null) {
        clearInterval(drainTimerRef.current);
        drainTimerRef.current = null;
      }
      drainingRef.current = false;
      autoTimersRef.current.forEach((t) => clearTimeout(t));
      autoTimersRef.current.clear();
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    // Cancel the auto-dismiss timer if it's still running.
    const existing = autoTimersRef.current.get(id);
    if (existing !== undefined) {
      clearTimeout(existing);
      autoTimersRef.current.delete(id);
    }
    // Mark dismissed in the module-level set so it never re-queues.
    getShownIds(user.token).add(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [user.token]);

  // Auto-dismiss each toast 4 seconds after it first appears.
  useEffect(() => {
    toasts.forEach((toast) => {
      if (autoTimersRef.current.has(toast.id)) return; // timer already set
      const handle = setTimeout(() => {
        autoTimersRef.current.delete(toast.id);
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000);
      autoTimersRef.current.set(toast.id, handle);
    });
  }, [toasts]);

  const selectedRobot = useMemo(
    () => robots.find((r) => r.id === selectedRobotId) ?? null,
    [robots, selectedRobotId]
  );

  const executeFleetFetch = useCallback(async () => {
    try {
      const [healthRes, robotsRes, linesRes, alertsRes, maintRes, predsRes] =
        await Promise.allSettled([
          fetchHealthStatus(),
          fetchRobots(),
          fetchProductionLines(),
          fetchAlerts(),
          fetchMaintenance(),
          fetchPredictions(),
        ]);

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
        setHealthError(false);
      } else {
        setHealth(null);
        setHealthError(true);
      }

      if (robotsRes.status === 'fulfilled') {
        setRobots(robotsRes.value);
      } else {
        console.error('Failed to fetch robots:', robotsRes.reason);
      }

      if (linesRes.status === 'fulfilled') {
        setProductionLines(linesRes.value);
      } else {
        console.error('Failed to fetch production lines:', linesRes.reason);
      }

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value);
      } else {
        console.error('Failed to fetch alerts:', alertsRes.reason);
      }

      if (maintRes.status === 'fulfilled') {
        setMaintenance(maintRes.value);
      } else {
        console.error('Failed to fetch maintenance:', maintRes.reason);
      }

      if (predsRes.status === 'fulfilled') {
        setPredictions(predsRes.value);
      } else {
        console.error('Failed to fetch predictions:', predsRes.reason);
      }

      const allFailed =
        robotsRes.status === 'rejected' &&
        linesRes.status === 'rejected' &&
        alertsRes.status === 'rejected';

      if (allFailed) {
        setError('Unable to reach RoboPulse backend API.');
      } else {
        setError(null);
      }

      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    executeFleetFetch();
    const interval = setInterval(executeFleetFetch, 10000);
    return () => clearInterval(interval);
  }, [executeFleetFetch]);

  // Enqueue new toasts; drain one per second so they stagger 1 000 ms apart.
  // Resolved alerts are never shown and any visible toast for a resolved alert
  // is immediately dismissed.
  useEffect(() => {
    if (alerts.length === 0) return;
    const shown = getShownIds(user.token);

    // 1. Mark every resolved alert as "shown" so it can never be enqueued,
    //    even if its status later changes in the database.
    for (const alert of alerts) {
      if (alert.status === 'resolved') {
        shown.add(alert.id);
      }
    }

    // 2. Dismiss any currently-visible toast whose alert is now resolved.
    const resolvedIds = new Set(
      alerts.filter((a) => a.status === 'resolved').map((a) => a.id)
    );
    setToasts((prev) => prev.filter((t) => !resolvedIds.has(t.id)));
    // Also flush them from the drain queue before they surface.
    queueRef.current = queueRef.current.filter((t) => !resolvedIds.has(t.id));

    // 3. Enqueue only open / investigating alerts not yet shown.
    let added = false;
    for (const alert of alerts) {
      if (alert.status === 'resolved') continue;
      if (shown.has(alert.id)) continue;
      shown.add(alert.id);
      queueRef.current.push({
        id: alert.id,
        severity: alert.severity,
        robot_name: alert.robot_name,
        anomaly_type: alert.anomaly_type,
        description: alert.description,
      });
      added = true;
    }
    if (added) startDrain();
  }, [alerts, user.token, startDrain]);

  const handleRefresh = useCallback(() => {
    clearSensorCache();
    setIsRefreshing(true);
    executeFleetFetch();
  }, [executeFleetFetch]);

  const handleSelectRobot = useCallback((robot: Robot) => {
    setSelectedRobotId(robot.id);
  }, []);

  const handleLogoutClick = useCallback(() => {
    onLogout();
    navigate('/');
  }, [onLogout, navigate]);

  const onRetry = useCallback(() => {
    setLoading(true);
    executeFleetFetch();
  }, [executeFleetFetch]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarCollapsed(true);
  }, []);

  const unresolvedAlertCount = useMemo(
    () => alerts.filter((a) => a.status === 'open' || a.status === 'investigating').length,
    [alerts]
  );

  return (
    <div className="app-layout">
      {/* Mobile Backdrop Overlay — Closes drawer when tapping outside on mobile/tablet */}
      {!sidebarCollapsed && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={handleCloseSidebar}
          aria-hidden="true"
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onClose={handleCloseSidebar}
        currentPath={location.pathname}
        health={health}
        healthError={healthError}
        alertCount={unresolvedAlertCount}
        user={user}
        onLogout={handleLogoutClick}
      />

      <div className={`app-main-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <TopBar
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          health={health}
          healthError={healthError}
          alertCount={unresolvedAlertCount}
          onNavigateAlerts={() => navigate('/alerts')}
          searchTerm={globalSearch}
          onSearchChange={setGlobalSearch}
          onToggleSidebar={handleToggleSidebar}
          robots={robots}
          onSelectRobot={handleSelectRobot}
          user={user}
          onLogout={handleLogoutClick}
          onNavigateSettings={() => navigate('/settings')}
          currentPath={location.pathname}
        />

        <main className="app-content">
          <Routes>
            <Route
              path="/overview"
              element={
                <Overview
                  robots={robots}
                  productionLines={productionLines}
                  alerts={alerts}
                  maintenance={maintenance}
                  predictions={predictions}
                  loading={loading}
                  error={error}
                  onRetry={onRetry}
                  onSelectRobot={handleSelectRobot}
                  onNavigateTo={(path: string) => navigate(path)}
                />
              }
            />
            <Route path="/robots/:robotId" element={
              <RobotsPage
                robots={robots}
                productionLines={productionLines}
                loading={loading}
                error={error}
                onRetry={onRetry}
                onSelectRobot={handleSelectRobot}
              />
            } />
            <Route path="/robots" element={
              <RobotsPage
                robots={robots}
                productionLines={productionLines}
                loading={loading}
                error={error}
                onRetry={onRetry}
                onSelectRobot={handleSelectRobot}
              />
            } />
            <Route path="/production-lines" element={
              <ProductionLinesPage
                productionLines={productionLines}
                robots={robots}
                loading={loading}
                error={error}
                onRetry={onRetry}
                onSelectRobot={handleSelectRobot}
              />
            } />
            <Route path="/technicians" element={
              <TechniciansPage robots={robots} />
            } />
            {/* Summary-card deep-link routes — redirect to the technicians page with the
                appropriate ?filter= query param so the existing filter logic applies. */}
            <Route path="/technicians/all" element={<Navigate to="/technicians?filter=all" replace />} />
            <Route path="/technicians/available" element={<Navigate to="/technicians?filter=available" replace />} />
            <Route path="/technicians/assigned" element={<Navigate to="/technicians?filter=assigned" replace />} />
            <Route path="/technicians/offline" element={<Navigate to="/technicians?filter=offline" replace />} />
            <Route path="/live-monitoring" element={
              <LiveMonitoringPage robots={robots} onSelectRobot={handleSelectRobot} />
            } />
            <Route path="/predictions" element={
              <PredictionsPage
                predictions={predictions}
                robots={robots}
                onSelectRobot={handleSelectRobot}
                onNavigateMaintenance={() => navigate('/maintenance')}
              />
            } />
            {/* Summary-card deep-link routes — redirect to the predictions page with the
                appropriate ?filter= query param so the existing filter logic applies. */}
            <Route path="/predictions/elevated-risk" element={<Navigate to="/predictions?filter=elevated-risk" replace />} />
            <Route path="/predictions/moderate-degradation" element={<Navigate to="/predictions?filter=moderate-degradation" replace />} />
            <Route path="/predictions/stable" element={<Navigate to="/predictions?filter=stable" replace />} />
            <Route path="/predictions/fleet-health" element={<Navigate to="/predictions?filter=fleet-health" replace />} />
            <Route path="/alerts" element={
              <AlertsPage
                alerts={alerts}
                robots={robots}
                onSelectRobot={handleSelectRobot}
                onRefreshAlerts={executeFleetFetch}
              />
            } />
            {/* Summary-card deep-link routes — redirect to the alerts page with the
                appropriate ?filter= query param so the existing filter logic applies. */}
            <Route path="/alerts/active" element={<Navigate to="/alerts?filter=active" replace />} />
            <Route path="/alerts/critical" element={<Navigate to="/alerts?filter=critical" replace />} />
            <Route path="/alerts/investigation" element={<Navigate to="/alerts?filter=investigation" replace />} />
            <Route path="/alerts/resolved" element={<Navigate to="/alerts?filter=resolved" replace />} />
            <Route path="/maintenance" element={
              <MaintenancePage
                maintenance={maintenance}
                robots={robots}
                onSelectRobot={handleSelectRobot}
                onRefreshMaintenance={executeFleetFetch}
              />
            } />
            {/* Summary-card deep-link routes — redirect to the maintenance page with the
                appropriate ?tab= query param so the existing tab logic applies. */}
            <Route path="/maintenance/upcoming" element={<Navigate to="/maintenance?tab=upcoming" replace />} />
            <Route path="/maintenance/overdue" element={<Navigate to="/maintenance?tab=overdue" replace />} />
            <Route path="/maintenance/completed" element={<Navigate to="/maintenance?tab=completed" replace />} />
            <Route path="/maintenance/budget" element={<Navigate to="/maintenance?tab=budget" replace />} />
            <Route path="/reports" element={
              <ReportsPage
                robots={robots}
                alerts={alerts}
                maintenance={maintenance}
                predictions={predictions}
              />
            } />
            <Route path="/settings" element={
              <SettingsPage
                health={health}
                healthError={healthError}
                onRefreshHealth={executeFleetFetch}
                lastUpdated={lastUpdated}
                robots={robots}
                user={user}
                sidebarCollapsed={sidebarCollapsed}
                onSetSidebarCollapsed={setSidebarCollapsed}
              />
            } />
            {/* Default authenticated redirect to /overview */}
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </main>
      </div>

      {selectedRobot && (
        <RobotDetailsModal
          robot={selectedRobot}
          onClose={() => setSelectedRobotId(null)}
          productionLines={productionLines}
        />
      )}

      {/* Alert toast stack — bottom-right, stacked upward, newest at bottom */}
      {toasts.length > 0 && (
        <div className="alert-toast-stack">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`alert-toast alert-toast--${toast.severity}`}
              role="button"
              tabIndex={0}
              onClick={() => navigate('/alerts')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/alerts'); }}
            >
              {/* Left: severity icon */}
              <div className={`alert-toast__icon-wrap alert-toast__icon-wrap--${toast.severity}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {toast.severity === 'critical' || toast.severity === 'high' ? (
                    <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
                  ) : toast.severity === 'medium' ? (
                    <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
                  ) : (
                    <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                  )}
                </svg>
              </div>

              {/* Centre: text content */}
              <div className="alert-toast__body">
                <div className="alert-toast__header">
                  <span className="alert-toast__severity">{toast.severity.toUpperCase()}</span>
                  <span className="alert-toast__robot">{toast.robot_name}</span>
                </div>
                <span className="alert-toast__type">{toast.anomaly_type}</span>
                <span className="alert-toast__desc">{toast.description || '\u00A0'}</span>
              </div>

              {/* Right: dismiss — stops propagation so card click doesn't also fire */}
              <button
                type="button"
                className="alert-toast__dismiss"
                aria-label="Dismiss alert notification"
                onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Root App with BrowserRouter + auth guard
// -----------------------------------------------------------------
function App() {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const stored = localStorage.getItem('robopulse_user');
      return stored ? (JSON.parse(stored) as UserSession) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = useCallback(async (username: string, password: string) => {
    const auth = await loginUser(username, password);
    const displayName = auth.user.name || auth.user.username;
    const session: UserSession = {
      id: auth.user.id,
      name: displayName,
      username: auth.user.username,
      role: auth.user.role,
      initials: getInitials(displayName),
      token: auth.token,
    };

    setUser(session);
    localStorage.setItem('robopulse_user', JSON.stringify(session));
    localStorage.setItem('robopulse_token', auth.token);
    return session;
  }, []);

  /**
   * Called by AuthCallbackPage after a successful Google OAuth redirect.
   * Creates the same UserSession format as handleLogin so the rest of the
   * app is completely unaware of how the user authenticated.
   */
  const handleGoogleCallback = useCallback((
    token: string,
    user: { id: string; username: string; name?: string; email?: string | null; role: string }
  ) => {
    const displayName = user.name || user.username;
    const session: UserSession = {
      id: user.id,
      name: displayName,
      username: user.username,
      role: user.role,
      initials: getInitials(displayName),
      token,
    };
    setUser(session);
    localStorage.setItem('robopulse_user', JSON.stringify(session));
    localStorage.setItem('robopulse_token', token);
  }, []);

  const handleRegister = useCallback(async (data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    return registerUser(data);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('robopulse_user');
    localStorage.removeItem('robopulse_token');
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Public auth routes */}
          <Route
            path="/"
            element={
              user
                ? <Navigate to="/overview" replace />
                : <LoginPage onLogin={handleLogin} />
            }
          />
          <Route
            path="/signup"
            element={
              user
                ? <Navigate to="/overview" replace />
                : <SignupPage onRegister={handleRegister} />
            }
          />
          {/* Google OAuth callback — always public, handles its own redirect */}
          <Route
            path="/auth/callback"
            element={<AuthCallbackPage onGoogleLogin={handleGoogleCallback} />}
          />
          {/* Protected routes */}
          <Route
            path="/*"
            element={
              user
                ? <AppShell user={user} onLogout={handleLogout} />
                : <Navigate to="/" replace />
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
