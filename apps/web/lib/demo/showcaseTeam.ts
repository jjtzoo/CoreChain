import { randomUUID } from "node:crypto";
import { STARTER_CODES } from "@corechain/domain";
import type { PrismaClient } from "@prisma/client";
import { removeDemoProjects, RowBuffer, type Db, type Row } from "./demoProjects";

// The showcase team: a separate, made-up exploration team whose work looks
// like a real drilling programme part-way through, so every page of the web
// app (project manager, laboratory, QA/QC) has something true-to-life to show.
// `npm run showcase:seed` builds it; nothing outside this one team is touched.
//
// EVERYTHING here is synthetic: the team, the people, the prospects, the
// collars, the logging and every assay. The people are accounts with no
// password; the admin opens the web app as them with "View as".
//
// What it shows, as of the day it is loaded (all dates count back from then):
// - Mabini Ridge (copper-gold porphyry, 14 holes): holes in every state.
//   Five logged, two drilled and still being logged, three drilling (one
//   marked urgent, one stopped for 9 days with no geologist), four planned
//   (one not yet surveyed). Seven dispatches: three with results back, one
//   overdue at the laboratory, one waiting, one in transit (not yet received)
//   and one still being put together.
//   QA/QC has accepts, two holds and a rejection, each with a reviewer's note,
//   and the laboratory results include one failed standard and one
//   contaminated blank.
// - Bantay (epithermal gold, 6 holes): an early scout programme with one
//   dispatch at the laboratory.
// Load it again before a demonstration: the dates are relative to the day it
// is loaded, so a week later the drilling holes look quiet.

export const SHOWCASE_TEAM_ID = "showcase-mabini-ridge";
export const SHOWCASE_TEAM_NAME = "Mabini Ridge Exploration (showcase)";
const ACCOUNT_PREFIX = "showcase-";

type PersonKey = "pm" | "g1" | "g2" | "g3" | "g4" | "lab" | "qcCore" | "qcSampling" | "qcLab";
type Stage = "core_logging" | "sampling_custody" | "laboratory_assays";

const PEOPLE: Record<PersonKey, { name: string; role: string; title: string; stage?: Stage }> = {
  pm: { name: "Elena Villanueva", role: "project_manager", title: "Exploration project manager" },
  g1: { name: "Marco Dizon", role: "geologist", title: "Senior project geologist" },
  g2: { name: "Jessa Ramirez", role: "geologist", title: "Field geologist" },
  g3: { name: "Noel Aquino", role: "geologist", title: "Field geologist" },
  g4: { name: "Katrina Uy", role: "geologist", title: "Junior geologist" },
  lab: { name: "Arnel Pascual", role: "laboratory", title: "Laboratory supervisor" },
  qcCore: { name: "Grace Tolentino", role: "qaqc", title: "QA/QC geologist", stage: "core_logging" },
  qcSampling: { name: "Rafael Ocampo", role: "qaqc", title: "QA/QC, sampling and custody", stage: "sampling_custody" },
  qcLab: { name: "Lorna Castillo", role: "qaqc", title: "QA/QC, laboratory data", stage: "laboratory_assays" },
};

const id = (key: PersonKey) => `${ACCOUNT_PREFIX}${key}`;
const nameOf = (key: PersonKey) => PEOPLE[key].name;

const LABORATORY = "Regional assay laboratory";
const PREPARATION = "Dry, crush to 70% passing 2 mm, split 1 kg, pulverise to 85% passing 75 µm";

// --- Small helpers -----------------------------------------------------------

const DAY_MS = 86_400_000;

/** A repeatable random sequence, so every load tells the same story. */
function random(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (lo: number, hi: number) => lo + next() * (hi - lo);
  const normal = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return { next, between, normal };
}
type Random = ReturnType<typeof random>;

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

function clock(now: number) {
  const at = (daysAgo: number) => new Date(now - daysAgo * DAY_MS).toISOString();
  const day = (daysAgo: number) => at(daysAgo).slice(0, 10);
  const tracked = (daysAgo: number, updatedDaysAgo = daysAgo) => ({
    created_at: at(daysAgo),
    updated_at: at(updatedDaysAgo),
    version: 1,
    deleted_at: null,
  });
  return { at, day, tracked };
}
type Clock = ReturnType<typeof clock>;

// --- The plan ----------------------------------------------------------------

type Style = "porphyry" | "epithermal";

type HolePlan = {
  name: string;
  plannedM: number;
  /** 0 for a hole not started. */
  drilledM: number;
  status: "planned" | "drilling" | "complete" | "logged";
  /** Days ago drilling started and stopped (a drilling hole stops "now" unless it stood down). */
  drill?: [number, number];
  /** Days ago logging started and last moved; defaults to a day behind the rig. */
  log?: [number, number];
  /** Logged (and sampled) to this depth; defaults to the whole hole once logged. */
  loggedToM?: number;
  /** Assigned geologist; null when nobody is assigned now. */
  geologist: PersonKey | null;
  /** Who logged it, when that isn't the assigned geologist. */
  worker?: PersonKey;
  rig: string;
  azimuth: number;
  dip: number;
  east: number;
  north: number;
  surveyed: boolean;
  richness: number;
  skipDuplicates?: boolean;
  fault?: [number, number];
  /** A run measured 0.12 m long (recovery over 100%) starting at this depth. */
  longRun?: number;
  urgent?: string;
  note?: string;
};

type DispatchPlan = {
  number: string;
  holes: string[];
  sender: PersonKey;
  /** Days ago it was handed to the laboratory; null while it is being put together. */
  handover: number | null;
  received?: number;
  results?: number;
  failedStandard?: boolean;
  contaminatedBlank?: boolean;
};

type ProjectPlan = {
  key: "mabini" | "bantay";
  name: string;
  commodity: string;
  location: string;
  prefix: string;
  rates: { standard: number; blank: number; duplicate: number };
  createdDaysAgo: number;
  style: Style;
  origin: { lat: number; lon: number };
  standards: [string, string];
  coreShed: string;
  holes: HolePlan[];
  dispatches: DispatchPlan[];
};

