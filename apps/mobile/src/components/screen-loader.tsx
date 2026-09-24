import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandFill, useBrandTone, useCreepFill } from '@/components/brand-fill';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Same size as the opening splash, so every wait looks like that one. */
const SIZE = 160;
/** Most screens open in a few milliseconds: only show the fill if they don't. */
const SHOW_AFTER_MS = 200;
/**
 * The phone's own data opens in milliseconds, so still waiting after this
 * means the record is not there (removed, for example by a teammate's change
 * that synced in) rather than slow.
 */
const GIVE_UP_AFTER_MS = 8000;

/**
 * What a screen shows while its data opens: the CoreChain "C" filling, as on
 * the opening splash. Pass `giveUpAfterMs={null}` where waiting longer is
 * normal and a "could not be opened" message would be wrong.
 */
export function ScreenLoader({
  message,
  giveUpAfterMs = GIVE_UP_AFTER_MS,
}: {
  message?: string;
  giveUpAfterMs?: number | null;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<'waiting' | 'showing' | 'gave-up'>(
    'waiting',
  );

  useEffect(() => {
    const show = setTimeout(
      () => setPhase((current) => (current === 'waiting' ? 'showing' : current)),
      SHOW_AFTER_MS,
    );
    const giveUp =
      giveUpAfterMs == null
        ? undefined
        : setTimeout(() => setPhase('gave-up'), giveUpAfterMs);
    return () => {
      clearTimeout(show);
      if (giveUp) clearTimeout(giveUp);
    };
  }, [giveUpAfterMs]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {phase === 'showing' ? <Filling message={message} /> : null}
      {phase === 'gave-up' ? (
        <View style={styles.gaveUp}>
          <ThemedText type="default" style={styles.centred}>
            This could not be opened.
          </ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.centred}>
            It may have been removed, for example by a teammate&apos;s change
            that synced to this phone.
          </ThemedText>
          <PrimaryButton
            label="Go back"
            variant="secondary"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function Filling({ message }: { message?: string }) {
  const progress = useCreepFill();
  const tone = useBrandTone();
  return (
    <View style={styles.filling}>
      <BrandFill size={SIZE} progress={progress} tone={tone} />
      {message ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.centred}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  filling: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  gaveUp: {
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  centred: {
    textAlign: 'center',
  },
});
