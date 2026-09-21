import * as Sentry from '@sentry/react-native';
import { useSegments } from 'expo-router';
import { useEffect } from 'react';

import { SENTRY_DSN } from '@/config';

/**
 * E10-3: crash reports, so field failures can be fixed. Sentry's native
 * layer already attaches the app version and device model to every report —
 * nothing here needs to capture that itself.
 */
export function initSentry() {
  Sentry.init({ dsn: SENTRY_DSN });
}

/** Tags every report with the screen it happened on (same idea as E10-2 feedback). */
export function useSentryScreenTracking() {
  const segments = useSegments();
  useEffect(() => {
    Sentry.setTag('screen', segments.join('/') || 'index');
  }, [segments]);
}
