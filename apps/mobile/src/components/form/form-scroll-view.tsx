import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewProps,
} from 'react-native';

/** How far above the focused field to scroll, so its label stays in view. */
const LABEL_ALLOWANCE = 96;

/**
 * The scroller every form screen uses. On Android the app draws edge to edge,
 * so the keyboard would otherwise sit on top of the form and hide the field
 * being typed into. When the keyboard opens this measures how much of the
 * scroll area it covers, shortens the area by exactly that much, and scrolls
 * the field being typed into (and its label) into view. Taps still reach
 * buttons while the keyboard is open.
 */
export function FormScrollView(props: ScrollViewProps) {
  const areaRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [covered, setCovered] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      areaRef.current?.measureInWindow((_x, y, _width, height) => {
        setCovered(Math.max(0, y + height - event.endCoordinates.screenY));

        // Wait a beat so the area has shrunk to fit above the keyboard
        // before working out where to scroll.
        setTimeout(() => {
          const scroll = scrollRef.current;
          const input = TextInput.State.currentlyFocusedInput();
          const content = scroll?.getInnerViewNode();
          if (!scroll || !input || !content) {
            return;
          }
          input.measureLayout(
            content,
            (_left, top) => {
              scroll.scrollTo({
                y: Math.max(0, top - LABEL_ALLOWANCE),
                animated: true,
              });
            },
            () => {},
          );
        }, 100);
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
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
  },
});
