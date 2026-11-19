import { CircleAlert, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Provider } from '../../../shared/contracts.ts';
import brandLogo from '../assets/sadhana-prep-logo.png';

export const providerLabel: Record<Provider, string> = {
  local: 'Local practice', openai: 'OpenAI', gemini: 'Gemini', ollama: 'Ollama',
};

export function Brand() {
  return <span className="brand"><BrandMark /><span>Sadhana Prep</span></span>;
}

export function BrandMark() {
  return <span className="brand-mark"><img src={brandLogo} alt="" loading="lazy" decoding="async" /></span>;
}

export function PageHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading">
    <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action}
  </div>;
}

export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  return <div className="notice notice-error" role="alert">
    <CircleAlert size={18} aria-hidden />
    <span>{error instanceof Error ? error.message : 'Something went wrong. Try again.'}</span>
    {retry && <button className="button button-small button-secondary" onClick={retry}>Retry</button>}
  </div>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading" role="status"><LoaderCircle size={19} aria-hidden className="spin" />{label}</div>;
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return <div className="empty"><span className="empty-icon">{icon}</span><strong>{title}</strong>{children}</div>;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function StatusPill({ active }: { active: boolean }) {
  return <span className={active ? 'pill pill-active' : 'pill pill-done'}><span />{active ? 'In progress' : 'Completed'}</span>;
}
