import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Box,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Gauge,
  Layers3,
  LogOut,
  Menu,
  Moon,
  Radio,
  ShieldCheck,
  Sun,
  TriangleAlert,
  X,
} from 'lucide-react';
import { mutate, getCsrf } from './api';
import { useSession } from './state';
import { Feedback, label } from './ui';
import {
  DashboardPage,
  ServicesPage,
  ServiceDetail,
  IncidentsPage,
  IncidentDetail,
  DeploymentsPage,
  ActivityPage,
  SettingsPage,
  StatusPage,
  AuthPage,
} from './pages';
function Layout() {
  const { user, setUser, loading } = useSession();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [light, setLight] = useState(() => localStorage.getItem('opsatlas-theme') === 'light');
  const [error, setError] = useState('');
  const items = [
    ['/', Gauge, 'Overview'],
    ['/services', Layers3, 'Service registry'],
    ['/incidents', TriangleAlert, 'Incidents'],
    ['/deployments', Box, 'Deployments'],
    ['/activity', Activity, 'Activity log'],
  ] as const;
  if (loading)
    return (
      <div className="full-center">
        <Feedback loading />
      </div>
    );
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  async function logout() {
    try {
      await mutate('/auth/logout', 'POST');
      await getCsrf();
      setUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Logout failed.');
    }
  }
  function toggleTheme() {
    setLight((v) => !v);
    localStorage.setItem('opsatlas-theme', light ? 'dark' : 'light');
  }
  return (
    <div className={`app-shell ${light ? 'light' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {menu && (
        <button
          className="nav-scrim"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Link to="/" className="brand" onClick={() => setMenu(false)}>
          <span className="brand-mark">
            <ChartNoAxesCombined size={23} />
          </span>
          OpsAtlas
        </Link>
        <div className="workspace-switch">
          <span className="workspace-icon">P</span>
          <div>
            Platform workspace<small>Single-team operations</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {items.map(([to, Icon, title]) => (
            <NavLink end={to === '/'} key={to} to={to} onClick={() => setMenu(false)}>
              <Icon size={19} />
              {title}
              {to === '/' && <span className="nav-active-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="nav-label nav-second">TOOLS & ACCESS</div>
        <nav>
          <NavLink to="/settings" onClick={() => setMenu(false)}>
            <ShieldCheck size={19} />
            Team access
          </NavLink>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            <CircleHelp size={19} />
            API documentation
            <ArrowUpRight size={13} />
          </a>
          <Link to="/status" onClick={() => setMenu(false)}>
            <Radio size={19} />
            Public status
            <ExternalLink size={13} />
          </Link>
        </nav>
        <div className="sidebar-footer">
          <div className="system-note">
            <span className="status-dot" />
            <span>
              Local-first. Cloud-ready.<small>A clear view of your operations.</small>
            </span>
          </div>
          <div className="profile">
            <div className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div className="profile-info">
              <strong>{user.displayName}</strong>
              <small>{label(user.role)}</small>
            </div>
            <button className="icon-button" aria-label="Sign out" onClick={() => void logout()}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <div className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label={menu ? 'Close menu' : 'Open menu'}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>
              {items.find(([to]) =>
                to === '/' ? location.pathname === '/' : location.pathname.startsWith(to),
              )?.[2] ?? 'Team access'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="version-pill">v1.0</span>
            <button
              className="icon-button"
              aria-label={light ? 'Use dark theme' : 'Use light theme'}
              onClick={toggleTheme}
            >
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="topbar-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
          </div>
        </div>
        <main id="main" className="main-content">
          {error && <Feedback error={error} />}
          <Outlet />
        </main>
        <footer className="main-footer">
          <span>
            <span className="tiny-mark">△</span> OpsAtlas{' '}
            <span className="muted">/ Operational clarity, by design.</span>
          </span>
          <span>Built for the people behind the systems.</span>
        </footer>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage register />} />
      <Route path="/status" element={<StatusPage />} />
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:id" element={<ServiceDetail />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="incidents/:id" element={<IncidentDetail />} />
        <Route path="deployments" element={<DeploymentsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="*"
          element={
            <div className="empty">
              <h1>Page not found</h1>
              <Link to="/">Return to overview</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
