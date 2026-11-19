import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../services/api.ts';
import { useSession } from '../services/session.tsx';
import { PasswordInput } from './PasswordInput.tsx';
import { ErrorNotice } from './ui.tsx';

export function PasswordSettings() {
  const { user, changePassword } = useSession();
  const hasPassword = user?.passwordEnabled !== false;
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmationMismatch, setConfirmationMismatch] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const confirmationErrorId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get('password'));
    const confirmPassword = String(data.get('confirmPassword'));
    setSaved(false);
    setError(null);
    if (password !== confirmPassword) {
      setConfirmationMismatch(true);
      const confirmation = form.elements.namedItem('confirmPassword');
      if (confirmation instanceof HTMLInputElement) confirmation.focus();
      return;
    }
    setConfirmationMismatch(false);
    setPending(true);
    try {
      await changePassword({ password, confirmPassword });
      setFormVersion(previous => previous + 1);
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 404 ? new Error('Password changes are unavailable on this preview.') : failure);
    } finally {
      setPending(false);
    }
  }

  return <section className="panel form-panel settings-panel" aria-labelledby="password-settings-title">
    <h2 id="password-settings-title">{hasPassword ? 'Change password' : 'Set a password'}</h2>
    {hasPassword ? <form className="form-stack" key={formVersion} onChange={() => {
      setSaved(false);
      setConfirmationMismatch(false);
    }} onSubmit={event => void submit(event)}>
      <PasswordInput label="New password" name="password" autoComplete="new-password" minLength={12} maxLength={128}
        required showStrength placeholder="At least 12 characters" />
      <PasswordInput label="Confirm password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={128}
        required aria-invalid={confirmationMismatch || undefined} aria-describedby={confirmationMismatch ? confirmationErrorId : undefined} />
      {confirmationMismatch && <p className="notice notice-error" id={confirmationErrorId} role="alert">The new passwords do not match.</p>}
      <ErrorNotice error={error} />
      {saved && <p className="success-text" role="status">Password changed. You’ve been signed out of other sessions.</p>}
      <div><button className="button button-primary" disabled={pending}>{pending ? 'Saving…' : 'Change password'}</button></div>
    </form> : <p>Your account uses Google sign-in. To add a password, request a link at your account email address.</p>}
    <Link className="text-link settings-recovery" to="/forgot-password" state={{ email: user?.email, from: '/settings' }}>
      {hasPassword ? 'Forgot your password?' : 'Email me a link to set a password'}
    </Link>
  </section>;
}
