import { sessionStatus, type SessionStatus } from '@corechain/domain';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { checkSession, signInWithEmail, signOutRemote, type SessionUser } from './authApi';
import { clearSession, loadSession, saveSession, type StoredSession } from './sessionStore';
import { flushFeedback } from '@/feedback/sender';
import { updateOwnName } from '@/data/rosterRepository';

// Who is signed in on this phone (E1-3), and whether that sign-in can still
// sync (E1-4). The app never locks a geologist out of their own data: signed
// in or with an expired session, local data stays readable. Only a phone that
// has never signed in is held at the sign-in screen.

type Auth =
  | { phase: 'loading' }
  | { phase: 'signed-out' }
  | { phase: 'signed-in'; session: StoredSession; rejected: boolean };

type SessionContextValue = {
  phase: Auth['phase'];
  user: SessionUser | null;
  /** The session cookie, for calls to our own server. Null when signed out. */
  cookie: string | null;
  /** How healthy the sign-in is; null when nobody is signed in. */
  health: SessionStatus | null;
  /** Throws a SignInError the screen can turn into words. */
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Updates the signed-in account's own name, on the server and here. False if it didn't reach the server. */
  updateName: (name: string) => Promise<boolean>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<Auth>({ phase: 'loading' });
  const [now, setNow] = useState(() => new Date());
  const [activeCount, setActiveCount] = useState(0);

  // Read the stored session once at start.
  useEffect(() => {
    let cancelled = false;
    loadSession().then((stored) => {
      if (cancelled) return;
      setAuth(stored ? { phase: 'signed-in', session: stored, rejected: false } : { phase: 'signed-out' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Each time the app comes back to the front, refresh the clock and re-check.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(new Date());
        setActiveCount((count) => count + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  // Ask the server whether the session is still good, whenever there is signal.
  // No answer changes nothing: the 30-day clock keeps running from the last
  // good answer. A "no" means the account was switched off or signed out
  // elsewhere, so syncing stops until the person signs in again.
  const cookie = auth.phase === 'signed-in' ? auth.session.cookie : null;
  useEffect(() => {
    if (!cookie) return;
    let cancelled = false;
    checkSession(cookie).then(async (check) => {
      if (cancelled) return;
      if (check.result === 'rejected') {
        setAuth((previous) =>
          previous.phase === 'signed-in' && previous.session.cookie === cookie
            ? { ...previous, rejected: true }
            : previous,
        );
      } else if (check.result === 'valid') {
        const verifiedAt = new Date().toISOString();
        const stored = await loadSession();
        if (stored && stored.cookie === cookie) {
          await saveSession({ ...stored, cookie: check.cookie, lastVerifiedAt: verifiedAt });
        }
        if (cancelled) return;
        // There is signal and a good session: send any feedback written offline.
        flushFeedback(check.cookie).catch(() => {});
        setNow(new Date());
        setAuth((previous) =>
          previous.phase === 'signed-in' && previous.session.cookie === cookie
            ? {
                phase: 'signed-in',
                rejected: false,
                session: { ...previous.session, cookie: check.cookie, lastVerifiedAt: verifiedAt },
              }
            : previous,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cookie, activeCount]);

  const signIn = async (email: string, password: string) => {
    const { cookie: newCookie, user } = await signInWithEmail(email, password);
    const session: StoredSession = {
      cookie: newCookie,
      user,
      lastVerifiedAt: new Date().toISOString(),
    };
    await saveSession(session);
    setNow(new Date());
    setAuth({ phase: 'signed-in', session, rejected: false });
  };

  const signOut = async () => {
    if (auth.phase === 'signed-in') {
      await signOutRemote(auth.session.cookie);
    }
    await clearSession();
    setAuth({ phase: 'signed-out' });
  };

  const updateName = async (name: string): Promise<boolean> => {
    if (auth.phase !== 'signed-in') return false;
    const ok = await updateOwnName(auth.session.cookie, auth.session.user.id, name);
    if (!ok) return false;
    const session: StoredSession = {
      ...auth.session,
      user: { ...auth.session.user, name },
    };
    await saveSession(session);
    setAuth({ phase: 'signed-in', session, rejected: auth.rejected });
    return true;
  };

  let health: SessionStatus | null = null;
  if (auth.phase === 'signed-in') {
    const status = sessionStatus(auth.session.lastVerifiedAt, now);
    health = auth.rejected
      ? { ...status, state: 'expired', daysLeft: 0, canSync: false }
      : status;
  }

  return (
    <SessionContext.Provider
      value={{
        phase: auth.phase,
        user: auth.phase === 'signed-in' ? auth.session.user : null,
        cookie: auth.phase === 'signed-in' ? auth.session.cookie : null,
        health,
        signIn,
        signOut,
        updateName,
      }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return value;
}
