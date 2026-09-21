import {
  ROLE_LABELS,
  countBackupStates,
  describeSyncIssue,
  photoBackupSummary,
  sessionMessage,
  toUserRole,
  wipeWarning,
  type PhotoBackupCounts,
} from '@corechain/domain';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { ChipSelect } from '@/components/form/chip-select';
import { PrimaryButton } from '@/components/form/primary-button';
import { syncTone } from '@/components/sync-status';
import {
  canResend,
  listOpenIssues,
  resendIssues,
  reviewable,
  type SyncIssue,
} from '@/sync/issues';
import { photoBackupStates } from '@/data/photoUploadsRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import {
  isOnWifi,
  loadWifiOnly,
  saveWifiOnly,
} from '@/sync/photoBackupSettings';
import { useSync } from '@/sync/sync-context';
import { phoneHoldings, wipeDevice } from '@/sync/wipe';
import { ThemedText } from '@/components/themed-text';
import { AlertRow } from '@/components/ui/alert-row';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import {
  applyThemePreference,
  loadThemePreference,
  saveThemePreference,
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
  type ThemePreference,
} from '@/theme/appearance';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The signed-in person, how healthy their sign-in is, whether their work has
 * reached the server, and sign out. Plain sign-out keeps everything on the
 * phone; a phone handed to a different account is cleared at that account's
 * sign-in (once nothing is left unsent). "Sign out and remove my data" (E1-5)
 * is for a shared or lost phone, and says first what would be lost.
 */
