import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authReturnPath } from '../../../shared/auth-path.ts';
import { PasswordInput } from '../components/PasswordInput.tsx';
import { SiteNav } from '../components/SiteNav.tsx';
import { ErrorNotice } from '../components/ui.tsx';
import { api, ApiError } from '../services/api.ts';

export function PasswordRecoveryPage({ mode }: { mode: 'request' | 'reset' }) {
  const { hash, state } = useLocation();
  const token = new URLSearchParams(hash.slice(1)).get('token');
  const reset = mode === 'reset';
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const loginState = { from: authReturnPath(state?.from) };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    if (reset && password !== data.get('confirmPassword')) {
      setError(new Error('The new passwords do not match.'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (reset) {
        await api('/auth/password/reset', { method: 'POST', auth: false, body: { token, password } });
        window.location.replace('/login?password=reset');
      } else {
        const email = String(data.get('email')).trim().toLowerCase();
        await api('/auth/password/forgot', { method: 'POST', auth: false, body: { email } });
        setSent(true);
      }
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 404 ? new Error('Password recovery is unavailable on this preview.') : failure);
    } finally {
      setPending(false);
    }
  }

  return <div className="site-frame auth-shell">
    <SiteNav />
    <main className="auth-stage">
      <section className="auth-form" aria-labelledby="recovery-title">
        <p className="auth-wordmark">Sadhana Prep</p>
        <h1 id="recovery-title">{reset ? 'Set a new password' : 'Reset your password'}</h1>
        <ErrorNotice error={error} />
        {sent ? <p className="success-text" role="status">If there’s an account for this email, you’ll receive a link to reset its password.</p>
          : reset && !token ? <p>This reset link is missing its token. <Link className="text-link" to="/forgot-password">Request a new link</Link></p>
          : <form className="form-stack" onSubmit={event => void submit(event)}>
            {reset ? <>
              <PasswordInput label="New password" name="password" autoComplete="new-password" minLength={12} maxLength={128}
                required showStrength placeholder="At least 12 characters" />
              <PasswordInput label="Confirm new password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={128} required />
            </> : <>
              <p>Enter the email you use for Sadhana Prep to request a password reset link.</p>
              <label>Email address<input type="email" name="email" autoComplete="email" maxLength={254} required
                defaultValue={typeof state?.email === 'string' ? state.email : ''} /></label>
            </>}
            <button className="button button-primary auth-submit" disabled={pending}>
              {pending ? 'Please wait…' : reset ? 'Save new password' : 'Email reset link'}
            </button>
          </form>}
        {reset && error instanceof ApiError && error.code === 'INVALID_RESET_LINK' &&
          <p className="auth-switch"><Link to="/forgot-password">Request a new link</Link></p>}
        <p className="auth-switch"><Link to="/login" state={loginState}>Back to sign in</Link></p>
      </section>
    </main>
  </div>;
}
