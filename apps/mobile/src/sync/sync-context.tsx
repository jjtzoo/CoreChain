import { syncSummary, type SyncSummary } from '@corechain/domain';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';

import { useSession } from '@/auth/session-context';
import { getSyncDatabase, queueAllLocalRowsForUpload } from '@/data/database';
import { CoreChainConnector } from './connector';
import { countOpenIssues } from './issues';
import { getDataOwner, setDataOwner } from './owner';
import { topUpSampleBlocks } from './sampleBlocks';
import { wipeDevice } from './wipe';

// Keeps this phone and the server in step (E8). It only ever runs while someone
// is signed in with a session that may sync; the geologist's own work never
// waits on it. Screens draw once the local database is ready, which does not
// need signal.

type Preparation = 'preparing' | 'ready' | 'failed';

type SyncContextValue = {
  /** The local database is open and belongs to the signed-in account. */
  preparation: Preparation;
  summary: SyncSummary | null;
  /**
   * Goes up each time a sync completes. Screens that list records reload when
   * it changes, so downloaded work appears without leaving the screen.
   */
  dataVersion: number;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const STATUS_REFRESH_MS = 5000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const { phase, user, cookie, health, signOut } = useSession();
  // Which account the database was last prepared (or failed to prepare) for.
  // The state shown is worked out from these, so switching account starts again
  // at "preparing" without any reset.
  const [preparedFor, setPreparedFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [liveSummary, setSummary] = useState<SyncSummary | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const userId = user?.id ?? null;
  const canSync = health?.canSync ?? false;

  // The connector reads the newest cookie on demand, so a refreshed session
  // never forces a reconnect.
  const cookieRef = useRef<string | null>(cookie);
  useEffect(() => {
    cookieRef.current = cookie;
  }, [cookie]);

  let preparation: Preparation = 'preparing';
  if (!userId) preparation = phase === 'loading' ? 'preparing' : 'ready';
  else if (failedFor === userId) preparation = 'failed';
  else if (preparedFor === userId) preparation = 'ready';
  const summary = preparation === 'ready' && userId ? liveSummary : null;

  // 1. Open the database and make sure it holds this account's records.
  useEffect(() => {
    if (!userId) return; // nobody signed in: only the sign-in screen shows
    let cancelled = false;
    (async () => {
      const sync = await getSyncDatabase();
      const owner = await getDataOwner();

      if (owner && owner !== userId) {
        const { count } = await sync.getUploadQueueStats();
        if (count > 0) {
          // Two people's work must never mix. Send the first person's changes
          // (sign in as them) before handing the phone to someone else.
          Alert.alert(
            'Unsent work on this phone',
            'This phone still holds work from another account that has not been sent. Sign in with that account and let it finish sending first.',
          );
          await signOut();
          return;
        }
        await wipeDevice();
      } else if (!owner) {
        // First sign-in on a phone that already holds work from before sync:
        // that work is now this account's, and goes up with the next upload.
        await queueAllLocalRowsForUpload();
      }
      if (owner !== userId) await setDataOwner(userId);
      if (!cancelled) setPreparedFor(userId);
    })().catch(() => {
      if (!cancelled) setFailedFor(userId);
    });
    return () => {
      cancelled = true;
    };
    // signOut changes identity every render; only a change of person matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // 2. Connect while signed in with a session that may sync, and report status.
  useEffect(() => {
    if (preparation !== 'ready' || !userId) return;
    let cancelled = false;
    let stopListening = () => {};
    let timer: ReturnType<typeof setInterval> | undefined;
    let lastSyncStamp = 0;

    (async () => {
      const sync = await getSyncDatabase();

      const refresh = async () => {
        const [stats, issues] = await Promise.all([
          sync.getUploadQueueStats(),
          countOpenIssues(),
        ]);
        if (cancelled) return;
        const status = sync.currentStatus;
        const syncStamp = status.lastSyncedAt?.getTime() ?? 0;
        if (syncStamp !== lastSyncStamp) {
          lastSyncStamp = syncStamp;
          if (syncStamp) setDataVersion((version) => version + 1);
        }
        // Everything sent and the first download done: the server knows the
        // projects as they are, so it can hand out sample numbers for them.
        if (
          canSync &&
          status.connected &&
          status.hasSynced &&
          stats.count === 0
        ) {
          const cookieNow = cookieRef.current;
          if (cookieNow) void topUpSampleBlocks(cookieNow);
        }
        setSummary(
          syncSummary(
            {
              canSync,
              connected: status.connected,
              connecting: status.connecting,
              uploading: status.uploading,
              downloading: status.downloading,
              hasSynced: status.hasSynced ?? false,
              lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
              pending: stats.count,
              issues,
            },
            new Date(),
          ),
        );
      };

      stopListening = sync.registerListener({
        statusChanged: () => void refresh(),
      });
      timer = setInterval(() => void refresh(), STATUS_REFRESH_MS);

      if (canSync) {
        await sync.connect(new CoreChainConnector(() => cookieRef.current));
      } else {
        await sync.disconnect();
      }
      await refresh();
    })().catch(() => {
      // Sync is an add-on to the geologist's work, never a reason to stop it.
    });

    return () => {
      cancelled = true;
      stopListening();
      if (timer) clearInterval(timer);
      getSyncDatabase()
        .then((sync) => sync.disconnect())
        .catch(() => {});
    };
  }, [preparation, userId, canSync]);

  return (
    <SyncContext.Provider value={{ preparation, summary, dataVersion }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) {
    throw new Error('useSync must be used inside <SyncProvider>');
  }
  return value;
}
