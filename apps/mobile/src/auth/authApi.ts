import { classifySignInFailure, type SignInFailure } from '@corechain/domain';

import { SERVER_URL } from '@/config';

// The phone's side of sign-in (E1-3). Plain fetch against the server's Better
// Auth routes: the session is a cookie we keep in the keystore and send back.

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

/** A sign-in that didn't work, with a kind the screen turns into plain words. */
export class SignInError extends Error {
  constructor(readonly failure: SignInFailure) {
    super(failure);
    this.name = 'SignInError';
  }
}

const SESSION_COOKIE = /((?:__Secure-)?better-auth\.session_token=[^;]+)/;

/** Pulls the session cookie out of a (possibly combined) Set-Cookie header. */
export function extractSessionCookie(setCookie: string | null): string | null {
  return setCookie?.match(SESSION_COOKIE)?.[1] ?? null;
}

async function readCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { code?: string } | null;
    return body?.code;
  } catch {
    return undefined;
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ cookie: string; user: SessionUser }> {
  let response: Response;
  try {
    response = await fetch(`${SERVER_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SERVER_URL },
      body: JSON.stringify({ email: email.trim(), password }),
    });
  } catch {
    throw new SignInError('network');
  }
  if (!response.ok) {
    throw new SignInError(classifySignInFailure(response.status, await readCode(response)));
  }
  const cookie = extractSessionCookie(response.headers.get('set-cookie'));
  const body = (await response.json()) as { user?: Partial<SessionUser> };
  if (!cookie || !body.user?.id) {
    throw new SignInError('server');
  }
  return {
    cookie,
    user: {
      id: body.user.id,
      email: body.user.email ?? email.trim(),
      name: body.user.name ?? '',
      role: body.user.role ?? 'geologist',
    },
  };
}

export type SessionCheck =
  /** The server still knows this session; `cookie` is its (possibly refreshed) cookie. */
  | { result: 'valid'; cookie: string }
  /** The server says this session is over (signed out elsewhere, account switched off). */
  | { result: 'rejected' }
  /** No answer: no signal, or the server is having a moment. Says nothing about the session. */
  | { result: 'unreachable' };

/** Asks the server whether the stored session is still good. Never throws. */
export async function checkSession(cookie: string): Promise<SessionCheck> {
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/get-session`, {
      headers: { Cookie: cookie },
    });
    if (response.status === 401) return { result: 'rejected' };
    if (!response.ok) return { result: 'unreachable' };
    const body = (await response.json()) as { session?: unknown } | null;
    if (!body?.session) return { result: 'rejected' };
    const refreshed = extractSessionCookie(response.headers.get('set-cookie'));
    return { result: 'valid', cookie: refreshed ?? cookie };
  } catch {
    return { result: 'unreachable' };
  }
}

/** Tells the server this session is over. Best effort: signing out must work with no signal. */
export async function signOutRemote(cookie: string): Promise<void> {
  try {
    await fetch(`${SERVER_URL}/api/auth/sign-out`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: SERVER_URL, 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    // Offline: the server-side session simply expires on its own.
  }
}
