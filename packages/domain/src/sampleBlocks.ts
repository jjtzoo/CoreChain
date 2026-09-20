// E6-4: device sample-number blocks. A phone with no signal can't ask a server
// for "the next number", so two phones working the same project would collide.
// Instead the server hands each device a reserved, contiguous block of numbers
// (decision D6). A sample number is a physical tag, so a number is never
// issued twice, even if the sample that used it is later deleted.

export const DEFAULT_BLOCK_SIZE = 100;
/** The app warns the geologist when fewer than this many numbers are left. */
export const LOW_NUMBERS_WARNING = 20;

/** Whole numbers from `start` up to, but not including, `start + size`. */
export type NumberRange = { start: number; size: number };

export function rangeEnd(range: NumberRange): number {
  return range.start + range.size;
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a whole number of at least 1.`);
  }
}

/**
 * The next block to issue for a project: it starts after every block already
 * issued and after the numbers the project had used before it had a server
 * (`firstAvailable`, the project's own "next sample number").
 */
export function nextBlockRange(
  issued: readonly NumberRange[],
  firstAvailable: number,
  size: number = DEFAULT_BLOCK_SIZE,
): NumberRange {
  assertPositiveInteger(firstAvailable, "The first available number");
  assertPositiveInteger(size, "The block size");
  const start = issued.reduce(
    (highest, block) => Math.max(highest, rangeEnd(block)),
    firstAvailable,
  );
  return { start, size };
}

/** Pairs of blocks that share a number. A healthy project has none. */
export function findOverlaps<T extends NumberRange>(
  blocks: readonly T[],
): Array<[T, T]> {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const overlaps: Array<[T, T]> = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].start >= rangeEnd(sorted[i])) break;
      overlaps.push([sorted[i], sorted[j]]);
    }
  }
  return overlaps;
}

/**
 * The lowest number this device may use next: the first number in its blocks
 * that has not been used. `null` means the device has run out and must sync to
 * get another block.
 */
export function nextNumberFromBlocks(
  blocks: readonly NumberRange[],
  used: ReadonlySet<number>,
): number | null {
  const ordered = [...blocks].sort((a, b) => a.start - b.start);
  for (const block of ordered) {
    for (let n = block.start; n < rangeEnd(block); n++) {
      if (!used.has(n)) return n;
    }
  }
  return null;
}

export function numbersLeft(
  blocks: readonly NumberRange[],
  used: ReadonlySet<number>,
): number {
  let left = 0;
  for (const block of blocks) {
    for (let n = block.start; n < rangeEnd(block); n++) {
      if (!used.has(n)) left++;
    }
  }
  return left;
}

/** True when the device should ask for another block (or warn the geologist). */
export function needsMoreNumbers(
  left: number,
  threshold: number = LOW_NUMBERS_WARNING,
): boolean {
  return left < threshold;
}

/**
 * The number at the end of a sample number ("CC-00042" gives 42), or null if
 * there is none. Used to work out which numbers of a block are already taken,
 * including tags a geologist typed by hand.
 */
export function trailingNumber(sampleNumber: string): number | null {
  const digits = sampleNumber.trim().match(/(\d+)$/)?.[1];
  if (!digits) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

/** Every number already taken, from the project's sample numbers. */
export function usedNumbers(sampleNumbers: readonly string[]): Set<number> {
  const used = new Set<number>();
  for (const sampleNumber of sampleNumbers) {
    const n = trailingNumber(sampleNumber);
    if (n !== null) used.add(n);
  }
  return used;
}