const MABINI: ProjectPlan = {
  key: "mabini",
  name: "Mabini Ridge Cu-Au, phase 2 drilling",
  commodity: "Copper-gold",
  location: "Northern Luzon, Philippines (synthetic prospect)",
  prefix: "MBR",
  rates: { standard: 25, blank: 25, duplicate: 20 },
  createdDaysAgo: 52,
  style: "porphyry",
  origin: { lat: 17.2153, lon: 120.7418 },
  standards: ["CRM CU-HG-1", "CRM CU-LG-2"],
  coreShed: "Core shed, Mabini camp",
  holes: [
    { name: "MBR25-001", plannedM: 450, drilledM: 462.4, status: "logged", drill: [44, 37], geologist: "g1", rig: "Rig 1", azimuth: 45, dip: -65, east: 0, north: 0, surveyed: true, richness: 1.0 },
    { name: "MBR25-002", plannedM: 400, drilledM: 385.0, status: "logged", drill: [41, 34], geologist: "g2", rig: "Rig 2", azimuth: 225, dip: -60, east: 160, north: 45, surveyed: true, richness: 0.75, note: "Stopped at 385.0 m, short of plan: bad ground in the fault zone." },
    { name: "MBR25-003", plannedM: 350, drilledM: 351.2, status: "logged", drill: [36, 30], geologist: "g1", rig: "Rig 1", azimuth: 45, dip: -70, east: -130, north: 125, surveyed: true, richness: 1.25 },
    { name: "MBR25-004", plannedM: 500, drilledM: 503.5, status: "logged", drill: [33, 24], geologist: "g3", rig: "Rig 2", azimuth: 45, dip: -60, east: 70, north: -165, surveyed: true, richness: 0.9, fault: [212, 236] },
    { name: "MBR25-005", plannedM: 420, drilledM: 418.6, status: "logged", drill: [29, 21], geologist: "g2", rig: "Rig 1", azimuth: 225, dip: -65, east: 270, north: 130, surveyed: true, richness: 0.55, longRun: 168 },
    { name: "MBR25-006", plannedM: 380, drilledM: 380.3, status: "complete", drill: [23, 15], log: [22, 0.4], loggedToM: 236, geologist: "g4", rig: "Rig 2", azimuth: 45, dip: -65, east: -250, north: -35, surveyed: true, richness: 1.1, skipDuplicates: true },
    { name: "MBR25-007", plannedM: 450, drilledM: 447.0, status: "complete", drill: [20, 10], log: [18, 1.1], loggedToM: 152, geologist: "g3", rig: "Rig 1", azimuth: 45, dip: -60, east: 35, north: 290, surveyed: true, richness: 0.8 },
    { name: "MBR25-008", plannedM: 480, drilledM: 312.4, status: "drilling", drill: [9, 0.09], loggedToM: 294, geologist: "g1", rig: "Rig 1", azimuth: 45, dip: -65, east: 150, north: -20, surveyed: true, richness: 1.3, longRun: 285 },
    { name: "MBR25-009", plannedM: 400, drilledM: 186.0, status: "drilling", drill: [6, 0.2], loggedToM: 171, geologist: "g2", rig: "Rig 2", azimuth: 225, dip: -60, east: -60, north: 250, surveyed: true, richness: 1.0, urgent: "Approaching the target fault at about 200 m. Geologist at the rig for every run until it is through." },
    { name: "MBR25-010", plannedM: 350, drilledM: 96.2, status: "drilling", drill: [14, 9], log: [13, 9.1], loggedToM: 90, geologist: null, worker: "g3", rig: "Rig 3", azimuth: 45, dip: -70, east: -300, north: 180, surveyed: true, richness: 0.6, note: "Rig 3 stood down at 96.2 m: rods stuck, waiting for a fishing tool. Noel moved to Bantay." },
    { name: "MBR25-011", plannedM: 450, drilledM: 0, status: "planned", geologist: "g1", rig: "Rig 1", azimuth: 45, dip: -65, east: 300, north: -140, surveyed: true, richness: 1 },
    { name: "MBR25-012", plannedM: 400, drilledM: 0, status: "planned", geologist: "g2", rig: "Rig 2", azimuth: 225, dip: -60, east: -180, north: 340, surveyed: true, richness: 1 },
    { name: "MBR25-013", plannedM: 500, drilledM: 0, status: "planned", geologist: null, rig: "Rig 1", azimuth: 45, dip: -60, east: 420, north: 60, surveyed: true, richness: 1 },
    { name: "MBR25-014", plannedM: 350, drilledM: 0, status: "planned", geologist: null, rig: "Rig 3", azimuth: 45, dip: -70, east: -420, north: -120, surveyed: false, richness: 1, note: "Pad not built yet; collar to be surveyed." },
  ],
  dispatches: [
    { number: "MBR-DSP-001", holes: ["MBR25-001"], sender: "g1", handover: 34, received: 32, results: 22 },
    { number: "MBR-DSP-002", holes: ["MBR25-002"], sender: "g1", handover: 30, received: 28, results: 20, contaminatedBlank: true },
    { number: "MBR-DSP-003", holes: ["MBR25-003"], sender: "g1", handover: 27, received: 25, results: 14, failedStandard: true },
    { number: "MBR-DSP-004", holes: ["MBR25-004"], sender: "g1", handover: 21, received: 19 },
    { number: "MBR-DSP-005", holes: ["MBR25-005"], sender: "g2", handover: 12, received: 10 },
    { number: "MBR-DSP-006", holes: ["MBR25-006", "MBR25-007"], sender: "g4", handover: 8, received: 6 },
    { number: "MBR-DSP-007", holes: ["MBR25-008", "MBR25-009", "MBR25-010"], sender: "g1", handover: 3 },
    { number: "MBR-DSP-008", holes: ["MBR25-006", "MBR25-007"], sender: "g4", handover: null },
  ],
};

