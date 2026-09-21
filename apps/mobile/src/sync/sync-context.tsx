import {
  recordSyncState,
  syncSummary,
  versionStatus,
  type RecordSyncState,
  type SyncSummary,
  type VersionStatus,
} from '@corechain/domain';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';

import { useSession } from '@/auth/session-context';
import { APP_VERSION } from '@/config';
import { getSyncDatabase, queueAllLocalRowsForUpload } from '@/data/database';
import {
  emptyMarkers,
  loadAttentionMarkers,
  loadWaitingMarkers,
  markersKey,
  type MarkerKind,
  type MarkerSets,
} from '@/data/syncMarkersRepository';
import { CoreChainConnector } from './connector';
import { loadMinAppVersion, registerDevice } from './device';
import { countOpenIssues } from './issues';
import { backUpPhotos } from './photoUploader';
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
  /** Whether this build of the app is still accepted by the server (E10-8). */
  version: VersionStatus;
  /**
   * Goes up each time a sync completes. Screens that list records reload when
   * it changes, so downloaded work appears without leaving the screen.
   */
  dataVersion: number;
  /** Goes up each time photo files are sent (or found unsendable). */
  photoBackupVersion: number;
  /** Sends every waiting photo now, for the person's "Back up now". */
  backUpPhotosNow: () => Promise<void>;
  /** Has this record reached the server, is it waiting, or was something refused? */
  recordSync: (kind: MarkerKind, id: string) => RecordSyncState;
};

type Markers = { waiting: MarkerSets; attention: MarkerSets };

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
  const [minAppVersion, setMinAppVersion] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [photoBackupVersion, setPhotoBackupVersion] = useState(0);
  const [markers, setMarkers] = useState<Markers>({
    waiting: emptyMarkers(),
    attention: emptyMarkers(),
  });
  const markersSeen = useRef('');

  const userId = user?.id ?? null;
  const version = versionStatus(APP_VERSION, minAppVersion);
  const canSync = (health?.canSync ?? false) && version.canSync;

  // The connector reads the newest cookie on demand, so a refreshed session
  // never forces a reconnect.
  const cookieRef = useRef<string | null>(cookie);
  useEffect(() => {
    cookieRef.current = cookie;
  }, [cookie]);

  // The last version the server accepted, learned at an earlier registration
  // (E10-8): read once so a phone that has been offline for a while still
  // shows the right message the moment it opens, before it can reach the
  // server again.
  useEffect(() => {
    loadMinAppVersion()
      .then(setMinAppVersion)
      .catch(() => {});
  }, []);

  const sendPhotos = useCallback(
    async (ignoreDelay: boolean) => {
      const cookieNow = cookieRef.current;
      if (!canSync || !cookieNow) return;
      const { changed } = await backUpPhotos(cookieNow, { ignoreDelay });
      if (changed > 0) setPhotoBackupVersion((version) => version + 1);
    },
    [canSync],
  );
  const recordSync = useCallback(
    (kind: MarkerKind, id: string) =>
      recordSyncState(id, {
        waiting: markers.waiting[kind],
        attention: markers.attention[kind],
      }),
    [markers],
  );
  const backUpPhotosNow = useCallback(
    () => sendPhotos(true).catch(() => {}),
    [sendPhotos],
  );

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
        const justSynced = syncStamp !== lastSyncStamp;
        if (justSynced) {
          lastSyncStamp = syncStamp;
          if (syncStamp) setDataVersion((version) => version + 1);
        }
        // Which records are still waiting to be sent, or were refused (E8-4). Only
        // redrawn when the answer changes.
        try {
          const [waiting, attention] = await Promise.all([
            loadWaitingMarkers(),
            loadAttentionMarkers(),
          ]);
          if (cancelled) return;
          const key = `${markersKey(waiting)}#${markersKey(attention)}`;
          if (key !== markersSeen.current) {
            markersSeen.current = key;
            setMarkers({ waiting, attention });
          }
        } catch {
          // The badges are a courtesy; never let them stop syncing.
        }
        // Photo files go up after their records, and never hold a sync up. A
        // sync that just finished may have delivered a record a photo was
        // waiting on, so it sends them all; otherwise only the ones due.
        if (canSync && status.connected && status.hasSynced) {
          void sendPhotos(justSynced).catch(() => {});
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
              outdated: version.state === 'outdated',
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

      // Learn whether the server has raised its minimum version, even for a
      // phone with nothing new to upload (E10-8). Safe to repeat, and never
      // holds up connecting.
      const cookieNow = cookieRef.current;
      if (cookieNow) {
        void registerDevice(cookieNow)
          .then(() => loadMinAppVersion())
          .then((value) => {
            if (!cancelled) setMinAppVersion(value);
          })
          .catch(() => {});
      }

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
  }, [preparation, userId, canSync, sendPhotos, minAppVersion, version.state]);

  return (
    <SyncContext.Provider
      value={{
        preparation,
        summary,
        version,
        dataVersion,
        photoBackupVersion,
        backUpPhotosNow,
        recordSync,
      }}>
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
