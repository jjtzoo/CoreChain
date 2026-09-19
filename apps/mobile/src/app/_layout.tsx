import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';

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

// A drill-down stack (projects -> a project's drillholes -> one drillhole),
// not a tab bar — the field workflow is a sequence of screens, not parallel
// sections. See docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 1.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  // The icon font must be ready before the first screen draws, or icons show as blanks.
  const [iconsLoaded, iconsError] = useFonts(MaterialCommunityIcons.font);
  if (!iconsLoaded && !iconsError) {
    return null;
  }
  return (
    <ThemeProvider value={navigationTheme(colorScheme === 'dark' ? 'dark' : 'light')}>
      <AnimatedSplashOverlay />
      {/* Dark icons on the light theme, light icons on the dark one. */}
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="index" options={{ title: 'CoreChain' }} />
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
          name="projects/[projectId]/samples/[sampleId]"
          options={{ title: 'Sample' }}
        />
        <Stack.Screen
          name="projects/[projectId]/samples/new"
          options={{ title: 'New sample', presentation: 'modal' }}
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
      </Stack>
    </ThemeProvider>
  );
}
