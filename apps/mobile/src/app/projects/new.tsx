import { COORDINATE_SYSTEMS, type CoordinateSystem } from '@corechain/domain';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect } from '@/components/form/chip-select';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { createProject } from '@/data/projectsRepository';

/**
 * E1-1: create a project. Only name and coordinate system are required —
 * everything else can be filled in later from the project's own settings
 * (E1-2), since there's no admin to have set any of this up in advance.
 */
export default function NewProjectScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [coordinateSystem, setCoordinateSystem] =
    useState<CoordinateSystem>('WGS84');
  const [commodity, setCommodity] = useState('');
  const [location, setLocation] = useState('');
  const [samplePrefix, setSamplePrefix] = useState('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setNameError(undefined);
    setSaving(true);
    try {
      const result = await createProject({
        name,
        coordinateSystem,
        commodity: commodity.trim() || null,
        location: location.trim() || null,
        samplePrefix: samplePrefix.trim() || undefined,
      });

      if (result.outcome === 'invalid') {
        const nameIssue = result.errors.errors.find((e) => e.field === 'name');
        setNameError(nameIssue?.message ?? 'Check the form and try again.');
        return;
      }

      router.replace(`/projects/${result.project.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView contentContainerStyle={styles.form}>
        <TextField
          label="Project name"
          value={name}
          onChangeText={setName}
          error={nameError}
          placeholder="e.g. Sipalay Gold Prospect"
          autoFocus
        />

        <ChipSelect
          label="Coordinate system"
          options={COORDINATE_SYSTEMS}
          value={coordinateSystem}
          onChange={setCoordinateSystem}
        />

        <TextField
          label="Commodity"
          optional
          value={commodity}
          onChangeText={setCommodity}
          placeholder="e.g. Gold"
        />

        <TextField
          label="Location"
          optional
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Negros Occidental, Philippines"
        />

        <TextField
          label="Sample ID prefix"
          optional
          value={samplePrefix}
          onChangeText={setSamplePrefix}
          placeholder="CC"
          autoCapitalize="characters"
        />
        <ThemedText type="small" themeColor="textSecondary">
          The next sample number and QC insertion rate can be set from the
          project&apos;s settings once it&apos;s created.
        </ThemedText>

        <PrimaryButton
          label="Create project"
          onPress={handleCreate}
          loading={saving}
          disabled={name.trim().length === 0}
        />
      </FormScrollView>
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
