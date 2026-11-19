import { lazy, Suspense, useLayoutEffect, useState } from 'react';
import { BookOpen, CircleHelp, ClipboardList, FileText, Gauge, House, LogOut, Plus, Settings, UserRound } from 'lucide-react';
import { Link, matchPath, Navigate, NavLink, Outlet, Route, Routes, useLocation, useOutletContext } from 'react-router-dom';
import type { User } from '../../shared/contracts.ts';
import { Brand, ErrorNotice, Loading } from './components/ui.tsx';
import { WorkspaceSidebarNav, type WorkspaceLink } from './components/WorkspaceSidebarNav.tsx';
import { prepHubPath } from './features/learning-tracks.ts';
import { InterviewMediaLayout } from './features/voice/interview-media.tsx';
import { useSession } from './services/session.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage.tsx';
import { Dashboard, HistoryPage, SettingsPage } from './pages/Dashboard.tsx';
import { PrepHub } from './pages/PrepHub.tsx';
import { NewInterview, ResumePage } from './pages/Preparation.tsx';
import { InterviewPage, ReportPage } from './pages/InterviewPage.tsx';

const HomePage = lazy(() => import('./pages/HomePage.tsx'));
const LearningTrackPage = lazy(() => import('./pages/LearningTrackPage.tsx'));

const routes: WorkspaceLink[] = [
  { title: 'Overview', path: '/dashboard', icon: Gauge },
  { title: 'New interview', path: '/interviews/new', icon: Plus },
  { title: 'Prep Hub', path: prepHubPath, icon: BookOpen, end: false },
  { title: 'Interview history', path: '/history', icon: ClipboardList },
  { title: 'Resume library', path: '/resumes', icon: FileText },
  { title: 'Settings', path: '/settings', icon: Settings },
];

function RequireSession() {
  const { user, loading, error, retry } = useSession();
  const location = useLocation();
  if (loading) return <main className="full-center"><Loading label="Checking your session…" /></main>;
  if (error && !user) return <main className="full-center"><ErrorNotice error={error} retry={retry} /></main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet context={user} />;
}

function Workspace() {
  const user = useOutletContext<User>();
  const { signOut } = useSession();
  const [logoutError, setLogoutError] = useState<unknown>(null);
  const [leaving, setLeaving] = useState(false);
  const { pathname } = useLocation();
  const activeRoute = routes.find(route => matchPath({ path: route.path, end: route.end ?? true }, pathname));
  const inInterview = !activeRoute && Boolean(matchPath('/interviews/:id', pathname) || matchPath('/interviews/:id/report', pathname));
  const title = activeRoute?.title ?? (pathname.endsWith('/report') ? 'Interview report' : 'Live interview');
  async function leave() {
    setLeaving(true);
    setLogoutError(null);
    try { await signOut(); } catch (failure) { setLogoutError(failure); } finally { setLeaving(false); }
  }
  return <div className={inInterview ? 'live-interview-shell' : 'shell'}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {!inInterview && <aside className="sidebar">
      <Link to="/dashboard" className="brand-link" aria-label="Sadhana Prep dashboard"><Brand /></Link>
      <WorkspaceSidebarNav items={routes} activePath={activeRoute?.path} />
      <div className="sidebar-bottom">
        <NavLink to="/settings" className="profile-mini"><span className="sidebar-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span>
          <span><strong>{user.name}</strong><small>Candidate</small></span>
        </NavLink>
        <button className="signout" onClick={() => void leave()} disabled={leaving}><LogOut size={17} aria-hidden /> Sign out</button>
      </div>
    </aside>}
    <div className="workspace">
      {!inInterview && <header className="topbar">
        <span className="breadcrumb"><span>Workspace</span><b>/</b>{title}</span>
        <div className="topbar-actions">
          <Link to="/" aria-label="Sadhana Prep home" className="icon-button mobile-home"><House size={18} aria-hidden /></Link>
          <Link to="/settings" aria-label="Profile settings" className="icon-button"><UserRound size={19} aria-hidden /></Link>
          <button className="icon-button mobile-signout" onClick={() => void leave()} aria-label="Sign out" disabled={leaving}><LogOut size={19} aria-hidden /></button>
        </div>
      </header>}
      <main id="main-content" className={inInterview ? 'live-interview-main' : 'workspace-main'}><ErrorNotice error={logoutError} /><Outlet /></main>
    </div>
  </div>;
}

export function App() {
  const { pathname, hash, key } = useLocation();
  useLayoutEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash, key]);

  return <Routes>
    <Route path="/" element={<Suspense fallback={<main className="full-center"><Loading label="Opening Sadhana Prep…" /></main>}><HomePage /></Suspense>} />
    <Route path="/preparation" element={<Navigate to="/#preparation" replace />} />
    <Route path="/preparation/:track" element={<Suspense fallback={<main className="full-center"><Loading label="Opening learning track…" /></main>}><LearningTrackPage /></Suspense>} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/forgot-password" element={<PasswordRecoveryPage key="request" mode="request" />} />
    <Route path="/reset-password" element={<PasswordRecoveryPage key="reset" mode="reset" />} />
    <Route element={<RequireSession />}>
      <Route element={<Workspace />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path={prepHubPath} element={<PrepHub />} />
        <Route path={prepHubPath + '/:track'} element={<Suspense fallback={<Loading label="Opening learning track…" />}><LearningTrackPage inWorkspace /></Suspense>} />
        <Route element={<InterviewMediaLayout />}>
          <Route path="/interviews/new" element={<NewInterview />} />
          <Route path="/interviews/:id" element={<InterviewPage />} />
        </Route>
        <Route path="/interviews/:id/report" element={<ReportPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/resumes" element={<ResumePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<div className="panel not-found"><CircleHelp size={36} /><h1>Page not found</h1><Link className="button button-primary" to="/dashboard">Go to overview</Link></div>} />
      </Route>
    </Route>
  </Routes>;
}
