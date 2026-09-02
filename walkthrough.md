# RoboPulse Industrial Predictive Maintenance Platform Upgrade Walkthrough

The RoboPulse platform has been upgraded into a production-quality industrial fleet monitoring and predictive maintenance system, aligned with the visual hierarchy, layout, 6-card KPI structure, middle 3-card analytics grid, lower 2-card operations grid, and pure light-theme aesthetic of the visual reference dashboard.

---

## 1. Backend REST Endpoints & Database Integration

Added full PostgreSQL REST controller, service, and routing layers:
- **Alerts & Anomalies**:
  - `GET /api/alerts`: Fetches real anomalies joined with robots and production lines from PostgreSQL.
  - `PATCH /api/alerts/:id/acknowledge` & `POST /api/alerts/:id/acknowledge`: Sets alert status to `investigating`.
  - `PATCH /api/alerts/:id/resolve` & `POST /api/alerts/:id/resolve`: Resolves alert and marks `resolved_at = NOW()`.
- **Maintenance & Work Orders**:
  - `GET /api/maintenance`: Fetches maintenance records joined with robots and components.
  - `POST /api/maintenance`: Inserts a new scheduled maintenance task in PostgreSQL.
  - `PATCH /api/maintenance/:id/complete` & `POST /api/maintenance/:id/complete`: Marks task completed in PostgreSQL with `performed_at = NOW()`.
- **Predictive Risk Intelligence**:
  - `GET /api/predictions`: Fetches failure risk assessments and health scores from PostgreSQL.
- **Sensor Telemetry**:
  - `GET /api/robots/:id/sensor-readings` & `GET /api/robots/:id/readings`: Fetches real robot sensor history.

---

## 2. Visual Architecture & Layout Matching Reference

### 2.1 Top 6-Card KPI Summary Row
1. **Total Machines**: Total count (`8`), "All registered units", blue CPU icon, action link `View all machines →`.
2. **Healthy**: Operational count (`5`), percentage (`63% of total`), green shield icon, green sparkline.
3. **Warning**: Units requiring attention (`1`), percentage (`13% of total`), amber warning icon, amber sparkline.
4. **Critical**: Offline/critical units (`1`), percentage (`13% of total`), red alert icon, red sparkline.
5. **Maintenance Due**: Scheduled work orders (`4`), purple wrench icon, action link `View schedule →`.
6. **Avg Health Score**: Fleet average health score (`84%`), cyan pulse icon, label `↑ 3% this month`, cyan sparkline.

### 2.2 Middle 3-Card Dashboard Row
1. **Machine Health Overview / Telemetry Area Chart**:
   - Area chart with smooth curves (`type="monotone"`) and subtle gradient fills.
   - Metric selector tabs: `Temperature (°C)`, `Vibration (mm/s)`, `Motor Current (A)`, `Pressure (bar)`.
   - Continuous multi-harmonic waveform calculation (`telemetrySmoothing.ts`) preserving true baseline data.
   - Full-width interactive hover cursor tracking smoothly from $X=0$ to $X=\text{width}$.
2. **Critical Machines / At-Risk Robots**:
   - Ranked list of at-risk robots with robot icon, name, serial number, failure risk %, severity badges (`Critical`, `Warning`), and click-to-open inspection.
3. **Machines by Status Donut**:
   - Donut chart with total count centered (`8 Total`).
   - Legend breakdown with colored dots, counts, and dynamic percentages (`Healthy`, `Warning`, `Critical`, `Maintenance`).

### 2.3 Lower 2-Card Operations Row
1. **Recent Alerts**:
   - Live PostgreSQL anomaly table showing `Time`, `Machine`, `Alert Type`, `Severity`, `Status`.
   - Direct action link `View all alerts →`.
2. **Health Score Distribution**:
   - Recharts Bar Chart showing score bins `0-20`, `20-40`, `40-60`, `60-80`, `80-100` colored red, orange, amber, light green, bright green.
   - Line filtering dropdown.

---

## 3. All 9 Dedicated Navigation Pages

| Page | Key Capabilities |
| :--- | :--- |
| **Dashboard** (`Overview.tsx`) | 6 KPI cards, 3 middle analytics panels, 2 lower operations panels. |
| **Machines** (`RobotsPage.tsx`) | Full searchable, sortable registry table with status badges, runtime, and click-to-open `RobotDetailsModal`. |
| **Production Lines** (`ProductionLinesPage.tsx`) | Facility plant cells (`ASM-A`, `WLD-B`, `PNT-C`, `PKG-D`), robot counts, line details, and assigned units. |
| **Live Monitoring** (`LiveMonitoringPage.tsx`) | Real-time telemetry dashboard with robot switcher, live polling toggle (1s / 3s / 5s / paused), 4 real-time sensor cards, continuous waveform, and threshold indicators. |
| **Predictions** (`PredictionsPage.tsx`) | Telemetry-based Predictive Risk Assessment from PostgreSQL, showing Risk Level, Health Score %, Failure Probability %, Factor Decomposition, Primary Risk Reason, and Prescriptive Recommendations. |
| **Alerts** (`AlertsPage.tsx`) | PostgreSQL-backed alerts table with search, severity filter, status filter, and interactive **Acknowledge** and **Resolve** action buttons. |
| **Maintenance** (`MaintenancePage.tsx`) | PostgreSQL-backed maintenance log with Upcoming, Overdue, and Completed tabs, **Schedule Maintenance** modal, and **Mark Complete** action. |
| **Reports** (`ReportsPage.tsx`) | Operational summaries, reliability records, and functional **CSV Export** button for fleet health, alerts, maintenance costs, and risk assessments. |
| **Settings** (`SettingsPage.tsx`) | API diagnostic connection test, telemetry auto-refresh interval with `localStorage` persistence, and alert threshold configuration. |

---

## 4. Validation & Quality Checks

- **Backend TypeScript Build**: `tsc` compiled with **0 errors**.
- **Frontend ESLint Audit**: `eslint .` passed with **0 errors, 0 warnings**.
- **Frontend Production Build**: `vite build` compiled all 2,477 modules into `dist/` with **0 errors**.
