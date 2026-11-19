import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../../../shared/contracts.ts';
import { api, ApiError, onSessionLost, refreshSession, setToken, type AuthSession } from './api.ts';

type Credentials = { email: string; password: string; name?: string };
type SessionState = {
  user: User | null; loading: boolean; error: unknown; retry: () => void;
  signIn(input: Credentials, register: boolean): Promise<void>;
  changePassword(input: { password: string; confirmPassword: string }): Promise<void>;
  signOut(): Promise<void>;
  update(user: User): void;
};
const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const stop = onSessionLost(() => {
      cache.clear();
      setUser(null);
    });
    refreshSession().then(session => {
      if (alive) setUser(session.user);
    }).catch(failure => {
      if (alive && (!(failure instanceof ApiError) || failure.status !== 401)) setError(failure);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; stop(); };
  }, [cache, attempt]);

  function applySession(session: AuthSession) {
    cache.clear();
    setToken(session.accessToken);
    setUser(session.user);
    setError(null);
  }

  const value: SessionState = {
    user, loading, error,
    retry() { setLoading(true); setError(null); setAttempt(previous => previous + 1); },
    async signIn(input, register) {
      const session = await api<AuthSession>(register ? '/auth/register' : '/auth/login', { method: 'POST', auth: false, body: input });
      applySession(session);
    },
    async changePassword(input) {
      const session = await api<AuthSession>('/auth/password/change', { method: 'POST', body: input });
      applySession(session);
    },
    async signOut() {
      const logout = () => api<void>('/auth/logout', { method: 'POST', auth: false });
      await (navigator.locks ? navigator.locks.request('interviewforge-auth', logout) : logout());
      setToken(null);
      cache.clear();
      setUser(null);
    },
    update: setUser,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is required');
  return value;
}
