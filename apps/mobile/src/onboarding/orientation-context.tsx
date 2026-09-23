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

export function OrientationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OrientationStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    void isOrientationComplete().then((done) => {
      if (!cancelled) setStatus(done ? 'done' : 'pending');
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