const BANTAY: ProjectPlan = {
  key: "bantay",
  name: "Bantay epithermal Au, scout drilling",
  commodity: "Gold-silver",
  location: "Ilocos Sur, Philippines (synthetic prospect)",
  prefix: "BNT",
  rates: { standard: 20, blank: 20, duplicate: 20 },
  createdDaysAgo: 24,
  style: "epithermal",
  origin: { lat: 17.3721, lon: 120.5864 },
  standards: ["CRM AU-EP-3", "CRM AU-EP-3"],
  coreShed: "Core shed, Bantay camp",
  holes: [
    { name: "BNT25-001", plannedM: 200, drilledM: 212.3, status: "logged", drill: [18, 14], geologist: "g3", rig: "Rig 4", azimuth: 110, dip: -55, east: 0, north: 0, surveyed: true, richness: 1.0 },
    { name: "BNT25-002", plannedM: 150, drilledM: 151.4, status: "complete", drill: [12, 5], log: [11, 0.5], loggedToM: 90, geologist: "g4", rig: "Rig 4", azimuth: 110, dip: -55, east: -80, north: 110, surveyed: true, richness: 0.7 },
    { name: "BNT25-003", plannedM: 180, drilledM: 88.0, status: "drilling", drill: [4, 0.15], loggedToM: 76, geologist: "g3", rig: "Rig 4", azimuth: 110, dip: -60, east: 90, north: -120, surveyed: true, richness: 1.2 },
    { name: "BNT25-004", plannedM: 200, drilledM: 0, status: "planned", geologist: "g4", rig: "Rig 4", azimuth: 110, dip: -55, east: -160, north: 220, surveyed: true, richness: 1 },
    { name: "BNT25-005", plannedM: 160, drilledM: 0, status: "planned", geologist: null, rig: "Rig 4", azimuth: 290, dip: -60, east: 200, north: -240, surveyed: true, richness: 1 },
    { name: "BNT25-006", plannedM: 220, drilledM: 0, status: "planned", geologist: null, rig: "Rig 4", azimuth: 110, dip: -50, east: -260, north: 330, surveyed: false, richness: 1 },
  ],
  dispatches: [{ number: "BNT-DSP-001", holes: ["BNT25-001"], sender: "g3", handover: 6, received: 4 }],
};

// --- Geology -----------------------------------------------------------------

type Grades = Record<string, number>;

type Interval = {
  from: number;
  to: number;
  lithology: string;
  alteration: string | null;
  intensity: string | null;
  mineral: string | null;
  style: string | null;
  percent: number | null;
  weathering: string | null;
  structure: string | null;
  notes: string;
  grades: Grades;
  /** Core recovery and RQD ranges for runs in this interval. */
  ground: "soil" | "weathered" | "oxide" | "fresh" | "fault";
};

type Unit = Omit<Interval, "from" | "to">;

function porphyryUnit(r: Random, rich: number): Unit {
  const x = r.next();
  const u = (fields: Partial<Unit> & Pick<Unit, "lithology" | "notes" | "grades">): Unit => ({
    alteration: null,
    intensity: null,
    mineral: null,
    style: null,
    percent: null,
    weathering: "FR",
    structure: r.next() < 0.18 ? (r.next() < 0.5 ? "VEIN" : "FRAC") : null,
    ground: "fresh",
    ...fields,
  });
  if (x < 0.08)
    return u({ lithology: "AND", alteration: "CHL", intensity: "1", structure: "CONT", notes: "Late andesite dyke, chilled margins, unmineralised.", grades: { Cu: 0.008, Au: 0.01, Mo: 3 } });
  if (x < 0.4)
    return u({ lithology: "PORP", alteration: "POT", intensity: "3", mineral: r.next() < 0.3 ? "BN" : "CPY", style: "STK", percent: round(r.between(1.2, 3), 1), notes: "Quartz-diorite porphyry. A- and B-type quartz veinlets with chalcopyrite and bornite, secondary biotite.", grades: { Cu: 0.72 * rich, Au: 0.48 * rich, Mo: 120 } });
  if (x < 0.62)
    return u({ lithology: "DIO", alteration: "POT", intensity: "2", mineral: "CPY", style: "DISS", percent: round(r.between(0.5, 1.5), 1), notes: "Biotite-magnetite alteration, disseminated chalcopyrite.", grades: { Cu: 0.38 * rich, Au: 0.24 * rich, Mo: 60 } });
  if (x < 0.8)
    return u({ lithology: "DIO", alteration: "PHY", intensity: "3", mineral: "PY", style: "DISS", percent: round(r.between(3, 6), 1), structure: "VEIN", notes: "Quartz-sericite-pyrite overprint, D-veins to 2 cm.", grades: { Cu: 0.11, Au: 0.06, Mo: 180 } });
  if (x < 0.9)
    return u({ lithology: "BX", alteration: "PHY", intensity: "3", mineral: "CPY", style: "BXH", percent: round(r.between(1.5, 3), 1), notes: "Hydrothermal breccia, chalcopyrite and pyrite in the matrix.", grades: { Cu: 0.85 * rich, Au: 0.62 * rich, Mo: 90 } });
  return u({ lithology: "AND", alteration: "PROP", intensity: "2", mineral: "PY", style: "DISS", percent: 1, notes: "Andesite wall rock, chlorite-epidote, weak pyrite.", grades: { Cu: 0.04, Au: 0.02, Mo: 8 } });
}

function epithermalUnit(r: Random, rich: number): Unit {
  const x = r.next();
  const base = { weathering: "FR", ground: "fresh" as const, structure: null, percent: null };
  if (x < 0.22)
    return { ...base, lithology: "QV", alteration: "SIL", intensity: "4", mineral: r.next() < 0.15 ? "AU" : "PY", style: "VNL", percent: 1, structure: "VEIN", notes: "Banded crustiform quartz-adularia vein, ginguro bands, fine pyrite.", grades: { Au: 6.5 * rich, Ag: 42 * rich } };
  if (x < 0.5)
    return { ...base, lithology: "TUF", alteration: "ARG", intensity: "3", mineral: "PY", style: "DISS", notes: "Clay-altered lapilli tuff, vein halo, quartz stringers.", grades: { Au: 0.9 * rich, Ag: 8 * rich } };
  if (x < 0.62)
    return { ...base, lithology: "BX", alteration: "SIL", intensity: "3", mineral: "SPH", style: "BXH", notes: "Silicified hydrothermal breccia, sphalerite and galena in the matrix.", grades: { Au: 2.4 * rich, Ag: 28 * rich } };
  return { ...base, lithology: r.next() < 0.5 ? "AND" : "TUF", alteration: "PROP", intensity: "2", mineral: "PY", style: "DISS", notes: "Propylitic andesite and tuff, chlorite and calcite.", grades: { Au: 0.06, Ag: 1.2 } };
}

