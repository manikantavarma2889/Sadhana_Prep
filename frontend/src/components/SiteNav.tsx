import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../services/session.tsx';

const sectionIds = ['overview', 'how-it-works', 'preparation', 'about'] as const;
type HomeSection = 'home' | typeof sectionIds[number];

export function SiteNav() {
  const { pathname, hash, state } = useLocation();
  const { user } = useSession();
  const isHome = pathname === '/';
  const header = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState<HomeSection>(() => sectionIds.find(id => hash === '#' + id) ?? 'home');

  useEffect(() => {
    if (!isHome) return;
    const sections = sectionIds.map(id => document.getElementById(id)).filter((section): section is HTMLElement => Boolean(section));
    let frame = 0;
    const measure = () => {
      frame = 0;
      const activationLine = (header.current?.getBoundingClientRect().bottom ?? 0) + 16;
      let current: HomeSection = 'home';
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= activationLine) current = section.id as HomeSection;
      }
      setActiveSection(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    sections.forEach(section => observer.observe(section));
    if (header.current) observer.observe(header.current);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [isHome]);

  const current = isHome ? activeSection : pathname.startsWith('/preparation/') ? 'preparation' : null;
  return (
    <header className="site-header" ref={header}>
      <nav className="site-nav" aria-label="Main navigation">
        <Link to="/" aria-current={current === 'home' ? 'page' : undefined}>Home</Link>
        <Link to="/#overview" aria-current={current === 'overview' ? 'location' : undefined}>Overview</Link>
        <Link to="/#how-it-works" aria-current={current === 'how-it-works' ? 'location' : undefined}>How it works</Link>
        <Link to="/#preparation" aria-current={current === 'preparation' ? 'location' : undefined}>Preparation</Link>
        <Link to="/#about" aria-current={current === 'about' ? 'location' : undefined}>About</Link>
        <div className="site-account">
          {!isHome && user ? <Link className="site-nav-action" to="/dashboard">Workspace</Link> : <>
            <Link to="/login" state={state} aria-current={pathname === '/login' ? 'page' : undefined}>Sign in</Link>
            {!isHome && <Link to="/register" state={state} aria-current={pathname === '/register' ? 'page' : undefined}>Sign up</Link>}
          </>}
        </div>
      </nav>
    </header>
  );
}
