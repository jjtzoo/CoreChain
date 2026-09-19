import type { Project } from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  getProject,
  updateProjectSamplingSettings,
} from '@/data/projectsRepository';

/**
 * E1-2: sampling rules the geologist sets for their own project, since
 * there's no admin to have configured them in advance.
 */
export default function ProjectSettingsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [samplePrefix, setSamplePrefix] = useState('');
  const [nextSampleNumber, setNextSampleNumber] = useState('1');
  const [standardEveryN, setStandardEveryN] = useState('20');
  const [blankEveryN, setBlankEveryN] = useState('20');
  const [duplicateEveryN, setDuplicateEveryN] = useState('20');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProject(projectId).then((loaded) => {
      if (!loaded) {
        return;
      }
      setProject(loaded);
      setSamplePrefix(loaded.samplePrefix);
      setNextSampleNumber(String(loaded.nextSampleNumber));
      setStandardEveryN(String(loaded.qcInsertionRate.standardEveryN));
      setBlankEveryN(String(loaded.qcInsertionRate.blankEveryN));
      setDuplicateEveryN(String(loaded.qcInsertionRate.duplicateEveryN));
    });
  }, [projectId]);

  async function handleSave() {
    const parsedNextNumber = Number(nextSampleNumber);
    if (!Number.isInteger(parsedNextNumber) || parsedNextNumber < 1) {
      setError('Next sample number must be a positive whole number.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProjectSamplingSettings(projectId, {
        samplePrefix,
        nextSampleNumber: parsedNextNumber,
        qcInsertionRate: {
          standardEveryN: Number(standardEveryN) || 0,
          blankEveryN: Number(blankEveryN) || 0,
          duplicateEveryN: Number(duplicateEveryN) || 0,
        },
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (!project) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.form}>
        <TextField
          label="Sample ID prefix"
          value={samplePrefix}
          onChangeText={setSamplePrefix}
          autoCapitalize="characters"
        />
        <TextField
          label="Next sample number"
          value={nextSampleNumber}
          onChangeText={setNextSampleNumber}
          keyboardType="number-pad"
          error={error ?? undefined}
        />

        <ThemedText type="smallBold">QC insertion rate</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          A reminder fires every N samples for each control type. Changing
          this doesn&apos;t renumber samples already created.
        </ThemedText>
        <TextField
          label="Standard — every N samples"
          value={standardEveryN}
          onChangeText={setStandardEveryN}
          keyboardType="number-pad"
        />
        <TextField
          label="Blank — every N samples"
          value={blankEveryN}
          onChangeText={setBlankEveryN}
          keyboardType="number-pad"
        />
        <TextField
          label="Field duplicate — every N samples"
          value={duplicateEveryN}
          onChangeText={setDuplicateEveryN}
          keyboardType="number-pad"
        />

        <PrimaryButton label="Save" onPress={handleSave} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  form: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
});
