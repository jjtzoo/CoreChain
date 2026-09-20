import {
  OFFLINE_SESSION_DAYS,
  signInFailureMessage,
  validateSignInInput,
  type SignInErrors,
} from '@corechain/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInError } from '@/auth/authApi';
import { useSession } from '@/auth/session-context';
import { BrandLockup } from '@/components/brand-lockup';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { AlertRow } from '@/components/ui/alert-row';
import { Spacing } from '@/constants/theme';

/**
 * E1-3: sign in. Shown only to a phone that has never signed in: after that the
 * app opens straight to the geologist's work, with or without signal. There is
 * no "create account" here on purpose: the admin creates each account (D13).
 */
export default function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<SignInErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problems = validateSignInInput(email, password);
    setErrors(problems);
    setFailure(null);
    if (problems.email || problems.password) return;

    setBusy(true);
    try {
      await signIn(email, password);
      // The layout swaps to the app as soon as the session is stored.
    } catch (error) {
      setFailure(
        signInFailureMessage(error instanceof SignInError ? error.failure : 'server'),
      );
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <BrandLockup height={40} />
        </View>

        <View style={styles.intro}>
          <ThemedText type="subtitle">Sign in</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Use the email and password your admin gave you. You only need signal to sign in:
            after that the app keeps working in the field for up to {OFFLINE_SESSION_DAYS} days
            without it.
          </ThemedText>
        </View>

        {failure ? <AlertRow tone="danger" message={failure} /> : null}

        <View style={styles.fields}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            editable={!busy}
          />
          <View style={styles.passwordBlock}>
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              editable={!busy}
            />
            <Pressable
              onPress={() => setShowPassword((shown) => !shown)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={12}
              style={styles.showToggle}>
              <ThemedText type="smallBold" themeColor="accent">
                {showPassword ? 'Hide password' : 'Show password'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <PrimaryButton label="Sign in" onPress={submit} loading={busy} />

        <ThemedText type="small" themeColor="textSecondary" style={styles.help}>
          No account yet, or forgot your password? Ask your admin.
        </ThemedText>
      </FormScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    paddingTop: Spacing.six,
  },
  brand: {
    alignItems: 'flex-start',
  },
  intro: {
    gap: Spacing.two,
  },
  fields: {
    gap: Spacing.three,
  },
  passwordBlock: {
    gap: Spacing.two,
  },
  showToggle: {
    alignSelf: 'flex-start',
  },
  help: {
    textAlign: 'center',
  },
});
