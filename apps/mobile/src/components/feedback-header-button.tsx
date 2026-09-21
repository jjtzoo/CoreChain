import { useRouter, useSegments } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { captureCurrentScreen } from '@/feedback/screenshot';

/**
 * E10-2: the feedback entry point in every screen's header, next to the back
 * button. `useSegments()` names the route itself (e.g.
 * "projects/[projectId]/drillholes/[drillholeId]") rather than the current
 * URL, so every hole or sample lands under the same screen name — without
 * that, "screens people struggle with" (E10-6) would never group two visits
 * to the same screen together.
 */
export function FeedbackHeaderButton() {
  const router = useRouter();
  const segments = useSegments();

  async function openFeedback() {
    const screenshot = await captureCurrentScreen();
    router.push({
      pathname: '/feedback',
      params: { from: segments.join('/'), screenshot: screenshot ?? '' },
    });
  }

  return (
    <Pressable
      onPress={() => void openFeedback()}
      accessibilityRole="button"
      accessibilityLabel="Send feedback"
      hitSlop={12}
      style={styles.button}>
      <Icon name="message-text-outline" size={24} themeColor="text" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 4,
  },
});
