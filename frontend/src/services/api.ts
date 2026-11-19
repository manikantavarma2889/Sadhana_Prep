import type { ApiErrorBody, User } from '../../../shared/contracts.ts';

export type AuthSession = { user: User; accessToken: string };
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = 'REQUEST_FAILED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let token: string | null = null;
let pendingRefresh: Promise<AuthSession> | null = null;
let sessionLost: () => void = () => {};
export const setToken = (value: string | null) => { token = value; };
export const onSessionLost = (listener: () => void) => {
  sessionLost = listener;
  return () => { if (sessionLost === listener) sessionLost = () => {}; };
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  auth?: boolean;
};

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  const { method = 'GET', body, idempotencyKey, auth = true } = options;
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers.set('Content-Type', 'application/json');
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  if (auth && token) headers.set('Authorization', 'Bearer ' + token);
  let response: Response;
  try {
    response = await fetch('/api/v1' + path, {
      method, credentials: 'same-origin', headers, signal: AbortSignal.timeout(60_000),
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach Sadhana Prep. Check your connection and try again.', 'NETWORK');
  }
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => null) as { data: T } | ApiErrorBody | null;
  if (!response.ok || !result || !('data' in result)) {
    const error = result && 'error' in result ? result.error : null;
    throw new ApiError(response.status, error?.message ?? 'Sadhana Prep returned an unexpected response.', error?.code);
  }
  return result.data;
}

export function refreshSession(): Promise<AuthSession> {
  if (!pendingRefresh) {
    const rotate = async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const session = await request<AuthSession>('/auth/refresh', { method: 'POST', auth: false });
          setToken(session.accessToken);
          return session;
        } catch (error) {
          if (!(error instanceof ApiError) || error.code !== 'REFRESH_RACE' || attempt >= 2) throw error;
          await new Promise(resolve => setTimeout(resolve, 180));
        }
      }
    };
    const coordinated = async () => navigator.locks ? await navigator.locks.request('interviewforge-auth', rotate) : await rotate();
    pendingRefresh = coordinated()
      .finally(() => { pendingRefresh = null; });
  }
  return pendingRefresh;
}

export async function api<T>(path: string, options: RequestOptions = {}) {
  const previous = token;
  try {
    return await request<T>(path, options);
  } catch (error) {
    if (options.auth === false || !(error instanceof ApiError) || error.status !== 401) throw error;
    try {
      if (!token || token === previous) await refreshSession();
    } catch (refreshError) {
      if (refreshError instanceof ApiError && refreshError.status === 401) {
        setToken(null);
        sessionLost();
      }
      throw refreshError;
    }
    return request<T>(path, options);
  }
}

export function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  return query.size ? '?' + query : '';
}
