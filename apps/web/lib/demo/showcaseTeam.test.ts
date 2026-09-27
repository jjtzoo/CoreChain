import { describe, expect, it } from "vitest";
import { buildShowcaseRows } from "./showcaseTeam";

const { rows } = buildShowcaseRows(Date.parse("2026-09-27T08:00:00Z"));
const samples = rows.rowsOf("samples");

describe("the showcase team's data", () => {
  it("never repeats a sample number within a project", () => {
    const keys = samples.map((s) => `${s.project_id}:${s.sample_number}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("puts every sample in at most one dispatch, and every dispatch has samples", () => {
    const links = rows.rowsOf("dispatch_samples");
    const sampleIds = links.map((l) => l.sample_id);
    expect(new Set(sampleIds).size).toBe(sampleIds.length);
    for (const d of rows.rowsOf("dispatches")) {
      expect(links.some((l) => l.dispatch_id === d.id)).toBe(true);
    }
  });

  it("marks a sample dispatched only when its dispatch has left", () => {
    const status = new Map(rows.rowsOf("dispatches").map((d) => [d.id, d.status]));
    const dispatchOf = new Map(rows.rowsOf("dispatch_samples").map((l) => [l.sample_id, l.dispatch_id]));
    for (const s of samples) {
      const d = dispatchOf.get(s.id);
      expect(s.status).toBe(d === undefined ? s.status : status.get(d) === "dispatched" ? "dispatched" : "bagged");
      if (d === undefined) expect(s.status).not.toBe("dispatched");
    }
  });

  it("logs each hole without gaps or overlaps", () => {
    const byHole = new Map<unknown, { from_m: number; to_m: number }[]>();
    for (const i of rows.rowsOf("log_intervals") as { drillhole_id: string; from_m: number; to_m: number }[]) {
      byHole.set(i.drillhole_id, [...(byHole.get(i.drillhole_id) ?? []), i]);
    }
    for (const intervals of byHole.values()) {
      intervals.forEach((interval, index) => {
        expect(interval.to_m).toBeGreaterThan(interval.from_m);
        if (index > 0) expect(interval.from_m).toBe(intervals[index - 1].to_m);
      });
    }
  });

  it("has results only for dispatches marked as returned", () => {
    const returned = new Set(rows.rowsOf("dispatches").filter((d) => d.results_returned_at).map((d) => d.id));
    for (const r of rows.rowsOf("assay_results")) expect(returned.has(r.dispatch_id)).toBe(true);
  });
});
