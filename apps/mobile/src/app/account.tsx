import {
  ROLE_LABELS,
  describeSyncIssue,
  sessionMessage,
  toUserRole,
  wipeWarning,
} from '@corechain/domain';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { PrimaryButton } from '@/components/form/primary-button';
import { syncTone } from '@/components/sync-status';
import { listOpenIssues, type SyncIssue } from '@/sync/issues';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useSync } from '@/sync/sync-context';
import { phoneHoldings, wipeDevice } from '@/sync/wipe';
import { ThemedText } from '@/components/themed-text';
import { AlertRow } from '@/components/ui/alert-row';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';

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
  const { summary } = useSync();
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [removing, setRemoving] = useState(false);
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
              </View>
            ))}
          </Card>
        ) : null}

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
