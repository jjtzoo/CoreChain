// Puts the synthetic Cordillera porphyry sample into one account, so a phone or
// the web app signed in as that account shows a Philippine-style copper-gold
// prospect (for demos and screenshots).
//
//   npm run sample:cordillera -- geologist1@corechain.test
//
// EVERYTHING here is made up: the holes, coordinates and logs are written by us
// (apps/web/data/demo/synthetic-cordillera-porphyry) and the core boxes, runs
// and samples are cut from those depths. Nothing is real data. The samples start
// as "created" (not yet bagged) so the custody steps can be tried on them.
// Run it again and it replaces its own earlier copy; other projects are left alone.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

// Run from apps/web (the npm script does).
const DATA = resolve(
  process.cwd(),
  "data/demo/synthetic-cordillera-porphyry/curated",
);
const PROJECT_NAME = "Cordillera porphyry sample (synthetic)";
const MINERALISED = new Set(["CPY", "BN", "MOL", "AU"]);

function parseCsv(text: string): Record<string, string>[] {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const split = (line: string) =>
    [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) =>
      m[1].replace(/""/g, '"'),
    );
  const names = split(header);
  return lines.map((line) => {
    const cells = split(line);
    return Object.fromEntries(names.map((n, i) => [n, cells[i] ?? ""]));
  });
}

const value = (raw: string | undefined) =>
  raw === undefined || raw === "" ? null : raw;
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
  if (!email) throw new Error("Usage: npm run sample:cordillera -- <email>");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("No account with that email.");
    const org = user.id;

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
    const sampleNumber = () => `CDL-${String(sampleNo++).padStart(5, "0")}`;

    for (const [index, hole] of holes.entries()) {
      const holeId = randomUUID();
      const name = hole.hole_id;
      const depth = number(hole.final_depth_m) ?? 0;
      const drilled = value(hole.drilled_on);
      const age = 60 * 24 * (5 - index) + 90;
      await insert("drillholes", {
        id: holeId,
        organization_id: org,
        created_by: org,
        project_id: projectId,
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
        await insert("drillhole_status_history", {
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
        await insert("log_intervals", {
          id: randomUUID(),
          organization_id: org,
          created_by: org,
          project_id: projectId,
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
        // Recovery is poor in the weathered cap and good in fresh rock.
        const weathered = from < 40;
        await insert("core_runs", {
          id: randomUUID(),
          organization_id: org,
          created_by: org,
          project_id: projectId,
          drillhole_id: holeId,
          from_m: from,
          to_m: to,
          recovered_m:
            Math.round(
              (to - from) *
                ((weathered ? 0.78 : 0.94) + ((m * 7) % 6) / 100) *
                100,
            ) / 100,
          rqd_pieces_m:
            Math.round(
              (to - from) *
                ((weathered ? 0.42 : 0.78) + ((m * 3) % 12) / 100) *
                100,
            ) / 100,
          ...tracked(age - 10),
        });
      }

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
          status: "created",
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
            status: "created",
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
