import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

// A drill-down stack (projects -> a project's drillholes -> one drillhole),
// not a tab bar — the field workflow is a sequence of screens, not parallel
// sections. See docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 1.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Projects' }} />
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
          options={{ title: 'Sampling settings' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/new"
          options={{ title: 'New drillhole', presentation: 'modal' }}
        />
        <Stack.Screen
          name="projects/[projectId]/drillholes/[drillholeId]"
          options={{ title: 'Drillhole' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
