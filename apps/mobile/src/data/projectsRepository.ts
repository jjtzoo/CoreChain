import type {
  FieldValidationResult,
  Project,
  ProjectInput,
} from '@corechain/domain';
import { validateProjectInput } from '@corechain/domain';
import type { Scalar } from '@op-engineering/op-sqlite';
import { getDatabase } from './database';
import { newId, nowIso } from './ids';

const DEFAULT_SAMPLE_PREFIX = 'CC';
const DEFAULT_NEXT_SAMPLE_NUMBER = 1;
const DEFAULT_QC_EVERY_N = 20;

type ProjectRow = {
  id: string;
  name: string;
  commodity: string | null;
  location: string | null;
  coordinate_system: string;
  sample_prefix: string;
  next_sample_number: number;
  qc_standard_every_n: number;
  qc_blank_every_n: number;
  qc_duplicate_every_n: number;
  photo_max_mb: number;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    commodity: row.commodity,
    location: row.location,
    coordinateSystem: row.coordinate_system as Project['coordinateSystem'],
    samplePrefix: row.sample_prefix,
    nextSampleNumber: row.next_sample_number,
    qcInsertionRate: {
      standardEveryN: row.qc_standard_every_n,
      blankEveryN: row.qc_blank_every_n,
      duplicateEveryN: row.qc_duplicate_every_n,
    },
    photoMaxMb: row.photo_max_mb,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

export type CreateProjectResult =
  | { outcome: 'created'; project: Project }
  | { outcome: 'invalid'; errors: FieldValidationResult };

export async function createProject(
  input: ProjectInput,
): Promise<CreateProjectResult> {
  const validation = validateProjectInput(input);
  if (!validation.valid) {
    return { outcome: 'invalid', errors: validation };
  }

  const db = await getDatabase();
  const id = newId();
  const timestamp = nowIso();
  const qc = {
    standardEveryN: input.qcInsertionRate?.standardEveryN ?? DEFAULT_QC_EVERY_N,
    blankEveryN: input.qcInsertionRate?.blankEveryN ?? DEFAULT_QC_EVERY_N,
    duplicateEveryN:
      input.qcInsertionRate?.duplicateEveryN ?? DEFAULT_QC_EVERY_N,
  };

  const params: Scalar[] = [
    id,
    input.name.trim(),
    input.commodity ?? null,
    input.location ?? null,
    input.coordinateSystem,
    input.samplePrefix?.trim() || DEFAULT_SAMPLE_PREFIX,
    input.nextSampleNumber ?? DEFAULT_NEXT_SAMPLE_NUMBER,
    qc.standardEveryN,
    qc.blankEveryN,
    qc.duplicateEveryN,
    timestamp,
    timestamp,
    1,
  ];

  await db.execute(
    `INSERT INTO projects (
      id, name, commodity, location, coordinate_system, sample_prefix,
      next_sample_number, qc_standard_every_n, qc_blank_every_n,
      qc_duplicate_every_n, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params,
  );

  const project = await getProject(id);
  if (!project) {
    // Should be unreachable: we just inserted this row ourselves.
    throw new Error(`Failed to read back newly created project ${id}.`);
  }
  return { outcome: 'created', project };
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE',
  );
  return (rows as unknown as ProjectRow[]).map(rowToProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  const row = (rows as unknown as ProjectRow[])[0];
  return row ? rowToProject(row) : null;
}

/**
 * E1-2: updates sampling settings only. Renumbering existing samples is
 * explicitly out of scope (see the story's acceptance criteria) — this
 * never touches samples, only the project's own next-number counter.
 */
export async function updateProjectSamplingSettings(
  id: string,
  settings: {
    samplePrefix: string;
    nextSampleNumber: number;
    qcInsertionRate: Project['qcInsertionRate'];
  },
): Promise<Project | null> {
  const db = await getDatabase();
  const existing = await getProject(id);
  if (!existing) {
    return null;
  }

  await db.execute(
    `UPDATE projects SET
      sample_prefix = ?, next_sample_number = ?,
      qc_standard_every_n = ?, qc_blank_every_n = ?, qc_duplicate_every_n = ?,
      updated_at = ?, version = version + 1
    WHERE id = ?`,
    [
      settings.samplePrefix.trim() || DEFAULT_SAMPLE_PREFIX,
      settings.nextSampleNumber,
      settings.qcInsertionRate.standardEveryN,
      settings.qcInsertionRate.blankEveryN,
      settings.qcInsertionRate.duplicateEveryN,
      nowIso(),
      id,
    ],
  );

  return getProject(id);
}

/** E5-1: sets the largest size (in MB) a saved photo may be. */
export async function updateProjectPhotoMaxMb(
  id: string,
  photoMaxMb: number,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE projects SET photo_max_mb = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [photoMaxMb, nowIso(), id],
  );
}
