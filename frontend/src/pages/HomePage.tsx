import { useEffect } from 'react';
import { BookOpen, ClipboardCheck, Mic } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { InterviewWalkthrough } from '../components/InterviewWalkthrough.tsx';
import { PreparationSection } from '../components/PreparationSection.tsx';
import { SiteNav } from '../components/SiteNav.tsx';
import { BrandMark } from '../components/ui.tsx';
import { PrismaHero } from '../components/ui/prisma-hero.tsx';
import PrismSilkFooter, { type PrismSilkColumn } from '../components/ui/prism-silk-footer.tsx';

const highlights = [
  { icon: BookOpen, title: 'Build your foundations', text: 'Recognize DSA patterns, work through coding problems, and study system design with interactive diagrams. Review databases, operating systems, and networking before your next interview.' },
  { icon: Mic, title: 'Rehearse for a real role', text: 'Use a resume and a target job description to find skills worth practising. Then answer technical or behavioral questions aloud or by text, with follow-ups based on your answers.' },
  { icon: ClipboardCheck, title: 'Use the feedback to study', text: 'Review your reasoning, technical accuracy, clarity, and relevance. Read the excerpts behind the feedback and return to the Learning tracks to work on the topics you missed.' },
];

const footerColumns: PrismSilkColumn[] = [
  { title: 'Explore', links: [
    { label: 'Overview', href: '/#overview' },
    { label: 'How it works', href: '/#how-it-works' },
    { label: 'Preparation', href: '/#preparation' },
    { label: 'About', href: '/#about' },
  ] },
  { title: 'Learning tracks', links: [
    { label: 'DSA Study Sheet', href: '/preparation/dsa' },
    { label: 'System Design', href: '/preparation/system-design' },
    { label: 'Database Management', href: '/preparation/dbms' },
    { label: 'Operating Systems', href: '/preparation/os' },
    { label: 'Computer Networks', href: '/preparation/networking' },
  ] },
  { title: 'Account', links: [{ label: 'Sign in', href: '/login' }] },
];

const footerPalette = {
  paperTop: '#000000', paperLow: '#121212', glow: '#353535', ink: '#ffffff', muted: '#bcbcbc',
  line: '#ffffff2e', chip: '#ffffff10', silk: ['#383838', '#777777', '#c3c3c3', '#666666', '#a2a2a2'],
};

export default function HomePage() {
  const { hash, key } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, key]);

  return (
    <div className="landing-page">
      <SiteNav />
      <div className="site-frame"><PrismaHero /></div>
      <main className="public-content">
        <section className="public-section" id="overview" aria-labelledby="overview-title">
          <div className="public-section-head">
            <h2 id="overview-title">Overview</h2>
            <p>Prepare at your own pace, then put it into practice. Study core computer science topics and use mock interviews to get better at explaining what you know.</p>
          </div>
          <div className="public-grid">
            {highlights.map(({ icon: Icon, title, text }) => (
              <article className="public-card" key={title}>
                <Icon size={22} strokeWidth={1.6} aria-hidden />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <InterviewWalkthrough />
        <PreparationSection />
        <section className="public-section public-about" id="about" aria-labelledby="about-title">
          <h2 id="about-title">About</h2>
          <div>
            <p>Sadhana Prep connects study time with interview practice. Work through a DSA pattern or a system design case, then rehearse explaining your choices in a mock interview. Feedback helps you decide what to study for the next round.</p>
            <p>You can browse the preparation tracks as a guest. Sign in to open the full lessons, practice problems, and design cases or return to your saved interviews and reports.</p>
            <Link className="text-link" to="/#preparation">Explore preparation</Link>
          </div>
        </section>
      </main>
      <PrismSilkFooter className="landing-footer" name="Sadhana Prep" brandHref="/" logo={<BrandMark />}
        tagline="Study the fundamentals. Rehearse for the role." columns={footerColumns} socials={[]} credit={null}
        copyright={'© ' + new Date().getFullYear() + ' Sadhana Prep'} preset="nocturne" palette={footerPalette}
        height="510px" stageMinHeight="238px" maxWidth="1360px" fontFamily="inherit" grain={.48} speed={.7} />
    </div>
  );
}
