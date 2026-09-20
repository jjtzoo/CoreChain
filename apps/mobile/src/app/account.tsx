import { ROLE_LABELS, sessionMessage, toUserRole } from '@corechain/domain';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { PrimaryButton } from '@/components/form/primary-button';
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
 * The signed-in person, how healthy their sign-in is, and sign out. Sign-out
 * keeps everything on the phone for now: there is no upload yet, so wiping
 * could destroy work. "Sign out and wipe this device" arrives with sync (E1-5).
 */
export default function AccountScreen() {
  const router = useRouter();
  const { user, health, signOut } = useSession();

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
          <AlertRow tone={health.state === 'expired' ? 'danger' : 'warning'} message={message} />
        ) : (
          <Card style={styles.status}>
            <Icon name="shield-check-outline" size={24} themeColor="success" />
            <View style={styles.personText}>
              <ThemedText type="smallBold">Signed in</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Works without signal until {formatDate(health.expiresAt)}. Connect any time
                before then to keep going.
              </ThemedText>
            </View>
          </Card>
        )}

        <View style={styles.signOut}>
          <PrimaryButton label="Sign out" variant="secondary" onPress={confirmSignOut} />
          <ThemedText type="small" themeColor="textSecondary">
            Everything you have logged stays on this phone.
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
});
