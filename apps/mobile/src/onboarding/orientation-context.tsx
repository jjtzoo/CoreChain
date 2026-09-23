import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  completeOrientation,
  isOrientationComplete,
} from '@/data/orientationRepository';

// Sprint 6: gates a signed-in phone on the mandatory first-login orientation
// (name + a short tour) before the rest of the app is reachable. Loaded once,
// like the first-run guide's own progress (guide/guide-context.tsx), so the
// router's Stack.Protected guard in app/_layout.tsx and the orientation
// screen itself see the same state.

type OrientationStatus = 'loading' | 'pending' | 'done';

type OrientationContextValue = {
  status: OrientationStatus;
  complete: () => Promise<void>;
};

const OrientationContext = createContext<OrientationContextValue | null>(null);

// However `isOrientationComplete` fails — a rejection, or the underlying
// database call simply never settling — the phone must never sit stuck on
// "Opening your data..." forever. Same reasoning as the network timeouts in
// sync/device.ts and sync/connector.ts, applied to a local call this time.
const CHECK_TIMEOUT_MS = 5_000;

export function OrientationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OrientationStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    console.log('[Orientation] checking whether orientation is complete');
    const timeout = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), CHECK_TIMEOUT_MS),
    );
    Promise.race([isOrientationComplete(), timeout])
      .then((result) => {
        if (cancelled) return;
        if (result === 'timeout') {
          console.log('[Orientation] isOrientationComplete timed out');
          setStatus('pending');
          return;
        }
        console.log(`[Orientation] complete=${result}`);
        setStatus(result ? 'done' : 'pending');
      })
      .catch((error) => {
        console.log(
          `[Orientation] isOrientationComplete failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Never leaves the phone stuck on "Opening your data...": if the
        // check itself fails, fall through to orientation rather than hang.
        if (!cancelled) setStatus('pending');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const complete = useCallback(async () => {
    await completeOrientation();
    setStatus('done');
  }, []);

  return (
    <OrientationContext.Provider value={{ status, complete }}>
      {children}
    </OrientationContext.Provider>
  );
}

export function useOrientation(): OrientationContextValue {
  const value = useContext(OrientationContext);
  if (!value) {
    throw new Error('useOrientation must be used inside <OrientationProvider>');
  }
  return value;
}
