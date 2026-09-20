import {
  needsMoreNumbers,
  nextNumberFromBlocks,
  numbersLeft,
  usedNumbers,
  type NumberRange,
} from '@corechain/domain';

import { getDatabase } from './database';

// The runs of sample numbers the server has reserved for this phone (decision
// D6), per project. Kept only on this phone: the server is the record of who
// holds which run.

export async function saveBlock(block: {
  id: string;
  projectId: string;
  startNumber: number;
  size: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT OR IGNORE INTO sample_blocks (id, project_id, start_number, size, issued_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      block.id,
      block.projectId,
      block.startNumber,
      block.size,
      new Date().toISOString(),
    ],
  );
}

async function blocksOf(projectId: string): Promise<NumberRange[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT start_number, size FROM sample_blocks WHERE project_id = ?',
    [projectId],
  );
  return (rows as { start_number: number; size: number }[]).map((row) => ({
    start: row.start_number,
    size: row.size,
  }));
}

async function takenNumbers(projectId: string): Promise<Set<number>> {
  const db = await getDatabase();
  // Deleted samples count too: a number is a physical tag and is never reused.
  const { rows } = await db.execute(
    'SELECT sample_number FROM samples WHERE project_id = ?',
    [projectId],
  );
  return usedNumbers(
    (rows as { sample_number: string }[]).map((row) => row.sample_number),
  );
}

export type BlockStatus = {
  /** This phone holds at least one reserved run for the project. */
  hasBlocks: boolean;
  /** The next unused number in the runs, or null when they are all used up. */
  next: number | null;
  left: number;
  /** Few enough left that the geologist should connect for more. */
  low: boolean;
};

export async function blockStatus(projectId: string): Promise<BlockStatus> {
  const blocks = await blocksOf(projectId);
  if (blocks.length === 0) {
    return { hasBlocks: false, next: null, left: 0, low: false };
  }
  const used = await takenNumbers(projectId);
  const left = numbersLeft(blocks, used);
  return {
    hasBlocks: true,
    next: nextNumberFromBlocks(blocks, used),
    left,
    low: needsMoreNumbers(left),
  };
}
