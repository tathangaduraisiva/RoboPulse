import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { RobotDetailsModal } from './components/robots/RobotDetailsModal';
import { ThemeProvider } from './context/ThemeContext';

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const unresolvedAlertCount = useMemo(
    () => alerts.filter((a) => a.status === 'open' || a.status === 'investigating').length,
    [alerts]
  );

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
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
            <Route path="/alerts" element={
              <AlertsPage
                alerts={alerts}
                robots={robots}
                onSelectRobot={handleSelectRobot}
                onRefreshAlerts={executeFleetFetch}
              />
            } />
            <Route path="/maintenance" element={
              <MaintenancePage
                maintenance={maintenance}
                robots={robots}
                onSelectRobot={handleSelectRobot}
                onRefreshMaintenance={executeFleetFetch}
              />
            } />
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
