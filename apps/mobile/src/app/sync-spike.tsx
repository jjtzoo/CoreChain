import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { runSyncSpike } from '@/sync/spike';

// Developer-only page for the Sprint 4 sync spike. Reached by deep link
// (corechain-field://sync-spike), not from the app's menus. Delete with the spike.
export default function SyncSpikeScreen() {
  const [email, setEmail] = useState('geologist1@corechain.test');
  const [password, setPassword] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const log = (line: string) => {
    console.log(`[spike] ${line}`);
    setLines((previous) => [...previous, line]);
  };

  const run = async () => {
    setRunning(true);
    setLines([]);
    try {
      await runSyncSpike(email.trim(), password, log);
      log('DONE');
    } catch (error) {
      log(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunning(false);
    }
  };

  const disabled = running || password.length === 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Sync spike (developer)</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="email"
        style={{ borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 10 }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        secureTextEntry
        placeholder="password"
        style={{ borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 10 }}
      />
      <Pressable
        onPress={run}
        disabled={disabled}
        style={{ backgroundColor: '#182321', padding: 14, borderRadius: 8, opacity: disabled ? 0.5 : 1 }}>
        <Text style={{ color: '#EEEAE1', textAlign: 'center', fontWeight: '600' }}>
          {running ? 'Running...' : 'Run spike'}
        </Text>
      </Pressable>
      <View style={{ gap: 4 }}>
        {lines.map((line, index) => (
          <Text key={index} selectable style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {line}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
