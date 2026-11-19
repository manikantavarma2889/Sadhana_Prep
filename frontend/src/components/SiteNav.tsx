import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../services/session.tsx';

export function SiteNav() {
  const { pathname, hash, state } = useLocation();
  const { user } = useSession();
  const isHome = pathname === '/';
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <Link to="/" aria-current={pathname === '/' && !hash ? 'page' : undefined}>Home</Link>
        <Link to="/#overview" aria-current={pathname === '/' && hash === '#overview' ? 'location' : undefined}>Overview</Link>
        <Link to="/#how-it-works" aria-current={pathname === '/' && hash === '#how-it-works' ? 'location' : undefined}>How it works</Link>
        <Link to="/#preparation" aria-current={(isHome && hash === '#preparation') || pathname.startsWith('/preparation/') ? 'location' : undefined}>Preparation</Link>
        <Link to="/#about" aria-current={pathname === '/' && hash === '#about' ? 'location' : undefined}>About</Link>
        <div className="site-account">
          {!isHome && user ? <Link className="site-nav-action" to="/dashboard">Workspace</Link> : <>
            <Link className={isHome ? 'site-nav-action' : undefined} to="/login" state={state} aria-current={pathname === '/login' ? 'page' : undefined}>Sign in</Link>
            {!isHome && <Link className="site-nav-action" to="/register" state={state} aria-current={pathname === '/register' ? 'page' : undefined}>Sign up</Link>}
          </>}
        </div>
      </nav>
    </header>
  );
}