/** The hole's geology from the collar down to the drilled depth. */
function column(plan: HolePlan, style: Style, r: Random): Interval[] {
  const depth = plan.drilledM;
  const out: Interval[] = [];
  let from = 0;
  const push = (to: number, unit: Unit) => {
    const end = Math.min(round(to, 1), depth);
    if (end <= from) return;
    out.push({ from, to: end, ...unit });
    from = end;
  };
  const blank = { alteration: null, intensity: null, mineral: null, style: null, percent: null, structure: null };
  const porphyry = style === "porphyry";
  push(r.between(1.5, 3.5), { ...blank, lithology: "OVB", weathering: "CW", ground: "soil", notes: "Soil and colluvium.", grades: porphyry ? { Cu: 0.01, Au: 0.02, Mo: 4 } : { Au: 0.02, Ag: 0.5 } });
  push(r.between(16, 28), { ...blank, lithology: porphyry ? "DIO" : "AND", alteration: "ARG", intensity: "3", weathering: "HW", ground: "weathered", notes: porphyry ? "Leached cap: limonite and goethite boxwork after sulphides." : "Oxidised andesite, clay and iron oxides.", grades: porphyry ? { Cu: 0.04, Au: 0.07, Mo: 12 } : { Au: 0.15, Ag: 2 } });
  if (porphyry)
    push(from + r.between(10, 22), { ...blank, lithology: "DIO", alteration: "ARG", intensity: "2", mineral: "CC", style: "VNL", percent: round(r.between(1, 3), 1), weathering: "MW", ground: "oxide", notes: "Supergene enrichment: chalcocite coating pyrite.", grades: { Cu: 1.05 * plan.richness, Au: 0.3 * plan.richness, Mo: 40 } });
  while (from < depth) {
    const fault = plan.fault;
    if (fault && from >= fault[0] - 0.05 && from < fault[1]) {
      push(fault[1], { ...blank, lithology: "BX", alteration: "PHY", intensity: "2", mineral: "PY", style: "DISS", percent: 2, weathering: "FR", structure: "FLT", ground: "fault", notes: "Fault zone: clay gouge and broken core, poor recovery.", grades: { Cu: 0.14, Au: 0.05, Mo: 30 } });
      continue;
    }
    const unit = porphyry ? porphyryUnit(r, plan.richness) : epithermalUnit(r, plan.richness);
    let length = unit.lithology === "AND" && unit.alteration === "CHL" ? r.between(1, 4) : r.between(4, 13);
    if (unit.lithology === "QV") length = r.between(0.8, 3.5);
    if (fault && from < fault[0] && from + length > fault[0]) length = fault[0] - from;
    push(from + length, unit);
  }
  return out;
}

const GROUND: Record<Interval["ground"], { recovery: [number, number]; rqd: [number, number] }> = {
  soil: { recovery: [0.55, 0.75], rqd: [0, 0.1] },
  weathered: { recovery: [0.72, 0.88], rqd: [0.12, 0.38] },
  oxide: { recovery: [0.85, 0.95], rqd: [0.35, 0.6] },
  fresh: { recovery: [0.96, 1.0], rqd: [0.7, 0.95] },
  fault: { recovery: [0.44, 0.62], rqd: [0.02, 0.18] },
};

const ANALYTES: Record<Style, { analyte: string; unit: string; places: number; detection: number }[]> = {
  porphyry: [
    { analyte: "Cu", unit: "%", places: 3, detection: 0.001 },
    { analyte: "Au", unit: "g/t", places: 3, detection: 0.005 },
    { analyte: "Mo", unit: "ppm", places: 0, detection: 1 },
  ],
  epithermal: [
    { analyte: "Au", unit: "g/t", places: 3, detection: 0.005 },
    { analyte: "Ag", unit: "g/t", places: 1, detection: 0.5 },
  ],
};

/**
 * The certified values and blank limits (illustrative, not from a real
 * certificate). The laboratory QA/QC check scores the controls against them.
 */
const QC_REFERENCES: { kind: "standard" | "blank"; reference: string; analyte: string; unit: string; expected: number | null; sd: number | null; max: number | null }[] = [
  { kind: "standard", reference: "CRM CU-HG-1", analyte: "Cu", unit: "%", expected: 0.852, sd: 0.021, max: null },
  { kind: "standard", reference: "CRM CU-HG-1", analyte: "Au", unit: "g/t", expected: 0.61, sd: 0.028, max: null },
  { kind: "standard", reference: "CRM CU-HG-1", analyte: "Mo", unit: "ppm", expected: 145, sd: 8, max: null },
  { kind: "standard", reference: "CRM CU-LG-2", analyte: "Cu", unit: "%", expected: 0.312, sd: 0.009, max: null },
  { kind: "standard", reference: "CRM CU-LG-2", analyte: "Au", unit: "g/t", expected: 0.18, sd: 0.011, max: null },
  { kind: "standard", reference: "CRM CU-LG-2", analyte: "Mo", unit: "ppm", expected: 62, sd: 4, max: null },
  { kind: "standard", reference: "CRM AU-EP-3", analyte: "Au", unit: "g/t", expected: 5.21, sd: 0.19, max: null },
  { kind: "standard", reference: "CRM AU-EP-3", analyte: "Ag", unit: "g/t", expected: 38.5, sd: 1.6, max: null },
  { kind: "blank", reference: "Coarse blank", analyte: "Cu", unit: "%", expected: null, sd: null, max: 0.003 },
  { kind: "blank", reference: "Coarse blank", analyte: "Au", unit: "g/t", expected: null, sd: null, max: 0.015 },
  { kind: "blank", reference: "Coarse blank", analyte: "Mo", unit: "ppm", expected: null, sd: null, max: 3 },
  { kind: "blank", reference: "Coarse blank", analyte: "Ag", unit: "g/t", expected: null, sd: null, max: 1 },
];

// --- Building one project ------------------------------------------------------

type BuiltSample = {
  id: string;
  number: string;
  type: "primary" | "standard" | "blank" | "duplicate";
  hole: string;
  parentId: string | null;
  standardRef: string | null;
  grades: Grades;
  /** Days ago it was recorded. */
  age: number;
  by: PersonKey;
};

