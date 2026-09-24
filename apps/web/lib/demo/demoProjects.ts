import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvRows } from "@corechain/domain";
import type { Prisma, PrismaClient } from "@prisma/client";

// The two demo projects, so a team has realistic work to look at before its
// geologists have logged anything (the admin's "Demo projects", or
// `npm run sample:seed` / `sample:cordillera`).
//
// What is official: the Alberta project's six drillholes (names, collars,
// drill type, final depths, drill dates) and 27 logged intervals come from the
// Alberta Geological Survey's Digital Data 2024-0022 (apps/web/data/demo).
// EVERYTHING in the Cordillera project is made up. In both, the core boxes,
// runs and samples, QC samples included, are illustrative, cut from the
// logged depths so every feature has something to show. None of it is real
// assay or custody data.
//
// Loading again replaces the earlier copy in that workspace; nothing else is
// touched. All of it happens in one transaction, so a failure never leaves
// half a project behind.

export const DEMO_PROJECTS = {
  alberta: "Alberta sample project",
  cordillera: "Cordillera porphyry sample (synthetic)",
} as const;
export type DemoProjectKey = keyof typeof DEMO_PROJECTS;
export const DEMO_PROJECT_NAMES: readonly string[] = Object.values(DEMO_PROJECTS);

export type DemoTarget = {
  /** The workspace: a team's id, or a solo account's own id. */
  organizationId: string;
  /** The account the demo work is credited to. */
  createdBy: string;
};

export type DemoSummary = {
  name: string;
  holes: number;
  intervals: number;
  boxesAndRuns: number;
  samples: number;
};

type Db = PrismaClient | Prisma.TransactionClient;
type Row = Record<string, unknown>;

// Run from apps/web (the npm scripts and the Next.js server both do).
// next.config.ts includes these files in the server bundle.
const DATA = resolve(process.cwd(), "data/demo");

