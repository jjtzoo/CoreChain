import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { useSession } from '@/auth/session-context';
import { Icon } from '@/components/ui/icon';

/** The person icon in the Home header: opens the account screen. */
export function AccountButton() {
  const router = useRouter();
  const { health } = useSession();
  const needsAttention = health !== null && health.state !== 'active';

  return (
    <Pressable
      onPress={() => router.push('/account')}
      accessibilityRole="button"
      accessibilityLabel="Account"
      hitSlop={12}>
      <Icon
        name={needsAttention ? 'account-alert-outline' : 'account-circle-outline'}
        size={28}
        themeColor={needsAttention ? 'warning' : 'text'}
      />
    </Pressable>
  );
}