type Facts = {
  projectId: string;
  holeIds: Map<string, string>;
  failedStandard: Map<string, string>;
  contaminatedBlank: Map<string, string>;
  summary: ShowcaseSummary["projects"][number];
};

function buildProject(rows: RowBuffer, org: string, plan: ProjectPlan, c: Clock, seed: number): Facts {
  const r = random(seed);
  const projectId = randomUUID();
  const project: Row = {
    id: projectId,
    organization_id: org,
    created_by: id("g1"),
    name: plan.name,
    commodity: plan.commodity,
    location: plan.location,
    coordinate_system: "WGS84",
    sample_prefix: plan.prefix,
    next_sample_number: 1,
    qc_standard_every_n: plan.rates.standard,
    qc_blank_every_n: plan.rates.blank,
    qc_duplicate_every_n: plan.rates.duplicate,
    photo_max_mb: 1.5,
    ...c.tracked(plan.createdDaysAgo, 2),
  };
  rows.add("projects", project);
  for (const code of STARTER_CODES)
    rows.add("code_library", {
      id: randomUUID(),
      organization_id: org,
      project_id: projectId,
      created_by: id("g1"),
      category: code.category,
      code: code.code,
      description: code.description,
      hidden: false,
      ...c.tracked(plan.createdDaysAgo),
    });

  let sampleNo = 1;
  const nextNumber = () => `${plan.prefix}-${String(sampleNo++).padStart(5, "0")}`;
  const holeIds = new Map<string, string>();
  const samples: BuiltSample[] = [];
  let intervalCount = 0;
  let runCount = 0;
  // Primary samples so far in the project; the QC rates count across holes.
  let count = 0;

  for (const hole of plan.holes) {
    const holeId = randomUUID();
    holeIds.set(hole.name, holeId);
    const worker = hole.worker ?? hole.geologist ?? "g1";
    const base = { organization_id: org, created_by: id(worker), project_id: projectId };
    const [drillStart, drillEnd] = hole.drill ?? [0, 0];
    const loggedTo = hole.loggedToM ?? hole.drilledM;
    const [logStart, logEnd] = hole.log ?? [drillStart - 1, hole.status === "logged" ? drillEnd - 2 : Math.max(0.05, drillEnd)];
    // Days ago the rig reached a depth, and the geologist logged it.
    const drilledAt = (depth: number) => drillStart - (depth / Math.max(1, hole.drilledM)) * (drillStart - drillEnd);
    const loggedAt = (depth: number) =>
      Math.max(0.02, Math.min(logStart - (depth / Math.max(1, loggedTo)) * (logStart - logEnd), drilledAt(depth) - 0.08));
    const plannedAt = Math.min(plan.createdDaysAgo - 1, (drillStart || 6) + 8);
    const lastTouched = hole.status === "planned" ? plannedAt : loggedAt(loggedTo);

    const lat = plan.origin.lat + hole.north / 111_320;
    const lon = plan.origin.lon + hole.east / (111_320 * Math.cos((plan.origin.lat * Math.PI) / 180));
    rows.add("drillholes", {
      id: holeId,
      ...base,
      hole_id: hole.name,
      collar_source: hole.surveyed ? "gps" : null,
      collar_latitude: hole.surveyed ? round(lat, 6) : null,
      collar_longitude: hole.surveyed ? round(lon, 6) : null,
      collar_accuracy_m: hole.surveyed ? round(r.between(2.5, 4.5), 1) : null,
      collar_captured_at: hole.surveyed ? c.at(plannedAt - 0.5) : null,
      planned_azimuth_deg: hole.azimuth,
      planned_inclination_deg: hole.dip,
      planned_depth_m: hole.plannedM,
      actual_final_depth_m: hole.status === "complete" || hole.status === "logged" ? hole.drilledM : null,
      started_at: hole.drill ? c.day(drillStart) : null,
      completed_at: hole.status === "complete" || hole.status === "logged" ? c.day(drillEnd) : null,
      status: hole.status,
      contractor: `${hole.rig}, contract diamond drilling`,
      drill_type: "Diamond core",
      diameter: plan.style === "porphyry" && hole.drilledM > 300 ? "HQ to 300 m, then NQ" : "HQ",
      note: hole.note ?? null,
      priority: hole.urgent ? "urgent" : "normal",
      priority_note: hole.urgent ?? null,
      ...c.tracked(plannedAt, lastTouched),
    });

    const history: [string, number][] = [["planned", plannedAt]];
    if (hole.drill) history.push(["drilling", drillStart]);
    if (hole.status === "complete" || hole.status === "logged") history.push(["complete", drillEnd]);
    if (hole.status === "logged") history.push(["logged", logEnd]);
    for (const [status, daysAgo] of history)
      rows.add("drillhole_status_history", {
        id: randomUUID(),
        organization_id: org,
        project_id: projectId,
        drillhole_id: holeId,
        status,
        changed_at: c.at(daysAgo),
      });

    if (hole.geologist)
      rows.add("hole_assignments", {
        id: randomUUID(),
        drillhole_id: holeId,
        user_id: id(hole.geologist),
        assigned_by: id("pm"),
        assigned_at: c.at(Math.max(plannedAt - 1, (drillStart || 3) + 2)),
      });

    if (hole.drilledM <= 0) continue;
    const geology = column(hole, plan.style, r);
    const at = (depth: number) => geology.find((i) => depth >= i.from && depth < i.to) ?? geology[geology.length - 1];

    // Runs are 3 m core barrels; boxes hold 4.5 m of HQ core (three 1.5 m rows).
    for (let from = 0; from < hole.drilledM; from += 3) {
      const to = round(Math.min(from + 3, hole.drilledM), 1);
      const ground = GROUND[at((from + to) / 2).ground];
      const length = to - from;
      const recorded = Math.max(0.01, drilledAt(to) - 0.05);
      rows.add("core_runs", {
        id: randomUUID(),
        ...base,
        drillhole_id: holeId,
        from_m: from,
        to_m: to,
        recovered_m: from === hole.longRun ? round(length + 0.12, 2) : round(length * r.between(...ground.recovery), 2),
        rqd_pieces_m: round(length * r.between(...ground.rqd), 2),
        ...c.tracked(recorded),
      });
      runCount++;
    }
    for (let box = 0; box * 4.5 < hole.drilledM; box++) {
      const from = round(box * 4.5, 1);
      const to = round(Math.min(from + 4.5, hole.drilledM), 1);
      rows.add("core_boxes", {
        id: randomUUID(),
        ...base,
        drillhole_id: holeId,
        box_number: box + 1,
        from_m: from,
        to_m: to,
        note: null,
        ...c.tracked(Math.max(0.01, drilledAt(to) - 0.05)),
      });
    }

    for (const interval of geology) {
      if (interval.from >= loggedTo) break;
      const to = Math.min(interval.to, loggedTo);
      rows.add("log_intervals", {
        id: randomUUID(),
        ...base,
        drillhole_id: holeId,
        from_m: interval.from,
        to_m: to,
        lithology: interval.lithology,
        alteration_type: interval.alteration,
        alteration_intensity: interval.intensity,
        mineral: interval.mineral,
        mineral_style: interval.style,
        mineral_percent: interval.percent,
        weathering: interval.weathering,
        structure_type: interval.structure,
        notes: interval.notes,
        ...c.tracked(loggedAt(to)),
      });
      intervalCount++;
    }

    // Continuous 2 m samples below the soil, with controls at the project's
    // rates, inserted in the sequence as the geologist would.
    const start = Math.ceil(geology[0].to);
    for (let from = start; from < loggedTo - 0.2; from += 2) {
      const to = round(Math.min(from + 2, loggedTo), 1);
      const age = Math.max(0.01, loggedAt(to) - 0.12);
      const g = at((from + to) / 2).grades;
      const primary: BuiltSample = {
        id: randomUUID(),
        number: nextNumber(),
        type: "primary",
        hole: hole.name,
        parentId: null,
        standardRef: null,
        grades: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v * Math.exp(0.35 * r.normal())])),
        age,
        by: worker,
      };
      samples.push(primary);
      addSampleRow(rows, base, holeId, primary, from, to, c);
      count++;
      const control = (type: BuiltSample["type"], extra: Partial<BuiltSample>, depths: [number, number] | null) => {
        const s: BuiltSample = { id: randomUUID(), number: nextNumber(), type, hole: hole.name, parentId: null, standardRef: null, grades: {}, age, by: worker, ...extra };
        samples.push(s);
        addSampleRow(rows, base, holeId, s, depths?.[0] ?? null, depths?.[1] ?? null, c);
      };
      if (count % plan.rates.blank === Math.floor(plan.rates.blank / 2)) control("blank", {}, null);
      if (count % plan.rates.standard === 0) control("standard", { standardRef: plan.standards[(count / plan.rates.standard) % 2] }, null);
      if (!hole.skipDuplicates && count % plan.rates.duplicate === 0)
        control("duplicate", { parentId: primary.id, grades: primary.grades }, [from, to]);
    }
  }

  const { failedStandard, contaminatedBlank, dispatched } = addChain(rows, org, projectId, plan, samples, c, r);
  // Samples not yet in a dispatch: bagged once they are two days old, so the
  // newest are still waiting to be bagged.
  for (const s of samples) {
    if (dispatched.has(s.id)) continue;
    const status = s.age > 2 ? "bagged" : "created";
    setSampleStatus(s.id, status);
    if (status === "bagged") custody(rows, org, projectId, s, "bagged", s.age - 0.5, s.by, c, { location: plan.coreShed });
  }

  project.next_sample_number = sampleNo;
  return {
    projectId,
    holeIds,
    failedStandard,
    contaminatedBlank,
    summary: { name: plan.name, holes: plan.holes.length, intervals: intervalCount, runs: runCount, samples: samples.length },
  };
}