function readCsv(path: string): Record<string, string>[] {
  const rows = parseCsvRows(readFileSync(resolve(DATA, path), "utf8")).filter(
    (row) => row.some((cell) => cell !== ""),
  );
  const [header = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const ENUMS: Record<string, Record<string, string>> = {
  drillholes: { status: "DrillholeStatus", collar_source: "CollarSource" },
  drillhole_status_history: { status: "DrillholeStatus" },
  samples: { sample_type: "SampleType", status: "SampleStatus" },
};

function cast(table: string, column: string): string {
  const type = ENUMS[table]?.[column];
  if (type) return `::"${type}"`;
  if (["id", "project_id", "drillhole_id", "parent_sample_id"].includes(column))
    return "::uuid";
  if (column === "started_at" || column === "completed_at") return "::date";
  if (/_at$/.test(column)) return "::timestamptz";
  return "";
}

/** Rows collected in memory, then written table by table in large batches. */
class RowBuffer {
  private readonly tables = new Map<string, Row[]>();

  add(table: string, row: Row): void {
    const rows = this.tables.get(table) ?? [];
    rows.push(row);
    this.tables.set(table, rows);
  }

  async flush(db: Db): Promise<void> {
    // Parents before children; insertion order within a table is kept, so a
    // duplicate sample comes after the sample it duplicates.
    for (const [table, rows] of this.tables) {
      const columns = Object.keys(rows[0]);
      for (let start = 0; start < rows.length; start += 200) {
        const chunk = rows.slice(start, start + 200);
        const params: unknown[] = [];
        const values = chunk.map((row) => {
          const cells = columns.map((column) => {
            params.push(row[column] ?? null);
            return `$${params.length}${cast(table, column)}`;
          });
          return `(${cells.join(", ")})`;
        });
        await db.$executeRawUnsafe(
          `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES ${values.join(", ")}`,
          ...params,
        );
      }
    }
  }
}

const value = (raw: string | undefined) =>
  raw === undefined || raw === "" || raw === "-9999" ? null : raw;
const number = (raw: string | undefined) => {
  const v = value(raw);
  return v === null ? null : Number(v);
};

function clock() {
  const now = new Date();
  const stamp = (minutesAgo: number) =>
    new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const tracked = (minutesAgo: number) => ({
    created_at: stamp(minutesAgo),
    updated_at: stamp(minutesAgo),
    version: 1,
    deleted_at: null,
  });
  return { stamp, tracked };
}

/** Deletes the demo projects in one workspace, with everything recorded in them. */
export async function removeDemoProjects(
  db: Db,
  organizationId: string,
  names: readonly string[] = DEMO_PROJECT_NAMES,
): Promise<number> {
  const old = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id::text FROM projects WHERE organization_id = $1 AND name = ANY($2::text[])`,
    organizationId,
    names,
  );
  for (const { id } of old) {
    const holes = `SELECT id FROM drillholes WHERE project_id = $1::uuid`;
    for (const t of [
      "drillhole_status_history",
      "core_boxes",
      "core_runs",
      "log_intervals",
      "photos",
    ])
      await db.$executeRawUnsafe(
        `DELETE FROM "${t}" WHERE drillhole_id IN (${holes})`,
        id,
      );
    for (const t of [
      // Custody, dispatch, receipt and result rows point at samples, so they go first.
      "assay_results",
      "dispatch_samples",
      "custody_events",
      "dispatches",
      "sample_number_blocks",
      "samples",
      "qc_dismissals",
      "code_library",
      "drillholes",
    ])
      await db.$executeRawUnsafe(
        t === "assay_results"
          ? `DELETE FROM "${t}" WHERE sample_id IN (SELECT id FROM samples WHERE project_id = $1::uuid)`
          : `DELETE FROM "${t}" WHERE project_id = $1::uuid`,
        id,
      );
    await db.$executeRawUnsafe(`DELETE FROM projects WHERE id = $1::uuid`, id);
  }
  return old.length;
}

function buildAlberta(rows: RowBuffer, target: DemoTarget): DemoSummary {
  const { organizationId: org, createdBy } = target;
  const { stamp, tracked } = clock();
  const projectId = randomUUID();
  const project: Row = {
    id: projectId,
    organization_id: org,
    created_by: createdBy,
    name: DEMO_PROJECTS.alberta,
    commodity: "Base metals",
    location: "Alberta, Canada",
    coordinate_system: "WGS84",
    sample_prefix: "AGS",
    next_sample_number: 1,
    qc_standard_every_n: 20,
    qc_blank_every_n: 20,
    qc_duplicate_every_n: 20,
    photo_max_mb: 1.5,
    ...tracked(60 * 24 * 6),
  };
  rows.add("projects", project);

  const holes = readCsv("alberta-dig-2024-0022/curated/drillholes.csv");
  const intervals = readCsv("alberta-dig-2024-0022/curated/intervals.csv");
  let boxCount = 0;
  let intervalCount = 0;
  let sampleNo = 1;
  const sampleNumber = () => `AGS-${String(sampleNo++).padStart(5, "0")}`;
  const base = { organization_id: org, created_by: createdBy, project_id: projectId };

  for (const [index, hole] of holes.entries()) {
    const holeId = randomUUID();
    const name = hole.DH_name;
    const depth = number(hole.Total_dpth) ?? 0;
    const drilled = value(hole.Drill_date);
    const age = 60 * 24 * (5 - index) + 90;
    rows.add("drillholes", {
      id: holeId,
      ...base,
      hole_id: name,
      collar_source: "manual",
      collar_latitude: number(hole.Lat_NAD83),
      collar_longitude: number(hole.Long_NAD83),
      collar_accuracy_m: null,
      collar_captured_at: null,
      planned_azimuth_deg: number(hole.Azimuth),
      planned_inclination_deg: number(hole.Inclnation),
      planned_depth_m: depth,
      actual_final_depth_m: depth,
      started_at: drilled,
      completed_at: drilled,
      status: "logged",
      contractor: value(hole.Contractor),
      drill_type: value(hole.Drill_type),
      diameter: value(hole.DH_diam),
      note: null,
      ...tracked(age),
    });
    for (const status of ["planned", "drilling", "complete", "logged"])
      rows.add("drillhole_status_history", {
        id: randomUUID(),
        organization_id: org,
        project_id: projectId,
        drillhole_id: holeId,
        status,
        changed_at: stamp(age),
      });

    const mine = intervals
      .filter((row) => row.DH_name === name)
      .sort((a, b) => Number(a.Intrvl_top) - Number(b.Intrvl_top));
    const chunks = new Set<number>();
    const sampled: Array<{ id: string; from: number; to: number }> = [];
    for (const row of mine) {
      const from = Number(row.Intrvl_top);
      const to = Number(row.Intrvl_btm);
      const notes = value(row.Intrvl_dsc);
      rows.add("log_intervals", {
        id: randomUUID(),
        ...base,
        drillhole_id: holeId,
        from_m: from,
        to_m: to,
        lithology: value(row.Rock_type),
        alteration_type: null,
        alteration_intensity: null,
        mineral: notes && /py/i.test(notes) ? "Pyrite" : null,
        mineral_style: null,
        mineral_percent: null,
        weathering: null,
        structure_type: null,
        notes: value(row.Litho_unit),
        ...tracked(age - 20),
      });
      intervalCount++;
      for (let m = Math.floor(from / 3); m <= Math.floor((to - 0.001) / 3); m++)
        chunks.add(m);
      if (notes && /py/i.test(notes) && sampled.length < 2) {
        sampled.push({ id: randomUUID(), from, to });
      }
    }

    // Illustrative: 3 m core boxes and runs over the depths that were logged.
    for (const m of [...chunks].sort((a, b) => a - b)) {
      const from = m * 3;
      const to = Math.min(from + 3, depth);
      rows.add("core_boxes", {
        id: randomUUID(),
        ...base,
        drillhole_id: holeId,
        box_number: m + 1,
        from_m: from,
        to_m: to,
        note: null,
        ...tracked(age - 10),
      });
      boxCount++;
      rows.add("core_runs", {
        id: randomUUID(),
        ...base,
        drillhole_id: holeId,
        from_m: from,
        to_m: to,
        recovered_m: Math.round((to - from) * (0.9 + ((m * 7) % 10) / 100) * 100) / 100,
        rqd_pieces_m: Math.round((to - from) * (0.72 + ((m * 3) % 12) / 100) * 100) / 100,
        ...tracked(age - 10),
      });
    }

    addSamples(rows, base, holeId, sampled, index === 0, sampleNumber, "bagged", tracked, age);
  }

  // Sample numbers are physical tags: the project's counter starts after the
  // ones used here, so a phone's first block never repeats them.
  project.next_sample_number = sampleNo;
  return {
    name: DEMO_PROJECTS.alberta,
    holes: holes.length,
    intervals: intervalCount,
    boxesAndRuns: boxCount,
    samples: sampleNo - 1,
  };
}

const MINERALISED = new Set(["CPY", "BN", "MOL", "AU"]);

function buildCordillera(rows: RowBuffer, target: DemoTarget): DemoSummary {
  const { organizationId: org, createdBy } = target;
  const { stamp, tracked } = clock();
  const projectId = randomUUID();
  const project: Row = {
    id: projectId,
    organization_id: org,
    created_by: createdBy,
    name: DEMO_PROJECTS.cordillera,
    commodity: "Copper-gold",
    location: "Cordillera, Philippines (fictional prospect)",
    coordinate_system: "WGS84",
    sample_prefix: "CDL",
    next_sample_number: 1,
    qc_standard_every_n: 20,
    qc_blank_every_n: 20,
    qc_duplicate_every_n: 20,
    photo_max_mb: 1.5,
    ...tracked(60 * 24 * 6),
  };
  rows.add("projects", project);

  const holes = readCsv("synthetic-cordillera-porphyry/curated/drillholes.csv");
  const intervals = readCsv("synthetic-cordillera-porphyry/curated/intervals.csv");
  let boxCount = 0;
  let intervalCount = 0;
  let sampleNo = 1;
  const sampleNumber = () => `CDL-${String(sampleNo++).padStart(5, "0")}`;
  const base = { organization_id: org, created_by: createdBy, project_id: projectId };

  for (const [index, hole] of holes.entries()) {
    const holeId = randomUUID();
    const name = hole.hole_id;
    const depth = number(hole.final_depth_m) ?? 0;
    const drilled = value(hole.drilled_on);
    const age = 60 * 24 * (5 - index) + 90;
    rows.add("drillholes", {
      id: holeId,
      ...base,
      hole_id: name,
      collar_source: "manual",
      collar_latitude: number(hole.latitude),
      collar_longitude: number(hole.longitude),
      collar_accuracy_m: null,
      collar_captured_at: null,
      planned_azimuth_deg: number(hole.azimuth_deg),
      planned_inclination_deg: number(hole.dip_deg),
      planned_depth_m: depth,
      actual_final_depth_m: depth,
      started_at: drilled,
      completed_at: drilled,
      status: "logged",
      contractor: value(hole.contractor),
      drill_type: value(hole.drill_type),
      diameter: value(hole.diameter),
      note: null,
      ...tracked(age),
    });
    for (const status of ["planned", "drilling", "complete", "logged"])
      rows.add("drillhole_status_history", {
        id: randomUUID(),
        organization_id: org,
        project_id: projectId,
        drillhole_id: holeId,
        status,
        changed_at: stamp(age),
      });

    const mine = intervals
      .filter((row) => row.hole_id === name)
      .sort((a, b) => Number(a.from_m) - Number(b.from_m));
    const sampled: Array<{ id: string; from: number; to: number }> = [];
    for (const row of mine) {
      const from = Number(row.from_m);
      const to = Number(row.to_m);
      rows.add("log_intervals", {
        id: randomUUID(),
        ...base,
        drillhole_id: holeId,
        from_m: from,
        to_m: to,
        lithology: value(row.lithology),
        alteration_type: value(row.alteration_type),
        alteration_intensity: value(row.alteration_intensity),
        mineral: value(row.mineral),
        mineral_style: value(row.mineral_style),
        mineral_percent: number(row.mineral_percent),
        weathering: value(row.weathering),
        structure_type: value(row.structure_type),
        notes: value(row.notes),
        ...tracked(age - 20),
      });
      intervalCount++;
      // Illustrative: the first 2 m of up to four mineralised intervals.
      if (MINERALISED.has(row.mineral) && sampled.length < 4)
        sampled.push({ id: randomUUID(), from, to: Math.min(from + 2, to) });
    }

    // Illustrative: 3 m core boxes and runs over the whole hole.
    for (let m = 0; m * 3 < depth; m++) {
      const from = m * 3;
      const to = Math.min(from + 3, depth);
      rows.add("core_boxes", {
        id: randomUUID(),
        ...base,
        drillhole_id: holeId,
        box_number: m + 1,
        from_m: from,
        to_m: to,
        note: null,
        ...tracked(age - 10),
      });
      boxCount++;
      // Recovery is poor in the weathered cap and good in fresh rock.
      const weathered = from < 40;
      rows.add("core_runs", {
        id: randomUUID(),
        ...base,
        drillhole_id: holeId,
        from_m: from,
        to_m: to,
        recovered_m:
          Math.round((to - from) * ((weathered ? 0.78 : 0.94) + ((m * 7) % 6) / 100) * 100) / 100,
        rqd_pieces_m:
          Math.round((to - from) * ((weathered ? 0.42 : 0.78) + ((m * 3) % 12) / 100) * 100) / 100,
        ...tracked(age - 10),
      });
    }

    // Samples start as "created" (not yet bagged) so the custody steps can be tried.
    addSamples(rows, base, holeId, sampled, index === 0, sampleNumber, "created", tracked, age);
  }

  project.next_sample_number = sampleNo;
  return {
    name: DEMO_PROJECTS.cordillera,
    holes: holes.length,
    intervals: intervalCount,
    boxesAndRuns: boxCount,
    samples: sampleNo - 1,
  };
}

function addSamples(
  rows: RowBuffer,
  base: Row,
  holeId: string,
  sampled: Array<{ id: string; from: number; to: number }>,
  withQc: boolean,
  sampleNumber: () => string,
  status: string,
  tracked: (minutesAgo: number) => Row,
  age: number,
): void {
  const sample = (fields: Row, minutesAgo: number) =>
    rows.add("samples", {
      id: randomUUID(),
      ...base,
      drillhole_id: holeId,
      sample_number: sampleNumber(),
      sample_type: "primary",
      from_m: null,
      to_m: null,
      standard_ref: null,
      parent_sample_id: null,
      note: null,
      status,
      ...tracked(minutesAgo),
      ...fields,
    });
  for (const s of sampled) sample({ id: s.id, from_m: s.from, to_m: s.to }, age - 5);
  const first = sampled[0];
  if (withQc && first) {
    sample({ sample_type: "blank" }, age - 4);
    sample({ sample_type: "standard", standard_ref: "OREAS 45e" }, age - 4);
    sample(
      { sample_type: "duplicate", from_m: first.from, to_m: first.to, parent_sample_id: first.id },
      age - 4,
    );
  }
}

const BUILDERS: Record<DemoProjectKey, (rows: RowBuffer, target: DemoTarget) => DemoSummary> = {
  alberta: buildAlberta,
  cordillera: buildCordillera,
};

/**
 * Loads the chosen demo projects into one workspace, replacing any earlier
 * copy of the same project there.
 */
export async function loadDemoProjects(
  prisma: PrismaClient,
  target: DemoTarget,
  which: readonly DemoProjectKey[] = ["alberta", "cordillera"],
): Promise<DemoSummary[]> {
  const rows = new RowBuffer();
  const summaries = which.map((key) => BUILDERS[key](rows, target));
  await prisma.$transaction(
    async (tx) => {
      await removeDemoProjects(tx, target.organizationId, which.map((k) => DEMO_PROJECTS[k]));
      await rows.flush(tx);
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  return summaries;
}
