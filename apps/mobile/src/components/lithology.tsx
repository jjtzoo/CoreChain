import {
  holeLogColour,
  STARTER_CODES,
  type CodeCategory,
  type LibraryCode,
  type LithologyEntry,
  type RockUnit,
} from '@corechain/domain';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// Pieces shared by the lithology dictionary and the rock units screens.

/** "Andesite" for AND: the project's own code library first, then the starter codes. */
export function codeNamer(codes: readonly LibraryCode[]) {
  const names = new Map<string, string>();
  for (const entry of STARTER_CODES) {
    names.set(`${entry.category}:${entry.code.toUpperCase()}`, entry.description);
  }
  for (const entry of codes) {
    names.set(`${entry.category}:${entry.code.toUpperCase()}`, entry.description);
  }
  return (category: CodeCategory, code: string): string =>
    names.get(`${category}:${code.toUpperCase()}`) ?? code;
}

export function metres(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** The rock's colour from the hole log, as a small square. */
export function Swatch({ code, size = 28 }: { code: string; size?: number }) {
  return (
    <View
      style={[
        styles.swatch,
        {
          width: size,
          height: size,
          borderRadius: size > 30 ? 10 : 6,
          backgroundColor: holeLogColour('lithology', code),
        },
      ]}
    />
  );
}

/** Each rock type's share of the logged core, as one bar. */
export function CompositionBar({ entries }: { entries: readonly LithologyEntry[] }) {
  return (
    <View style={styles.composition} accessibilityRole="image">
      {entries.map((entry) => (
        <View
          key={entry.code}
          style={{ flex: entry.lengthM, backgroundColor: holeLogColour('lithology', entry.code) }}
        />
      ))}
    </View>
  );
}

/** A hole's rock units end to end, in proportion. */
export function UnitStrip({ units }: { units: readonly RockUnit[] }) {
  return (
    <View style={styles.strip} accessibilityRole="image">
      {units.map((unit) => (
        <View
          key={`${unit.fromM}-${unit.intervalIds[0]}`}
          style={{ flex: unit.lengthM, backgroundColor: holeLogColour('lithology', unit.lithology) }}
        />
      ))}
    </View>
  );
}

/**
 * One hole drawn to scale against the deepest hole, with where one rock type
 * sits in it.
 */
export function Occurrence({
  units,
  code,
  depthM,
  maxDepthM,
}: {
  units: readonly RockUnit[];
  code: string;
  depthM: number;
  maxDepthM: number;
}) {
  const theme = useTheme();
  const scale = maxDepthM > 0 ? depthM / maxDepthM : 1;
  return (
    <View style={[styles.occurrence, { width: `${Math.max(scale, 0.08) * 100}%`, backgroundColor: theme.backgroundSelected }]}>
      {units.map((unit) => (
        <View
          key={`${unit.fromM}-${unit.intervalIds[0]}`}
          style={[
            styles.occurrenceUnit,
            {
              left: `${(unit.fromM / depthM) * 100}%`,
              width: `${(unit.lengthM / depthM) * 100}%`,
              backgroundColor: holeLogColour('lithology', code),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  composition: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    gap: 2,
  },
  strip: {
    flexDirection: 'row',
    height: 18,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 2,
  },
  occurrence: {
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
  },
  occurrenceUnit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