export default function AccountScreen() {
  const router = useRouter();
  const { user, health, signOut } = useSession();
  const [themePreference, setThemePreference] =
    useState<ThemePreference>('auto');
  useEffect(() => {
    void loadThemePreference().then(setThemePreference);
  }, []);
  function chooseTheme(next: ThemePreference) {
    setThemePreference(next);
    applyThemePreference(next);
    void saveThemePreference(next);
  }
  const { summary, photoBackupVersion, backUpPhotosNow } = useSync();
  const [photoCounts, setPhotoCounts] = useState<PhotoBackupCounts | null>(
    null,
  );
  const [wifiOnly, setWifiOnly] = useState(false);
  const [onWifi, setOnWifi] = useState<boolean | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const loadPhotoBackup = useCallback(() => {
    void photoBackupVersion;
    photoBackupStates()
      .then((states) => setPhotoCounts(countBackupStates([...states.values()])))
      .catch(() => {});
    void loadWifiOnly().then(setWifiOnly);
    void isOnWifi().then(setOnWifi);
  }, [photoBackupVersion]);
  useFocusReload(loadPhotoBackup);
  function chooseWifiOnly(next: 'any' | 'wifi') {
    setWifiOnly(next === 'wifi');
    void saveWifiOnly(next === 'wifi');
  }
  async function backUpNow() {
    setBackingUp(true);
    try {
      await backUpPhotosNow();
      loadPhotoBackup();
    } finally {
      setBackingUp(false);
    }
  }
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [removing, setRemoving] = useState(false);
  const [resending, setResending] = useState(false);
  const loadIssues = useCallback(() => {
    listOpenIssues()
      .then(setIssues)
      .catch(() => {});
  }, []);
  useFocusReload(loadIssues);
  // The same kind of refusal, counted once.
  const issueGroups = [
    ...issues
      .reduce((groups, issue) => {
        const key = `${issue.tableName}|${issue.status}|${issue.reason ?? ''}`;
        const group = groups.get(key);
        if (group) group.count += 1;
        else groups.set(key, { issue, count: 1 });
        return groups;
      }, new Map<string, { issue: SyncIssue; count: number }>())
      .values(),
  ];

  async function sendAgain() {
    setResending(true);
    try {
      const queued = await resendIssues(issues);
      loadIssues();
      Alert.alert(
        queued > 0 ? 'Sending again' : 'Nothing to send',
        queued > 0
          ? `${queued} ${queued === 1 ? 'record is' : 'records are'} back in the queue and go to the server by themselves. If it is refused again it will be listed here.`
          : 'Those records are no longer on this phone.',
      );
    } finally {
      setResending(false);
    }
  }

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'Your projects and logs stay on this phone. You will need signal to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            signOut().then(() => router.dismissAll());
          },
        },
      ],
    );
  };

  const removeData = async () => {
    setRemoving(true);
    try {
      const warning = wipeWarning(await phoneHoldings());
      setRemoving(false);
      Alert.alert(warning.title, warning.message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: warning.confirmLabel,
          style: 'destructive',
          onPress: () => {
            setRemoving(true);
            wipeDevice()
              .then(() => signOut())
              .then(() => router.dismissAll())
              .catch(() => {
                setRemoving(false);
                Alert.alert(
                  'Could not remove your data',
                  'Nothing was signed out. Try again, or restart the app first.',
                );
              });
          },
        },
      ]);
    } catch {
      setRemoving(false);
      Alert.alert(
        'Could not check your data',
        'Nothing was removed. Try again in a moment.',
      );
    }
  };

  if (!user || !health) {
    return null;
  }

  const message = sessionMessage(health);
  const photoSummary = photoCounts
    ? photoBackupSummary(photoCounts, { wifiOnly, onWifi })
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.person}>
          <Icon name="account-circle-outline" size={44} themeColor="accent" />
          <View style={styles.personText}>
            <ThemedText type="heading">{user.name || user.email}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {user.email}
            </ThemedText>
            <ThemedText type="smallBold" themeColor="accent">
              {ROLE_LABELS[toUserRole(user.role)]}
            </ThemedText>
          </View>
        </Card>

        {message ? (
          <AlertRow
            tone={health.state === 'expired' ? 'danger' : 'warning'}
            message={message}
          />
        ) : (
          <Card style={styles.status}>
            <Icon name="shield-check-outline" size={24} themeColor="success" />
            <View style={styles.personText}>
              <ThemedText type="smallBold">Signed in</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Works without signal until {formatDate(health.expiresAt)}.
                Connect any time before then to keep going.
              </ThemedText>
            </View>
          </Card>
        )}

        {summary ? (
          <Card style={styles.status}>
            <Icon
              name={syncTone(summary).icon}
              size={24}
              themeColor={syncTone(summary).color}
            />
            <View style={styles.personText}>
              <ThemedText type="smallBold">{summary.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {summary.detail}
              </ThemedText>
            </View>
          </Card>
        ) : null}

        {photoCounts && photoSummary ? (
          <Card style={styles.issues}>
            <View style={styles.status}>
              <Icon
                name={
                  photoSummary.allSafe
                    ? 'cloud-check-outline'
                    : photoCounts.failed > 0
                      ? 'cloud-alert-outline'
                      : 'cloud-upload-outline'
                }
                size={24}
                themeColor={
                  photoCounts.failed > 0
                    ? 'danger'
                    : photoSummary.allSafe
                      ? 'success'
                      : 'warning'
                }
              />
              <View style={styles.personText}>
                <ThemedText type="smallBold">{photoSummary.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {photoSummary.detail}
                </ThemedText>
              </View>
            </View>
            <ChipSelect
              label="Back up photos on"
              options={['any', 'wifi'] as const}
              value={wifiOnly ? 'wifi' : 'any'}
              onChange={chooseWifiOnly}
              formatOption={(option) =>
                option === 'wifi' ? 'Wi-Fi only' : 'Any connection'
              }
            />
            {photoCounts.waiting > 0 ? (
              <PrimaryButton
                label="Back up now"
                icon="cloud-upload-outline"
                variant="secondary"
                loading={backingUp}
                onPress={() => void backUpNow()}
              />
            ) : null}
          </Card>
        ) : null}

        {issueGroups.length > 0 ? (
          <Card style={styles.issues}>
            <ThemedText type="caption" themeColor="textSecondary">
              CHANGES THE SERVER DID NOT ACCEPT
            </ThemedText>
            {issueGroups.map(({ issue, count }) => (
              <View key={issue.id} style={styles.personText}>
                <ThemedText type="smallBold">
                  {count} × {issue.tableName.replace(/_/g, ' ')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {describeSyncIssue(issue.status, issue.reason)}
                </ThemedText>
                {issue.reason ? (
                  <ThemedText type="caption" themeColor="muted">
                    Code: {issue.reason}
                    {issue.detail ? ` · ${issue.detail}` : ''}
                  </ThemedText>
                ) : null}
              </View>
            ))}
            {issues.some(reviewable) ? (
              <PrimaryButton
                label="Review and choose"
                icon="call-split"
                variant="secondary"
                onPress={() => router.push('/conflicts' as Href)}
              />
            ) : null}
            {issues.some(canResend) ? (
              <PrimaryButton
                label="Send again"
                icon="cloud-upload-outline"
                variant="secondary"
                loading={resending}
                onPress={() => void sendAgain()}
              />
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.appearance}>
          <ChipSelect
            label="Appearance"
            options={THEME_PREFERENCES}
            value={themePreference}
            onChange={chooseTheme}
            formatOption={(option) => THEME_PREFERENCE_LABELS[option]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Light is easiest to read in bright sun.
          </ThemedText>
        </Card>

        <PrimaryButton
          label="Send feedback"
          icon="message-text-outline"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/feedback', params: { from: 'Account' } })
          }
        />

        <View style={styles.signOut}>
          <PrimaryButton
            label="Sign out"
            variant="secondary"
            onPress={confirmSignOut}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Everything you have logged stays on this phone.
          </ThemedText>
        </View>

        <View style={styles.signOut}>
          <PrimaryButton
            label="Sign out and remove my data"
            icon="trash-can-outline"
            variant="danger"
            loading={removing}
            onPress={() => void removeData()}
          />
          <ThemedText type="small" themeColor="textSecondary">
            For a shared or lost phone. It tells you first if anything is only
            on this phone.
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  appearance: {
    gap: Spacing.three,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  personText: {
    flex: 1,
    gap: Spacing.one,
  },
  signOut: {
    gap: Spacing.two,
  },
  issues: {
    gap: Spacing.three,
  },
});
