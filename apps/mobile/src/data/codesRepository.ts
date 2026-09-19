import {
  isCodeInUse,
  STARTER_CODES,
  validateCodeInput,
  type CodeCategory,
  type CoreValidationResult,
  type IntervalCodes,
  type LibraryCode,
  type LibraryCodeInput,
} from '@corechain/domain';
import { getDatabase } from './database';
import { newId, nowIso } from './ids';

// E4-1 / E4-2: the per-project code library. It is seeded from the bundled
// starter set the first time a project's library is read, so it works offline
// on first launch with no setup.

type CodeRow = {
  id: string;
  project_id: string;
  category: CodeCategory;
  code: string;
  description: string;
  hidden: number;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function rowToCode(row: CodeRow): LibraryCode {
  return {
    id: row.id,
    projectId: row.project_id,
    category: row.category,
    code: row.code,
    description: row.description,
    hidden: row.hidden === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

async function seedStarterCodesIfNew(projectId: string): Promise<void> {
  const db = await getDatabase();
  // Counts soft-deleted rows too, so deleting every code never re-seeds them.
  const { rows } = await db.execute(
    'SELECT COUNT(*) AS n FROM code_library WHERE project_id = ?',
    [projectId],
  );
  if (Number((rows as unknown as { n: number }[])[0]?.n ?? 0) > 0) {
    return;
  }

  const timestamp = nowIso();
  await db.executeBatch(
    STARTER_CODES.map((entry) => [
      `INSERT INTO code_library (
        id, project_id, category, code, description, hidden,
        created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)`,
      [newId(), projectId, entry.category, entry.code, entry.description, timestamp, timestamp],
    ]),
  );
}

/** Every (not deleted) code in the project's library, hidden ones included. */
export async function listCodes(projectId: string): Promise<LibraryCode[]> {
  await seedStarterCodesIfNew(projectId);
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT * FROM code_library
     WHERE project_id = ? AND deleted_at IS NULL
     ORDER BY category, code COLLATE NOCASE`,
    [projectId],
  );
  return (rows as unknown as CodeRow[]).map(rowToCode);
}

export type AddCodeResult =
  | { outcome: 'created'; code: LibraryCode }
  | { outcome: 'invalid'; result: CoreValidationResult };

export async function addCode(
  projectId: string,
  input: LibraryCodeInput,
): Promise<AddCodeResult> {
  const existing = await listCodes(projectId);
  const result = validateCodeInput(input, existing);
  if (!result.valid) {
    return { outcome: 'invalid', result };
  }

  const db = await getDatabase();
  const id = newId();
  const timestamp = nowIso();
  await db.execute(
    `INSERT INTO code_library (
      id, project_id, category, code, description, hidden,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)`,
    [
      id,
      projectId,
      input.category,
      input.code.trim(),
      input.description.trim(),
      timestamp,
      timestamp,
    ],
  );

  const created = (await listCodes(projectId)).find((c) => c.id === id);
  if (!created) {
    throw new Error(`Failed to read back newly created code ${id}.`);
  }
  return { outcome: 'created', code: created };
}

/** E4-2: rename = change the description. The short code is left alone, so existing intervals keep matching. */
export async function renameCode(
  id: string,
  description: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE code_library SET description = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [description.trim(), nowIso(), id],
  );
}

/** E4-2: hidden codes stay on existing intervals but leave new pick-lists. */
export async function setCodeHidden(
  id: string,
  hidden: boolean,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE code_library SET hidden = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [hidden ? 1 : 0, nowIso(), id],
  );
}

export type DeleteCodeResult = { outcome: 'deleted' } | { outcome: 'in-use' };

/** E4-2: a code that's in use on any interval in the project can't be deleted. */
export async function deleteCode(code: LibraryCode): Promise<DeleteCodeResult> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT i.lithology, i.alteration_type AS alterationType,
            i.alteration_intensity AS alterationIntensity, i.mineral,
            i.mineral_style AS mineralStyle, i.weathering,
            i.structure_type AS structureType
     FROM log_intervals i
     JOIN drillholes d ON d.id = i.drillhole_id
     WHERE d.project_id = ? AND i.deleted_at IS NULL`,
    [code.projectId],
  );
  const used = rows as unknown as Partial<IntervalCodes>[];
  if (isCodeInUse(code.category, code.code, used)) {
    return { outcome: 'in-use' };
  }

  const timestamp = nowIso();
  await db.execute(
    `UPDATE code_library SET deleted_at = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [timestamp, timestamp, code.id],
  );
  return { outcome: 'deleted' };
}
