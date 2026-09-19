import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A big tappable tile with an icon, a title and one line of live detail
 * (a count, a status). Sits two to a row on the hole screen.
 */
export function ActionTile({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${title}. ${detail}`}
      style={styles.tile}>
      <View style={[styles.iconWell, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} size={24} themeColor="accent" />
      </View>
      <View style={styles.text}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: Spacing.two + 2,
    minHeight: 112,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    gap: Spacing.half,
  },
});
