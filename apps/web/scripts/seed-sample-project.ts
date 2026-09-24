// Puts the Alberta sample project into one account, so a phone or the web app
// signed in as that account shows realistic work (for demos and screenshots).
//
//   npm run sample:seed -- geologist1@corechain.test
//
// What is official: the six drillholes (names, collar coordinates, drill type,
// final depths, drill dates) and the 27 logged intervals come from the Alberta
// Geological Survey's Digital Data 2024-0022 (apps/web/data/demo). What is
// ILLUSTRATIVE, made up here only so every feature has something to show: the
// core boxes and runs (cut from the depths of the official intervals), and the
// samples, including the QC samples. None of it is real assay or custody data.
// Run it again and it replaces its own earlier copy.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

// Run from apps/web (the npm script does).
const DATA = resolve(process.cwd(), "data/demo/alberta-dig-2024-0022/curated");
const PROJECT_NAME = "Alberta sample project";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])),
  );
}

const value = (raw: string | undefined) =>
  raw === undefined || raw === "" || raw === "-9999" ? null : raw;
const number = (raw: string | undefined) => {
  const v = value(raw);
  return v === null ? null : Number(v);
};

const ENUMS: Record<string, Record<string, string>> = {
  drillholes: { status: "DrillholeStatus", collar_source: "CollarSource" },
  drillhole_status_history: { status: "DrillholeStatus" },
  samples: { sample_type: "SampleType", status: "SampleStatus" },
};

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npm run sample:seed -- <email>");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("No account with that email.");
    // The account's team when it is on one (E11-1), else its personal
    // workspace: the same rule the sync streams and the team pages use, so the
    // project reaches the team's phones and the team overview.
    const org = user.organizationId ?? user.id;
    const team = user.organizationId
      ? await prisma.organization.findUnique({ where: { id: user.organizationId } })
      : null;
    console.log(
      team ? `Seeding into team "${team.name}".` : "Seeding into the account's personal workspace (not on a team).",
    );

    const insert = async (
      table: string,
      row: Record<string, unknown>,
    ): Promise<void> => {
      const names = Object.keys(row);
      const casts = ENUMS[table] ?? {};
      const placeholders = names.map((name, i) => {
        const type = casts[name];
        if (type) return `$${i + 1}::"${type}"`;
        if (
          ["id", "project_id", "drillhole_id", "parent_sample_id"].includes(
            name,
          )
        )
          return `$${i + 1}::uuid`;
        if (name === "started_at" || name === "completed_at")
          return `$${i + 1}::date`;
        if (/_at$/.test(name)) return `$${i + 1}::timestamptz`;
        return `$${i + 1}`;
      });
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(", ")}) VALUES (${placeholders.join(", ")})`,
        ...names.map((n) => row[n]),
      );
    };

    // Replace an earlier copy.
    const old = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id::text FROM projects WHERE organization_id = $1 AND name = $2`,
      org,
      PROJECT_NAME,
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
        await prisma.$executeRawUnsafe(
          `DELETE FROM "${t}" WHERE drillhole_id IN (${holes})`,
          id,
        );
      for (const t of [
        // Custody and dispatch rows point at samples, so they go first.
        "dispatch_samples",
        "custody_events",
        "dispatches",
        "samples",
        "qc_dismissals",
        "code_library",
        "drillholes",
      ])
        await prisma.$executeRawUnsafe(
          `DELETE FROM "${t}" WHERE project_id = $1::uuid`,
          id,
        );
      await prisma.$executeRawUnsafe(
        `DELETE FROM projects WHERE id = $1::uuid`,
        id,
      );
    }

    const now = new Date();
    const stamp = (minutesAgo: number) =>
      new Date(now.getTime() - minutesAgo * 60_000).toISOString();
    const tracked = (minutesAgo: number) => ({
      created_at: stamp(minutesAgo),
      updated_at: stamp(minutesAgo),
      version: 1,
      deleted_at: null,
    });

    const projectId = randomUUID();
    await insert("projects", {
      id: projectId,
      organization_id: org,
      created_by: org,
      name: PROJECT_NAME,
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
    });

    const holes = parseCsv(
      readFileSync(resolve(DATA, "drillholes.csv"), "utf8"),
    );
    const intervals = parseCsv(
      readFileSync(resolve(DATA, "intervals.csv"), "utf8"),
    );
    let boxCount = 0;
    let intervalCount = 0;
    let sampleNo = 1;
    const sampleNumber = () => `AGS-${String(sampleNo++).padStart(5, "0")}`;

    for (const [index, hole] of holes.entries()) {
      const holeId = randomUUID();
      const name = hole.DH_name;
      const depth = number(hole.Total_dpth) ?? 0;
      const drilled = value(hole.Drill_date);
      const age = 60 * 24 * (5 - index) + 90;
      await insert("drillholes", {
        id: holeId,
        organization_id: org,
        created_by: org,
        project_id: projectId,
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
        await insert("drillhole_status_history", {
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
        await insert("log_intervals", {
          id: randomUUID(),
          organization_id: org,
          created_by: org,
          project_id: projectId,
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
        for (
          let m = Math.floor(from / 3);
          m <= Math.floor((to - 0.001) / 3);
          m++
        )
          chunks.add(m);
        if (notes && /py/i.test(notes) && sampled.length < 2) {
          sampled.push({ id: randomUUID(), from, to });
        }
      }

      // Illustrative: 3 m core boxes and runs over the depths that were logged.
      for (const m of [...chunks].sort((a, b) => a - b)) {
        const from = m * 3;
        const to = Math.min(from + 3, depth);
        await insert("core_boxes", {
          id: randomUUID(),
          organization_id: org,
          created_by: org,
          project_id: projectId,
          drillhole_id: holeId,
          box_number: m + 1,
          from_m: from,
          to_m: to,
          note: null,
          ...tracked(age - 10),
        });
        boxCount++;
        await insert("core_runs", {
          id: randomUUID(),
          organization_id: org,
          created_by: org,
          project_id: projectId,
          drillhole_id: holeId,
          from_m: from,
          to_m: to,
          recovered_m:
            Math.round((to - from) * (0.9 + ((m * 7) % 10) / 100) * 100) / 100,
          rqd_pieces_m:
            Math.round((to - from) * (0.72 + ((m * 3) % 12) / 100) * 100) / 100,
          ...tracked(age - 10),
        });
      }

      // Illustrative: samples on the sulphide-bearing intervals.
      for (const s of sampled)
        await insert("samples", {
          id: s.id,
          organization_id: org,
          created_by: org,
          project_id: projectId,
          drillhole_id: holeId,
          sample_number: sampleNumber(),
          sample_type: "primary",
          from_m: s.from,
          to_m: s.to,
          standard_ref: null,
          parent_sample_id: null,
          note: null,
          status: "bagged",
          ...tracked(age - 5),
        });
      if (index === 0 && sampled[0]) {
        const first = sampled[0];
        const qc = (type: string, extra: Record<string, unknown>) =>
          insert("samples", {
            id: randomUUID(),
            organization_id: org,
            created_by: org,
            project_id: projectId,
            drillhole_id: holeId,
            sample_number: sampleNumber(),
            sample_type: type,
            from_m: null,
            to_m: null,
            standard_ref: null,
            parent_sample_id: null,
            note: null,
            status: "bagged",
            ...tracked(age - 4),
            ...extra,
          });
        await qc("blank", {});
        await qc("standard", { standard_ref: "OREAS 45e" });
        await qc("duplicate", {
          from_m: first.from,
          to_m: first.to,
          parent_sample_id: first.id,
        });
      }
    }

    console.log(
      `Loaded "${PROJECT_NAME}" into ${email}: ${holes.length} holes, ${intervalCount} intervals, ${boxCount} boxes and runs, ${sampleNo - 1} samples.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
