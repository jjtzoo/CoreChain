import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** A themed icon. Pass `themeColor` (a theme token) rather than a raw hex. */
export function Icon({
  name,
  size = 22,
  themeColor = 'text',
}: {
  name: IconName;
  size?: number;
  themeColor?: ThemeColor;
}) {
  const theme = useTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={theme[themeColor]}
      accessible={false}
    />
  );
}
