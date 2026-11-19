import { useState, type FormEvent, type PointerEvent } from 'react';
import { Cloud } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authReturnPath } from '../../../shared/auth-path.ts';
import googleLogo from '../assets/google-g.png';
import { PasswordInput } from '../components/PasswordInput.tsx';
import { SiteNav } from '../components/SiteNav.tsx';
import { ErrorNotice, Loading } from '../components/ui.tsx';
import { api, ApiError } from '../services/api.ts';
import { useSession } from '../services/session.tsx';

type AuthMode = 'login' | 'register';
const googleMessages = {
  'email-in-use': 'This email already has a Sadhana Prep account. Sign in with its password or request a reset link.',
  cancelled: 'Google sign-in was cancelled.',
  retry: 'Google sign-in could not be completed. Please try again.',
} as const;

function followPointer(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return;
  const card = event.currentTarget;
  const { left, top, width, height } = card.getBoundingClientRect();
  card.style.setProperty('--eye-x', ((event.clientX - left) / width - .5) * 8 + 'px');
  card.style.setProperty('--eye-y', ((event.clientY - top) / height - .5) * 6 + 'px');
}

function AuthForm({ mode, target, googleMessage, passwordReset }: {
  mode: AuthMode; target: string; googleMessage?: string; passwordReset: boolean;
}) {
  const { signIn } = useSession();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [openingGoogle, setOpeningGoogle] = useState(false);
  const navigate = useNavigate();
  const register = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim().toLowerCase();
    setError(null);
    setPending(true);
    try {
      await signIn({
        email, password: String(data.get('password')), ...(register ? { name: String(data.get('name')) } : {}),
      }, register);
      navigate(target, { replace: true });
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }

  async function continueWithGoogle() {
    setError(null);
    setOpeningGoogle(true);
    try {
      const { url } = await api<{ url: string }>('/auth/google/start', { method: 'POST', auth: false, body: { mode, returnTo: target } });
      window.location.assign(url);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 404 ? new Error('Google sign-in is unavailable on this preview.') : failure);
      setOpeningGoogle(false);
    }
  }

  return <section className="auth-form" aria-labelledby="account-title" onPointerMove={followPointer}
    onPointerLeave={event => {
      event.currentTarget.style.removeProperty('--eye-x');
      event.currentTarget.style.removeProperty('--eye-y');
    }}>
    <div className="auth-cloud" aria-hidden>
      <Cloud size={52} strokeWidth={1.4} />
      <div className="auth-eyes"><span /><span /></div>
    </div>
    <p className="auth-wordmark">Sadhana Prep</p>
    <h1 id="account-title">{register ? 'Create an account' : 'Welcome back'}</h1>
    {passwordReset && <p className="success-text auth-feedback" role="status">Password updated. Sign in with your new password.</p>}
    <ErrorNotice error={error ?? (googleMessage ? new Error(googleMessage) : null)} />
    <form className="form-stack" onSubmit={event => void submit(event)}>
      {register && <label>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Alex Morgan" /></label>}
      <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" maxLength={254} /></label>
      <PasswordInput name="password" required minLength={register ? 12 : 1} maxLength={128} showStrength={register}
        autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'At least 12 characters' : 'Enter your password'} />
      <button className="button button-primary auth-submit" disabled={pending || openingGoogle}>
        {pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
      </button>
    </form>
    <button type="button" className="button auth-google" onClick={() => void continueWithGoogle()} disabled={pending || openingGoogle}>
      <img src={googleLogo} width={20} height={20} alt="" />{openingGoogle ? 'Opening Google…' : 'Continue with Google'}
    </button>
    {!register && <p className="auth-switch auth-recovery"><Link to="/forgot-password" state={{ from: target }}>Forgot password?</Link></p>}
    <p className="auth-switch">
      {register ? 'Already have an account? ' : 'Don’t have an account? '}
      <Link to={register ? '/login' : '/register'} state={{ from: target }}>{register ? 'Sign in' : 'Sign up'}</Link>
    </p>
  </section>;
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { user, loading } = useSession();
  const { state, search } = useLocation();
  const params = new URLSearchParams(search);
  const target = authReturnPath(state?.from ?? params.get('next'));
  const googleResult = params.get('google');
  const googleMessage = googleResult && Object.hasOwn(googleMessages, googleResult) ? googleMessages[googleResult as keyof typeof googleMessages] : undefined;
  if (loading) return <main className="full-center"><Loading label="Checking your session…" /></main>;
  if (user) return <Navigate to={target} replace />;

  return <div className="site-frame auth-shell">
    <SiteNav />
    <main className="auth-stage">
      <AuthForm key={mode} mode={mode} target={target} googleMessage={googleMessage} passwordReset={params.get('password') === 'reset'} />
    </main>
  </div>;
}