/** Each sample's row, so its status can be set once custody is known. */
const sampleRows = new Map<string, Row>();

function addSampleRow(rows: RowBuffer, base: Row, holeId: string, s: BuiltSample, from: number | null, to: number | null, c: Clock) {
  const row: Row = {
    id: s.id,
    ...base,
    created_by: id(s.by),
    drillhole_id: holeId,
    sample_number: s.number,
    sample_type: s.type,
    from_m: from,
    to_m: to,
    standard_ref: s.standardRef,
    parent_sample_id: s.parentId,
    note: null,
    status: "created",
    ...c.tracked(s.age),
  };
  sampleRows.set(s.id, row);
  rows.add("samples", row);
}

function setSampleStatus(sampleId: string, status: string) {
  const row = sampleRows.get(sampleId);
  if (row) row.status = status;
}

function custody(
  rows: RowBuffer,
  org: string,
  projectId: string,
  s: BuiltSample,
  type: "bagged" | "dispatched" | "received",
  daysAgo: number,
  by: PersonKey,
  c: Clock,
  extra: Row = {},
) {
  rows.add("custody_events", {
    id: randomUUID(),
    organization_id: org,
    project_id: projectId,
    created_by: id(by),
    sample_id: s.id,
    event_type: type,
    occurred_at: c.at(daysAgo),
    handled_by: nameOf(by),
    location: null,
    recipient: null,
    note: null,
    dispatch_id: null,
    corrects_event_id: null,
    created_at: c.at(daysAgo),
    ...extra,
  });
}

