import {
  buildExportTables,
  type ExportData,
  type ExportTable,
} from '@corechain/domain';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { listRuns } from './coreRepository';
import { listDrillholes } from './drillholesRepository';
import { listIntervals } from './intervalsRepository';
import { getProject } from './projectsRepository';
import { listSamples } from './samplesRepository';

// E9-1: CSV export. Everything is read from the local database and written to
// the app's cache folder, so it works with no signal.

/**
 * Reads a project's data and builds one CSV table per export file.
 * `filenamePrefix` overrides the project name in each file's name, for this
 * export only — nothing is saved.
 */
export async function loadExportTables(
  projectId: string,
  filenamePrefix?: string,
): Promise<ExportTable[]> {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found.`);
  }

  const drillholes = await listDrillholes(projectId);
  const [runsByHole, intervalsByHole, samples] = await Promise.all([
    Promise.all(drillholes.map((h) => listRuns(h.id))),
    Promise.all(drillholes.map((h) => listIntervals(h.id))),
    listSamples(projectId),
  ]);

  const data: ExportData = {
    project,
    drillholes,
    runs: runsByHole.flat(),
    intervals: intervalsByHole.flat(),
    samples,
    filenamePrefix,
  };
  return buildExportTables(data);
}

/** Writes a table to a CSV file in the cache folder and opens the share sheet. */
export async function shareTable(table: ExportTable): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing isn’t available on this device.');
  }

  const file = new File(Paths.cache, table.filename);
  file.create({ overwrite: true });
  file.write(table.csv);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: `Share ${table.label}`,
    UTI: 'public.comma-separated-values-text',
  });
}
