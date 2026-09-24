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
// A team also gets a demo crew, so every screen has someone behind the work:
// three field geologists (each hole is assigned to one of them, and all of its
// logging and sampling is theirs), the team's in-house laboratory, and one
// QA/QC reviewer per stage of the chain (core and logging, sampling and
// custody, laboratory and assays), which is how CoreChain scopes QA/QC. They
// are demo accounts: no password, so nobody can sign in as them unless the
// admin sets one. The Alberta samples go the whole way: bagged, dispatched to
// the laboratory in two batches, the first received with results entered
// (illustrative values, not the survey's assays), the second still in transit.
// The Cordillera samples are left unbagged so custody can be tried by hand.
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
  /**
   * Who asked for it (the admin, or the account a seed script names). In a
   * personal workspace the demo work is credited to them; on a team they
   * assign the holes when the team has no project manager.
   */
  requestedBy: DemoPerson;
};

export type DemoPerson = { id: string; name: string };

type QaqcStageKey = "core_logging" | "sampling_custody" | "laboratory_assays";

/** Who the demo work is credited to. */
type Crew = {
  /** Hole i of a project is assigned to geologists[i % length]. */
  geologists: DemoPerson[];
  laboratory: DemoPerson;
  /** Null in a personal workspace: nobody else to review the work. */
  qaqc: Record<QaqcStageKey, DemoPerson> | null;
  /** Who assigned the holes; null in a personal workspace (no assignments). */
  assignedBy: string | null;
};

const DEMO_CREW = [
  { key: "geologist-1", name: "Maria Santos", role: "geologist", title: "Project geologist" },
  { key: "geologist-2", name: "Paolo Reyes", role: "geologist", title: "Field geologist" },
  { key: "geologist-3", name: "Andrea Lim", role: "geologist", title: "Field geologist" },
  { key: "laboratory", name: "Ramon Cruz", role: "laboratory", title: "Laboratory supervisor" },
  {
    key: "qaqc-core",
    name: "Liza Garcia",
    role: "qaqc",
    stage: "core_logging",
    title: "QA/QC, core and logging",
  },
  {
    key: "qaqc-sampling",
    name: "Jun Bautista",
    role: "qaqc",
    stage: "sampling_custody",
    title: "QA/QC, sampling and custody",
  },
  {
    key: "qaqc-laboratory",
    name: "Carla Mendoza",
    role: "qaqc",
    stage: "laboratory_assays",
    title: "QA/QC, laboratory and assays",
  },
] as const satisfies ReadonlyArray<{
  key: string;
  name: string;
  role: string;
  title: string;
  stage?: QaqcStageKey;
}>;

/** Every demo account's id starts with this, so they can be found and removed. */
export function demoAccountPrefix(organizationId: string): string {
  return `demo-${organizationId}-`;
}

/**
 * The demo crew for a workspace. On a team: the seven demo accounts, with the
 * holes assigned by the team's own project manager when it has one. In a
 * personal workspace: the account itself does everything, with no
 * assignments or QA/QC decisions, as a solo tester would.
 */
