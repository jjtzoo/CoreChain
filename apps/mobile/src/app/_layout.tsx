import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { SessionProvider, useSession } from '@/auth/session-context';
import { AccountButton } from '@/components/account-button';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BrandLockup } from '@/components/brand-lockup';
import { FeedbackHeaderButton } from '@/components/feedback-header-button';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { GuideProvider } from '@/guide/guide-context';
import { SyncProvider, useSync } from '@/sync/sync-context';
import { applyThemePreference, loadThemePreference } from '@/theme/appearance';

SplashScreen.preventAutoHideAsync();

/** Navigation colours taken from the app's own tokens, so headers match the screens. */
function navigationTheme(scheme: 'light' | 'dark') {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };
}

/** Shown for a moment while the phone's database opens, or if it cannot. */
function OpeningData({ failed }: { failed: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.three,
        padding: Spacing.five,
      }}>
      {failed ? null : <ActivityIndicator />}
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={{ textAlign: 'center' }}>
        {failed
          ? 'Your data could not be opened. Close the app and open it again. If this keeps happening, contact your CoreChain administrator.'
          : 'Opening your data…'}
      </ThemedText>
    </View>
  );
}

/**
 * Signed-in screens and the sign-in screen are two groups: only one is
 * reachable at a time, and the router moves between them by itself when the
 * session changes. Until the stored session has been read, nothing draws (the
 * splash screen is still up), so a signed-in geologist never sees a flash of
 * the sign-in screen.
 */
function AppStack() {
  const { phase } = useSession();
  const { preparation } = useSync();
  if (phase === 'loading') {
    return null;
  }
  const signedIn = phase === 'signed-in';
  if (signedIn && preparation !== 'ready') {
    return <OpeningData failed={preparation === 'failed'} />;
  }
  const stack = <AppStackScreens signedIn={signedIn} />;
  // The guide only applies once signed in, and it opens the local database
  // (lazily, like every repository) — so it stays out of the sign-in screen.
  return signedIn ? <GuideProvider>{stack}</GuideProvider> : stack;
}

function AppStackScreens({ signedIn }: { signedIn: boolean }) {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        headerBackButtonDisplayMode: 'minimal',
        // E10-2: a feedback entry point on every screen's header, not only
        // Home and Account. The two screens below override or suppress it.
        headerRight: () => <FeedbackHeaderButton />,
      }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen
          name="index"
          options={{
            title: 'CoreChain',
            headerTitle: () => <BrandLockup height={28} />,
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                <FeedbackHeaderButton />
                <AccountButton />
              </View>
            ),
          }}
        />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="work" options={{ title: 'My work' }} />
        <Stack.Screen name="conflicts" options={{ title: 'Review changes' }} />
        <Stack.Screen
          name="feedback"
          options={{
            title: 'Send feedback',
            presentation: 'modal',
            headerRight: () => null,
          }}
        />
        <Stack.Screen
          name="projects/new"
          options={{ title: 'New project', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/index"
          options={{ title: 'Project' }}
        />
        <Stack.Screen
          name="projects/[projectId]/settings"
          options={{ title: 'Project settings' }}
        />
        <Stack.Screen
          name="projects/[projectId]/samples/index"
          options={{ title: 'Samples' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]/graphic"
          options={{ title: 'Hole log' }}
        />
        <Stack.Screen
          name="projects/[projectId]/samples/[sampleId]"
          options={{ title: 'Sample' }}
        />
        <Stack.Screen
          name="projects/[projectId]/samples/new"
          options={{ title: 'New sample', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/custody/record"
          options={{ title: 'Custody', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/custody/correct"
          options={{ title: 'Correct a step', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/dispatches/index"
          options={{ title: 'Lab dispatches' }}
        />
        <Stack.Screen
          name="projects/[projectId]/dispatches/[dispatchId]"
          options={{ title: 'Dispatch' }}
        />
        <Stack.Screen
          name="projects/[projectId]/dispatches/new"
          options={{ title: 'New dispatch', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/dispatches/handover"
          options={{ title: 'Hand over', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/export"
          options={{ title: 'Export' }}
        />
        <Stack.Screen
          name="projects/[projectId]/codes"
          options={{ title: 'Code library' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/new"
          options={{ title: 'New drillhole', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]"
          options={{ title: 'Drillhole' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]/boxes/index"
          options={{ title: 'Core boxes' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]/boxes/new"
          options={{ title: 'New core box', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]/runs/index"
          options={{ title: 'Core runs' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]/runs/new"
          options={{ title: 'New core run', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]/log/index"
          options={{ title: 'Core log' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]/log/new"
          options={{ title: 'New interval', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]/photos/index"
          options={{ title: 'Photos' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]/photos/take"
          options={{ title: 'Take photo' }}
        />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * The glowing symbol stays up while the phone opens its data, then fades to
 * the dashboard. It leaves once the stored sign-in is read and the local
 * database is ready (or has failed, so the message under it can be read).
 */
function SplashGate() {
  const { preparation } = useSync();
  return (
    <AnimatedSplashOverlay
      ready={preparation === 'ready' || preparation === 'failed'}
    />
  );
}

// A drill-down stack (projects -> a project's drillholes -> one drillhole),
// not a tab bar — the field workflow is a sequence of screens, not parallel
// sections. See docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 1.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  useEffect(() => {
    void loadThemePreference().then(applyThemePreference);
  }, []);
  // The icon font must be ready before the first screen draws, or icons show as blanks.
  const [iconsLoaded, iconsError] = useFonts(MaterialCommunityIcons.font);
  if (!iconsLoaded && !iconsError) {
    return null;
  }
  return (
    <ThemeProvider
      value={navigationTheme(colorScheme === 'dark' ? 'dark' : 'light')}>
      {/* Dark icons on the light theme, light icons on the dark one. */}
      <StatusBar style="auto" />
      <SessionProvider>
        <SyncProvider>
          <AppStack />
          <SplashGate />
        </SyncProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
