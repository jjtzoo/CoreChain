import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useSync } from '@/sync/sync-context';

/**
 * Runs `load` each time the screen comes into focus, and again whenever sync
 * finishes bringing in or sending records, so a list never stays out of date
 * behind a download (for example on a phone just signed in).
 */
export function useFocusReload(load: () => void | Promise<void>) {
  const { dataVersion } = useSync();
  useFocusEffect(
    useCallback(() => {
      void load();
      // dataVersion is not read above; changing it is what re-runs the load.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, dataVersion]),
  );
}