/** Bagging, dispatches, receipt at the laboratory and results. */
function addChain(rows: RowBuffer, org: string, projectId: string, plan: ProjectPlan, samples: BuiltSample[], c: Clock, r: Random) {
  const failedStandard = new Map<string, string>();
  const contaminatedBlank = new Map<string, string>();
  const dispatched = new Set<string>();
  const analytes = ANALYTES[plan.style];
  const references = new Map(QC_REFERENCES.map((q) => [`${q.reference}:${q.analyte}`, q]));

  for (const d of plan.dispatches) {
    const open = d.handover === null;
    // A batch takes what was bagged before it left; an open one, what is bagged so far.
    const cutoff = open ? 2 : (d.handover as number) + 0.4;
    const members = samples.filter((s) => d.holes.includes(s.hole) && s.age > cutoff && !dispatched.has(s.id));
    if (members.length === 0) continue;
    const dispatchId = randomUUID();
    const createdAt = open ? 1 : (d.handover as number) + 0.3;
    rows.add("dispatches", {
      id: dispatchId,
      organization_id: org,
      project_id: projectId,
      created_by: id(d.sender),
      dispatch_number: d.number,
      laboratory: LABORATORY,
      preparation_request: PREPARATION,
      handover_at: open ? null : c.day(d.handover as number),
      status: open ? "open" : "dispatched",
      note: open ? "Adding the rest of the hole as it is logged." : null,
      results_returned_at: d.results === undefined ? null : c.at(d.results),
      created_at: c.at(createdAt),
      updated_at: c.at(d.results ?? d.handover ?? 1),
      version: open ? 1 : 2,
      deleted_at: null,
    });
    for (const s of members) {
      dispatched.add(s.id);
      rows.add("dispatch_samples", {
        id: randomUUID(),
        organization_id: org,
        project_id: projectId,
        created_by: id(d.sender),
        dispatch_id: dispatchId,
        sample_id: s.id,
        created_at: c.at(createdAt),
        updated_at: c.at(createdAt),
        version: 1,
        deleted_at: null,
      });
      const bagged = Math.max(createdAt + 0.1, s.age - 0.5);
      setSampleStatus(s.id, open ? "bagged" : "dispatched");
      custody(rows, org, projectId, s, "bagged", bagged, s.by, c, { location: plan.coreShed });
      if (open) continue;
      custody(rows, org, projectId, s, "dispatched", d.handover as number, d.sender, c, { recipient: LABORATORY, dispatch_id: dispatchId });
      if (d.received !== undefined)
        custody(rows, org, projectId, s, "received", d.received, "lab", c, { dispatch_id: dispatchId });
    }
    if (d.results === undefined) continue;

    let failedDone = !d.failedStandard;
    let blankDone = !d.contaminatedBlank;
    for (const s of members) {
      for (const a of analytes) {
        let value: number | null;
        if (s.type === "blank") {
          value = null;
          if (!blankDone && a.analyte === "Cu") {
            value = 0.009;
            blankDone = true;
            contaminatedBlank.set(d.number, s.number);
          }
        } else if (s.type === "standard") {
          const ref = references.get(`${s.standardRef}:${a.analyte}`);
          value = ref?.expected != null ? ref.expected + 0.8 * r.normal() * (ref.sd ?? 0) : null;
          if (!failedDone && a.analyte === "Cu" && ref?.expected != null && ref.sd != null) {
            value = ref.expected + 3.8 * ref.sd;
            failedDone = true;
            failedStandard.set(d.number, `${s.number} (${s.standardRef})`);
          }
        } else {
          const grade = s.grades[a.analyte] ?? 0;
          value = s.type === "duplicate" ? grade * (1 + 0.06 * r.normal()) : grade;
        }
        const below = value === null || value < a.detection;
        rows.add("assay_results", {
          id: randomUUID(),
          organization_id: org,
          dispatch_id: dispatchId,
          sample_id: s.id,
          analyte: a.analyte,
          value: below ? null : round(value as number, a.places),
          unit: a.unit,
          below_detection: below,
          entered_by: id("lab"),
          created_at: c.at(d.results + 0.05),
        });
      }
    }
  }
  return { failedStandard, contaminatedBlank, dispatched };
}

// --- QA/QC decisions -----------------------------------------------------------

function decide(rows: RowBuffer, org: string, drillholeId: string | undefined, decision: "accept" | "hold" | "reject", stage: Stage, daysAgo: number, note: string, c: Clock) {
  if (!drillholeId) return;
  const by: PersonKey = stage === "core_logging" ? "qcCore" : stage === "sampling_custody" ? "qcSampling" : "qcLab";
  rows.add("qaqc_review_decisions", {
    id: randomUUID(),
    organization_id: org,
    drillhole_id: drillholeId,
    decision,
    stage,
    note,
    decided_by: id(by),
    decided_at: c.at(daysAgo),
  });
}

function mabiniDecisions(rows: RowBuffer, org: string, f: Facts, c: Clock) {
  const hole = (name: string) => f.holeIds.get(name);
  const logged = "Intervals, runs and recovery checked against the driller's depth blocks and the box photos.";
  decide(rows, org, hole("MBR25-001"), "accept", "core_logging", 33, logged, c);
  decide(rows, org, hole("MBR25-001"), "accept", "sampling_custody", 33.5, "Controls at the project rates; custody complete to the laboratory.", c);
  decide(rows, org, hole("MBR25-001"), "accept", "laboratory_assays", 21, "Standards within 2 SD, blanks below the limit, duplicates within 10%.", c);

  decide(rows, org, hole("MBR25-002"), "accept", "core_logging", 31, logged, c);
  decide(rows, org, hole("MBR25-002"), "accept", "sampling_custody", 29.5, "Controls at the project rates; custody complete to the laboratory.", c);
  const blank = f.contaminatedBlank.get("MBR-DSP-002") ?? "the batch blank";
  decide(rows, org, hole("MBR25-002"), "hold", "laboratory_assays", 19, `Blank ${blank} returned 0.009% Cu against a 0.003% limit. Laboratory asked to re-assay the ten samples after it before the batch is released.`, c);

  decide(rows, org, hole("MBR25-003"), "accept", "core_logging", 27.5, logged, c);
  decide(rows, org, hole("MBR25-003"), "accept", "sampling_custody", 26.5, "Controls at the project rates; custody complete to the laboratory.", c);
  const standard = f.failedStandard.get("MBR-DSP-003") ?? "the batch standard";
  decide(rows, org, hole("MBR25-003"), "hold", "laboratory_assays", 13, `Standard ${standard} reads 3.8 SD high for Cu. Re-assay of the surrounding samples requested; hold until it is back.`, c);

  decide(rows, org, hole("MBR25-004"), "reject", "core_logging", 21.5, "Runs from 212 to 236 m recorded at 44 to 62% recovery, and the fault zone is not in the log. Re-measure boxes 48 to 53 and re-log the interval before sampling is accepted.", c);

  decide(rows, org, hole("MBR25-005"), "hold", "core_logging", 19.5, "Box 37 to 41 depth blocks disagree with the run sheet by 0.4 m. Check with the driller.", c);
  decide(rows, org, hole("MBR25-005"), "accept", "core_logging", 17, "Driller confirmed a misplaced depth block at 171 m; logging corrected. Accepted.", c);
  const run = hole("MBR25-005");
  if (run)
    rows.add("qaqc_exception_resolutions", {
      id: randomUUID(),
      organization_id: org,
      exception_key: `recovery_over_100:${run}:168-171`,
      reason: "Driller confirmed the depth block at 171 m was placed 0.12 m high. Recovery within tolerance.",
      resolved_by: id("qcCore"),
      resolved_at: c.at(17.1),
      drillhole_id: run,
      summary: "MBR25-005: recovery over 100% at 168–171 m",
      evidence: null,
    });
}

