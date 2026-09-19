import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';

/**
 * The scroller every form screen uses. On Android the app draws edge to edge,
 * so the keyboard would otherwise sit on top of the form and hide the field
 * being typed into. When the keyboard opens this measures how much of the
 * scroll area it covers and shortens the area by exactly that much; Android
 * then scrolls the field being typed into into view. Taps still reach buttons
 * while the keyboard is open.
 *
 * `footer` is pinned under the scrolling form (a Save bar, say), so the main
 * action is always on screen and rides up above the keyboard.
 *
 * (React Native's own KeyboardAvoidingView isn't used: it measures from the
 * wrong origin under a screen header, so it leaves the bottom of the form
 * behind the keyboard.)
 */
export function FormScrollView({
  footer,
  ...props
}: ScrollViewProps & { footer?: ReactNode }) {
  const areaRef = useRef<View>(null);
  const [covered, setCovered] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      areaRef.current?.measureInWindow((_x, y, _width, height) => {
        setCovered(Math.max(0, y + height - event.endCoordinates.screenY));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setCovered(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View ref={areaRef} style={[styles.area, { paddingBottom: covered }]}>
      <ScrollView keyboardShouldPersistTaps="handled" {...props} />
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
  },
});