async function crewFor(db: Db, target: DemoTarget): Promise<{ crew: Crew; team: boolean }> {
  const team = await db.organization.findUnique({
    where: { id: target.organizationId },
    select: { id: true },
  });
  if (!team) {
    const me = target.requestedBy;
    return {
      crew: { geologists: [me], laboratory: me, qaqc: null, assignedBy: null },
      team: false,
    };
  }
  const person = (key: (typeof DEMO_CREW)[number]["key"]): DemoPerson => {
    const found = DEMO_CREW.find((p) => p.key === key)!;
    return { id: demoAccountPrefix(team.id) + key, name: found.name };
  };
  const manager = await db.user.findFirst({
    where: {
      organizationId: team.id,
      role: "project_manager",
      NOT: { id: { startsWith: demoAccountPrefix(team.id) } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return {
    crew: {
      geologists: [person("geologist-1"), person("geologist-2"), person("geologist-3")],
      laboratory: person("laboratory"),
      qaqc: {
        core_logging: person("qaqc-core"),
        sampling_custody: person("qaqc-sampling"),
        laboratory_assays: person("qaqc-laboratory"),
      },
      assignedBy: manager?.id ?? target.requestedBy.id,
    },
    team: true,
  };
}

/** Creates (or refreshes) a team's demo accounts. They have no password. */
async function upsertDemoCrew(db: Db, organizationId: string): Promise<void> {
  for (const p of DEMO_CREW) {
    const id = demoAccountPrefix(organizationId) + p.key;
    const fields = {
      name: p.name,
      // Reserved domain (RFC 2606): never a real mailbox. The end of the
      // team's id keeps it unique when several teams have a demo crew.
      email: `${p.name.replace(" ", ".")}.${organizationId.slice(-8)}@demo.invalid`.toLowerCase(),
      role: p.role,
      title: `${p.title} (demo)`,
      qaqcStage: "stage" in p ? p.stage : null,
      organizationId,
    };
    await db.user.upsert({ where: { id }, create: { id, ...fields }, update: fields });
  }
}

/** Removes a team's demo accounts (and, through the database, their hole assignments). */
export async function removeDemoCrew(db: Db, organizationId: string): Promise<number> {
  const { count } = await db.user.deleteMany({
    where: { id: { startsWith: demoAccountPrefix(organizationId) } },
  });
  return count;
}

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
  custody_events: { event_type: "CustodyEventType" },
  dispatches: { status: "DispatchStatus" },
  qaqc_review_decisions: { decision: "QaqcDecisionType" },
};

/** Web-only tables whose own id is text (a cuid), not a uuid. */
const TEXT_IDS = new Set(["hole_assignments", "qaqc_review_decisions", "assay_results"]);

function cast(table: string, column: string): string {
  const type = ENUMS[table]?.[column];
  if (type) return `::"${type}"`;
  if (column === "id") return TEXT_IDS.has(table) ? "" : "::uuid";
  if (
    [
      "project_id",
      "drillhole_id",
      "parent_sample_id",
      "sample_id",
      "dispatch_id",
      "corrects_event_id",
    ].includes(column)
  )
    return "::uuid";
  if (column === "started_at" || column === "completed_at") return "::date";
  // The handover day is text (YYYY-MM-DD), as the phone writes it.
  if (column === "handover_at") return "";
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

function buildAlberta(rows: RowBuffer, org: string, crew: Crew): DemoSummary {
  const { stamp, tracked } = clock();
  const projectId = randomUUID();
  const project: Row = {
    id: projectId,
    organization_id: org,
    created_by: crew.geologists[0].id,
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
  const holeIds: string[] = [];
  const sampleNumber = () => `AGS-${String(sampleNo++).padStart(5, "0")}`;
  const bagged: DemoSample[] = [];

  for (const [index, hole] of holes.entries()) {
    const holeId = randomUUID();
    const name = hole.DH_name;
    const depth = number(hole.Total_dpth) ?? 0;
    const drilled = value(hole.Drill_date);
    const age = 60 * 24 * (5 - index) + 90;
    // Each hole is one geologist's: assigned to them, and all its work is theirs.
    const geologist = crew.geologists[index % crew.geologists.length];
    const base = { organization_id: org, created_by: geologist.id, project_id: projectId };
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

    assign(rows, crew, holeId, geologist, stamp(age + 60 * 24));
    holeIds.push(holeId);

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

    bagged.push(
      ...addSamples(rows, base, holeId, sampled, index === 0, sampleNumber, "dispatched", tracked, age).map(
        (sample) => ({ ...sample, hole: index, geologist }),
      ),
    );
  }

  addAlbertaChain(rows, { org, projectId, crew, stamp }, bagged);
  if (crew.qaqc) {
    const logging = crew.qaqc.core_logging;
    const sampling = crew.qaqc.sampling_custody;
    for (const hole of [0, 1, 2])
      decide(rows, org, holeIds[hole], "accept", logging, stamp(60 * 24 * 2 + 120 - hole * 10),
        "Intervals, runs and recovery checked against the drill log.");
    decide(rows, org, holeIds[0], "accept", sampling, stamp(60 * 24 + 240),
      "Blank, standard and duplicate inserted; custody complete to the laboratory.");
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

function buildCordillera(rows: RowBuffer, org: string, crew: Crew): DemoSummary {
  const { stamp, tracked } = clock();
  const projectId = randomUUID();
  const project: Row = {
    id: projectId,
    organization_id: org,
    created_by: crew.geologists[0].id,
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
  const holeIds: string[] = [];
  const sampleNumber = () => `CDL-${String(sampleNo++).padStart(5, "0")}`;

  for (const [index, hole] of holes.entries()) {
    const holeId = randomUUID();
    const name = hole.hole_id;
    const depth = number(hole.final_depth_m) ?? 0;
    const drilled = value(hole.drilled_on);
    const age = 60 * 24 * (5 - index) + 90;
    // Each hole is one geologist's: assigned to them, and all its work is theirs.
    const geologist = crew.geologists[index % crew.geologists.length];
    const base = { organization_id: org, created_by: geologist.id, project_id: projectId };
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

    assign(rows, crew, holeId, geologist, stamp(age + 60 * 24));
    holeIds.push(holeId);

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

  if (crew.qaqc)
    decide(rows, org, holeIds[0], "hold", crew.qaqc.core_logging, stamp(60 * 24 * 3),
      "Recovery 78 to 83% in the weathered zone above 40 m. Check the runs before this hole is accepted.");

  project.next_sample_number = sampleNo;
  return {
    name: DEMO_PROJECTS.cordillera,
    holes: holes.length,
    intervals: intervalCount,
    boxesAndRuns: boxCount,
    samples: sampleNo - 1,
  };
}

type AddedSample = {
  id: string;
  sampleType: string;
  parentId: string | null;
  /** When the sample was recorded, in minutes ago. */
  age: number;
};

type DemoSample = AddedSample & { hole: number; geologist: DemoPerson };

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
): AddedSample[] {
  const added: AddedSample[] = [];
  const sample = (fields: Row, minutesAgo: number) => {
    const row: Row = {
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
    };
    rows.add("samples", row);
    added.push({
      id: row.id as string,
      sampleType: row.sample_type as string,
      parentId: (row.parent_sample_id as string | null) ?? null,
      age: minutesAgo,
    });
  };
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
  return added;
}

/** The hole's geologist, assigned by the team's manager (teams only). */
function assign(rows: RowBuffer, crew: Crew, holeId: string, to: DemoPerson, at: string): void {
  if (!crew.assignedBy) return;
  rows.add("hole_assignments", {
    id: randomUUID(),
    drillhole_id: holeId,
    user_id: to.id,
    assigned_by: crew.assignedBy,
    assigned_at: at,
  });
}

/** A QA/QC review decision on a hole (appended, as the QA/QC screen does). */
function decide(
  rows: RowBuffer,
  org: string,
  holeId: string,
  decision: "accept" | "hold" | "reject",
  by: DemoPerson,
  at: string,
  note: string,
): void {
  rows.add("qaqc_review_decisions", {
    id: randomUUID(),
    organization_id: org,
    drillhole_id: holeId,
    decision,
    note,
    decided_by: by.id,
    decided_at: at,
  });
}

const LABORATORY = "In-house laboratory";
const PREPARATION = "Crush to 70% passing 2 mm, pulverise to 85% passing 75 µm";

/**
 * The Alberta samples' custody, as the phone and the laboratory screen record
 * it: each hole's geologist bags its samples; the project geologist hands them
 * to the laboratory in two dispatches. DSP-001 (the first three holes) was
 * received and has results; DSP-002 (the last three) is still in transit, so
 * it waits in the laboratory's inbox.
 */
function addAlbertaChain(
  rows: RowBuffer,
  ctx: { org: string; projectId: string; crew: Crew; stamp: (minutesAgo: number) => string },
  samples: DemoSample[],
): void {
  const { org, projectId, crew, stamp } = ctx;
  const sender = crew.geologists[0];
  const lab = crew.laboratory;
  const custody = (sample: DemoSample, fields: Row, minutesAgo: number, by: DemoPerson) =>
    rows.add("custody_events", {
      id: randomUUID(),
      organization_id: org,
      project_id: projectId,
      created_by: by.id,
      sample_id: sample.id,
      event_type: "bagged",
      occurred_at: stamp(minutesAgo),
      handled_by: by.name,
      location: null,
      recipient: null,
      note: null,
      dispatch_id: null,
      corrects_event_id: null,
      created_at: stamp(minutesAgo),
      ...fields,
    });

  for (const sample of samples)
    custody(sample, { event_type: "bagged", location: "Core yard" }, sample.age - 10, sample.geologist);

  const batches = [
    {
      number: "DSP-001",
      members: samples.filter((s) => s.hole < 3),
      handover: 60 * 24 * 2 + 600,
      received: 60 * 24 + 900,
      resultsReturned: 60 * 20,
    },
    {
      number: "DSP-002",
      members: samples.filter((s) => s.hole >= 3),
      handover: 30,
      received: null,
      resultsReturned: null,
    },
  ];
  for (const batch of batches) {
    if (batch.members.length === 0) continue;
    const dispatchId = randomUUID();
    const handoverAt = stamp(batch.handover);
    rows.add("dispatches", {
      id: dispatchId,
      organization_id: org,
      project_id: projectId,
      created_by: sender.id,
      dispatch_number: batch.number,
      laboratory: LABORATORY,
      preparation_request: PREPARATION,
      handover_at: handoverAt.slice(0, 10),
      status: "dispatched",
      note: null,
      results_returned_at: batch.resultsReturned === null ? null : stamp(batch.resultsReturned),
      created_at: stamp(batch.handover + 15),
      updated_at: handoverAt,
      version: 2,
      deleted_at: null,
    });
    for (const sample of batch.members) {
      rows.add("dispatch_samples", {
        id: randomUUID(),
        organization_id: org,
        project_id: projectId,
        created_by: sender.id,
        dispatch_id: dispatchId,
        sample_id: sample.id,
        created_at: stamp(batch.handover + 15),
        updated_at: stamp(batch.handover + 15),
        version: 1,
        deleted_at: null,
      });
      custody(
        sample,
        { event_type: "dispatched", recipient: lab.name, dispatch_id: dispatchId },
        batch.handover,
        sender,
      );
      if (batch.received !== null)
        custody(sample, { event_type: "received", dispatch_id: dispatchId }, batch.received, lab);
    }
    if (batch.resultsReturned !== null)
      addResults(rows, org, dispatchId, batch.members, lab, stamp(batch.resultsReturned + 60));
  }
}

/**
 * Illustrative copper and zinc results (ppm), not the survey's assays: a blank
 * below detection, a standard, and a duplicate within a few per cent of its
 * original, so the laboratory and QA/QC screens have realistic numbers.
 */
function addResults(
  rows: RowBuffer,
  org: string,
  dispatchId: string,
  samples: DemoSample[],
  lab: DemoPerson,
  at: string,
): void {
  const primary = new Map<string, { cu: number; zn: number }>();
  const result = (sample: DemoSample, analyte: string, value: number | null) =>
    rows.add("assay_results", {
      id: randomUUID(),
      organization_id: org,
      dispatch_id: dispatchId,
      sample_id: sample.id,
      analyte,
      value,
      unit: "ppm",
      below_detection: value === null,
      entered_by: lab.id,
      created_at: at,
    });
  samples.forEach((sample, i) => {
    let grade: { cu: number | null; zn: number | null };
    if (sample.sampleType === "blank") grade = { cu: null, zn: null };
    else if (sample.sampleType === "standard") grade = { cu: 742, zn: 131 };
    else if (sample.sampleType === "duplicate") {
      const original = primary.get(sample.parentId ?? "") ?? { cu: 400, zn: 90 };
      grade = { cu: Math.round(original.cu * 1.04), zn: Math.round(original.zn * 0.97) };
    } else {
      const g = { cu: 180 + ((i * 397) % 1900), zn: 60 + ((i * 131) % 540) };
      primary.set(sample.id, g);
      grade = g;
    }
    result(sample, "Cu", grade.cu);
    result(sample, "Zn", grade.zn);
  });
}

const BUILDERS: Record<DemoProjectKey, (rows: RowBuffer, org: string, crew: Crew) => DemoSummary> = {
  alberta: buildAlberta,
  cordillera: buildCordillera,
};

/**
 * Loads the chosen demo projects into one workspace, replacing any earlier
 * copy of the same project there. On a team this also creates (or refreshes)
 * the demo crew the work is credited to.
 */
export async function loadDemoProjects(
  prisma: PrismaClient,
  target: DemoTarget,
  which: readonly DemoProjectKey[] = ["alberta", "cordillera"],
): Promise<DemoSummary[]> {
  const { crew, team } = await crewFor(prisma, target);
  const rows = new RowBuffer();
  const summaries = which.map((key) => BUILDERS[key](rows, target.organizationId, crew));
  await prisma.$transaction(
    async (tx) => {
      await removeDemoProjects(tx, target.organizationId, which.map((k) => DEMO_PROJECTS[k]));
      if (team) await upsertDemoCrew(tx, target.organizationId);
      await rows.flush(tx);
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  return summaries;
}

/** Removes a team's demo projects and its demo crew. */
export async function removeDemo(db: Db, organizationId: string): Promise<number> {
  const removed = await removeDemoProjects(db, organizationId);
  await removeDemoCrew(db, organizationId);
  return removed;
}
