import {
  CODE_CATEGORIES,
  CODE_CATEGORY_LABELS,
  type CodeCategory,
  type LibraryCode,
} from '@corechain/domain';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect } from '@/components/form/chip-select';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import {
  addCode,
  deleteCode,
  listCodes,
  renameCode,
  setCodeHidden,
} from '@/data/codesRepository';
import { useTheme } from '@/hooks/use-theme';
import { useFocusReload } from '@/hooks/use-focus-reload';

/**
 * E4-2: edit the project's code library. Add a code, rename its description,
 * hide it (kept on existing intervals, gone from new pick-lists), or delete it
 * when no interval uses it.
 */
export default function CodeLibraryScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const theme = useTheme();

  const [codes, setCodes] = useState<LibraryCode[]>([]);
  const [category, setCategory] = useState<CodeCategory>('lithology');
  const [newCode, setNewCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reload = useCallback(() => {
    listCodes(projectId).then(setCodes);
  }, [projectId]);

  useFocusReload(reload);

  async function handleAdd() {
    setErrors({});
    const result = await addCode(projectId, {
      category,
      code: newCode,
      description: newDescription,
    });
    if (result.outcome === 'invalid') {
      const fieldErrors: Record<string, string> = {};
      if (!result.result.valid) {
        for (const e of result.result.errors) {
          fieldErrors[e.field] = e.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    setNewCode('');
    setNewDescription('');
    reload();
  }

  async function handleDelete(code: LibraryCode) {
    const result = await deleteCode(code);
    if (result.outcome === 'in-use') {
      Alert.alert(
        `${code.code} is in use`,
        'An interval uses this code, so it can’t be deleted. Hide it instead to remove it from new pick-lists.',
      );
      return;
    }
    reload();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="smallBold">Add a code</ThemedText>
        <ChipSelect
          label="Category"
          options={CODE_CATEGORIES}
          value={category}
          onChange={setCategory}
          formatOption={(c) => CODE_CATEGORY_LABELS[c]}
        />
        <TextField
          label="Code"
          value={newCode}
          onChangeText={setNewCode}
          error={errors.code}
          autoCapitalize="characters"
          placeholder="e.g. RHY"
        />
        <TextField
          label="Description"
          optional
          value={newDescription}
          onChangeText={setNewDescription}
          placeholder="e.g. Rhyolite"
        />
        <PrimaryButton label="Add code" onPress={handleAdd} />

        {CODE_CATEGORIES.map((cat) => {
          const inCategory = codes.filter((c) => c.category === cat);
          return (
            <View key={cat} style={styles.section}>
              <ThemedText type="smallBold">
                {CODE_CATEGORY_LABELS[cat]}
              </ThemedText>
              {inCategory.map((code) => (
                <Card
                  key={code.id}
                  style={[styles.row, code.hidden && styles.hiddenRow]}
                >
                  <ThemedText type="smallBold" style={styles.codeLabel}>
                    {code.code}
                  </ThemedText>
                  <TextInput
                    defaultValue={code.description}
                    onEndEditing={(e) => {
                      const text = e.nativeEvent.text;
                      if (text.trim() !== code.description) {
                        renameCode(code.id, text).then(reload);
                      }
                    }}
                    style={[styles.description, { color: theme.text }]}
                    accessibilityLabel={`Description for ${code.code}`}
                  />
                  <Pressable
                    onPress={() =>
                      setCodeHidden(code.id, !code.hidden).then(reload)
                    }
                    accessibilityRole="button"
                    hitSlop={Spacing.two}
                  >
                    <ThemedText type="small" themeColor="textSecondary">
                      {code.hidden ? 'Show' : 'Hide'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(code)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${code.code}`}
                    hitSlop={Spacing.two}
                  >
                    <ThemedText type="small" themeColor="textSecondary">
                      Delete
                    </ThemedText>
                  </Pressable>
                </Card>
              ))}
            </View>
          );
        })}
      </FormScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  hiddenRow: {
    opacity: 0.5,
  },
  codeLabel: {
    minWidth: 48,
  },
  description: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Spacing.one,
  },
});