function bantayDecisions(rows: RowBuffer, org: string, f: Facts, c: Clock) {
  decide(rows, org, f.holeIds.get("BNT25-001"), "accept", "core_logging", 11, "Vein intervals, recovery and structure logged consistently with the photos.", c);
}

// --- People and phones ---------------------------------------------------------

async function upsertTeam(db: Db): Promise<void> {
  await db.organization.upsert({
    where: { id: SHOWCASE_TEAM_ID },
    create: { id: SHOWCASE_TEAM_ID, name: SHOWCASE_TEAM_NAME },
    update: { name: SHOWCASE_TEAM_NAME },
  });
  for (const [key, p] of Object.entries(PEOPLE) as [PersonKey, (typeof PEOPLE)[PersonKey]][]) {
    const fields = {
      name: p.name,
      // Reserved domain (RFC 2606): never a real mailbox.
      email: `${p.name.toLowerCase().replace(/\s+/g, ".")}@showcase.demo.invalid`,
      role: p.role,
      title: p.title,
      qaqcStage: p.stage ?? null,
      organizationId: SHOWCASE_TEAM_ID,
      emailVerified: false,
    };
    await db.user.upsert({ where: { id: id(key) }, create: { id: id(key), ...fields }, update: fields });
  }
}

function addDevices(rows: RowBuffer, c: Clock) {
  const phones: [PersonKey, string, number, number][] = [
    ["g1", "Samsung Galaxy XCover7", 60, 0.03],
    ["g1", "Samsung Galaxy A14 (old phone)", 90, 33],
    ["g2", "Samsung Galaxy A55", 50, 0.15],
    ["g3", "Xiaomi Redmi Note 13", 50, 1.2],
    ["g4", "Samsung Galaxy A35", 30, 0.4],
  ];
  for (const [owner, name, firstDaysAgo, lastSeen] of phones)
    rows.add("devices", {
      id: randomUUID(),
      organization_id: SHOWCASE_TEAM_ID,
      user_id: id(owner),
      name,
      platform: "android",
      app_version: "0.1.1",
      created_at: c.at(firstDaysAgo),
      last_seen_at: c.at(lastSeen),
      revoked_at: null,
    });
}

function addQcReferences(rows: RowBuffer, c: Clock) {
  for (const q of QC_REFERENCES)
    rows.add("qc_reference_values", {
      id: randomUUID(),
      organization_id: SHOWCASE_TEAM_ID,
      kind: q.kind,
      reference: q.reference,
      analyte: q.analyte,
      unit: q.unit,
      expected_value: q.expected,
      standard_deviation: q.sd,
      max_value: q.max,
      created_by: id("qcLab"),
      created_at: c.at(50),
      updated_at: c.at(50),
    });
}

// --- Load and remove -----------------------------------------------------------

export type ShowcaseSummary = {
  team: string;
  people: number;
  projects: { name: string; holes: number; intervals: number; runs: number; samples: number }[];
};

async function removeContents(db: Db): Promise<void> {
  const projects = await db.project.findMany({
    where: { organizationId: SHOWCASE_TEAM_ID },
    select: { name: true },
  });
  await removeDemoProjects(db, SHOWCASE_TEAM_ID, projects.map((p) => p.name));
  await db.$executeRawUnsafe(`DELETE FROM devices WHERE organization_id = $1`, SHOWCASE_TEAM_ID);
  await db.$executeRawUnsafe(`DELETE FROM qc_reference_values WHERE organization_id = $1`, SHOWCASE_TEAM_ID);
  await db.$executeRawUnsafe(`DELETE FROM qaqc_exception_resolutions WHERE organization_id = $1`, SHOWCASE_TEAM_ID);
}

/** Every row of the showcase team, in memory, dated back from `now`. */
export function buildShowcaseRows(now: number): { rows: RowBuffer; summary: ShowcaseSummary } {
  const c = clock(now);
  sampleRows.clear();
  const rows = new RowBuffer();
  const mabini = buildProject(rows, SHOWCASE_TEAM_ID, MABINI, c, 20260927);
  const bantay = buildProject(rows, SHOWCASE_TEAM_ID, BANTAY, c, 20261004);
  mabiniDecisions(rows, SHOWCASE_TEAM_ID, mabini, c);
  bantayDecisions(rows, SHOWCASE_TEAM_ID, bantay, c);
  addDevices(rows, c);
  addQcReferences(rows, c);
  return {
    rows,
    summary: {
      team: SHOWCASE_TEAM_NAME,
      people: Object.keys(PEOPLE).length,
      projects: [mabini.summary, bantay.summary],
    },
  };
}

/** Builds the showcase team, replacing everything in it from an earlier load. */
export async function loadShowcaseTeam(prisma: PrismaClient, now = Date.now()): Promise<ShowcaseSummary> {
  const { rows, summary } = buildShowcaseRows(now);
  await prisma.$transaction(
    async (tx) => {
      await upsertTeam(tx);
      await removeContents(tx);
      await rows.flush(tx);
    },
    { timeout: 180_000, maxWait: 10_000 },
  );
  return summary;
}

/** Removes the showcase team, its people and everything recorded in it. */
export async function removeShowcaseTeam(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await removeContents(tx);
      await tx.user.deleteMany({ where: { id: { startsWith: ACCOUNT_PREFIX }, organizationId: SHOWCASE_TEAM_ID } });
      await tx.organization.deleteMany({ where: { id: SHOWCASE_TEAM_ID } });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}
