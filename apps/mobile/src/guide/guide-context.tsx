import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  getGuideProgress,
  type GuideProgress,
} from '@/data/guideRepository';

// Sprint 6, E10-1: the first-run guide's progress, loaded once and shared so
// the Home prompt, the Account controls and each screen's coachmark all see
// the same state without each running their own query.

type GuideContextValue = {
  /** Null until the first load resolves, or once loaded, if the guide has never been started. */
  progress: GuideProgress | null;
  /** False only before the first load resolves — tells "never started" apart from "not loaded yet". */
  loaded: boolean;
  reload: () => void;
};

const GuideContext = createContext<GuideContextValue | null>(null);

export function GuideProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<GuideProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(() => {
    void getGuideProgress().then((next) => {
      setProgress(next);
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <GuideContext.Provider value={{ progress, loaded, reload }}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuide(): GuideContextValue {
  const value = useContext(GuideContext);
  if (!value) {
    throw new Error('useGuide must be used inside <GuideProvider>');
  }
  return value;
}
