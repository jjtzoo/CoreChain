import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { BrandLockup } from '@/components/brand-lockup';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useOrientation } from '@/onboarding/orientation-context';

type Step = 'name' | 'tour';

/**
 * Sprint 6: a mandatory, one-time screen the first time an account signs in
 * on a phone — before the rest of the app is reachable (guarded in
 * app/_layout.tsx). Confirms the geologist's own name (shown on their
 * entries, e.g. the custody timeline's "logged by") and points out the two
 * things a new tester otherwise has to discover on their own: how to send
 * feedback, and where sync status lives. The full guided walkthrough
 * (E10-1, "Start guide" on Account) still covers the actual field workflow;
 * this is only the two things every screen carries.
 */
export default function OrientationScreen() {
  const { user, updateName } = useSession();
  const { complete } = useOrientation();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  async function continueFromName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      if (trimmed !== (user?.name ?? '')) {
        const ok = await updateName(trimmed);
        setSaveFailed(!ok);
      }
      setStep('tour');
    } finally {
      setSaving(false);
    }
  }

  if (step === 'name') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <FormScrollView contentContainerStyle={styles.content}>
          <View style={styles.brand}>
            <BrandLockup height={40} />
          </View>
          <View style={styles.intro}>
            <ThemedText type="subtitle">Welcome to CoreChain Field</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Before you start logging, tell us your name. It shows on the entries you make, so
              your team knows who logged what.
            </ThemedText>
          </View>
          <TextField
            label="Your name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={continueFromName}
            editable={!saving}
          />
          {saveFailed ? (
            <ThemedText type="small" themeColor="warning">
              Could not reach the server to save your name — carrying on with what you typed.
              Fix it from Account any time you have signal.
            </ThemedText>
          ) : null}
          <PrimaryButton
            label="Continue"
            onPress={continueFromName}
            loading={saving}
            disabled={!name.trim()}
          />
        </FormScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <ThemedText type="subtitle">Two things to know</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Everything else you&apos;ll pick up as you go — replay the full guided walkthrough from
            Account any time.
          </ThemedText>
        </View>

        <Card style={styles.tip}>
          <Icon name="message-text-outline" size={28} themeColor="accent" />
          <View style={styles.tipText}>
            <ThemedText type="smallBold">Send feedback from any screen</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              The message icon in the top right of every screen sends a bug, an idea or a
              question straight to your admin, with a screenshot attached.
            </ThemedText>
          </View>
        </Card>

        <Card style={styles.tip}>
          <Icon name="cloud-sync-outline" size={28} themeColor="accent" />
          <View style={styles.tipText}>
            <ThemedText type="smallBold">Your work is safe with or without signal</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Everything you enter is saved on this phone first. A line on Home always tells you
              whether it has reached the server yet — no signal never means lost work.
            </ThemedText>
          </View>
        </Card>

        <PrimaryButton label="Start working" onPress={() => void complete()} />
      </FormScrollView>
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
    paddingTop: Spacing.six,
  },
  brand: {
    alignItems: 'flex-start',
  },
  intro: {
    gap: Spacing.two,
  },
  tip: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    gap: Spacing.half,
  },
});
