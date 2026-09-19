import { describe, expect, it } from "vitest";
import {
  buildExportTables,
  csvEscape,
  exportSlug,
  toCsv,
  type ExportData,
} from "./export";

describe("csvEscape", () => {
  it("leaves plain values alone and renders null/undefined as empty", () => {
    expect(csvEscape("DDH-01")).toBe("DDH-01");
    expect(csvEscape(4.5)).toBe("4.5");
    expect(csvEscape(0)).toBe("0");
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("quotes fields containing commas, quotes or line breaks", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("doubles quotes inside a quoted field", () => {
    expect(csvEscape('5" core')).toBe('"5"" core"');
  });

  it("does not quote fields with only spaces or semicolons", () => {
    expect(csvEscape("OREAS 45e")).toBe("OREAS 45e");
    expect(csvEscape("a;b")).toBe("a;b");
  });
});

describe("toCsv", () => {
  it("writes a header then rows, CRLF-separated, ending in a newline", () => {
    expect(toCsv(["A", "B"], [[1, "x"], [2, null]])).toBe("A,B\r\n1,x\r\n2,\r\n");
  });

  it("writes just the header when there are no rows", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B\r\n");
  });
});

describe("exportSlug", () => {
  it("makes a lowercase, hyphenated, filesystem-safe name", () => {
    expect(exportSlug("Sipalay Test Prospect")).toBe("sipalay-test-prospect");
    expect(exportSlug("  Río / Oro #2!  ")).toBe("r-o-oro-2");
  });

  it("falls back for a name with no usable characters", () => {
    expect(exportSlug("!!!")).toBe("project");
    expect(exportSlug("")).toBe("project");
  });
});

const base = { createdAt: "t", updatedAt: "t", version: 1, deletedAt: null };

const data: ExportData = {
  project: { name: "Sipalay Test", coordinateSystem: "PRS92" },
  drillholes: [
    {
      ...base,
      id: "h2",
      projectId: "p",
      holeId: "RC-10",
      collar: { source: "manual", latitude: 10.5, longitude: 122.5, accuracyM: null, capturedAt: "t" },
      plannedAzimuthDeg: null,
      plannedInclinationDeg: null,
      plannedDepthM: 80,
      actualFinalDepthM: null,
      startedAt: null,
      completedAt: null,
      status: "planned",
      contractor: null,
      drillType: null,
      diameter: null,
      note: null,
    },
    {
      ...base,
      id: "h1",
      projectId: "p",
      holeId: "DDH-01",
      collar: { source: "gps", latitude: 14.613951, longitude: 121.032869, accuracyM: 100, capturedAt: "t" },
      plannedAzimuthDeg: 270,
      plannedInclinationDeg: -60,
      plannedDepthM: 150,
      actualFinalDepthM: 152.5,
      startedAt: "2026-09-19",
      completedAt: null,
      status: "drilling",
      contractor: null,
      drillType: null,
      diameter: null,
      note: null,
    },
  ],
  runs: [
    { ...base, id: "r2", drillholeId: "h1", fromM: 3, toM: 6, recoveredM: 3.4, rqdPiecesM: null },
    { ...base, id: "r1", drillholeId: "h1", fromM: 0, toM: 3, recoveredM: 2.9, rqdPiecesM: 2.1 },
  ],
  intervals: [
    {
      ...base,
      id: "i1",
      drillholeId: "h1",
      fromM: 0,
      toM: 4.5,
      lithology: "AND",
      alterationType: "PROP",
      alterationIntensity: "2",
      mineral: "PY",
      mineralStyle: "DISS",
      mineralPercent: 3,
      weathering: "SW",
      structureType: "VEIN",
      notes: 'vuggy, "sugary"',
    },
  ],
  samples: [
    { ...base, id: "s2", projectId: "p", drillholeId: "h1", sampleNumber: "SIP-00010", type: "duplicate", fromM: 1, toM: 2, standardRef: null, parentSampleId: "s1", note: null, status: "created" },
    { ...base, id: "s1", projectId: "p", drillholeId: "h1", sampleNumber: "SIP-00002", type: "primary", fromM: 1, toM: 2, standardRef: null, parentSampleId: null, note: null, status: "created" },
    { ...base, id: "s3", projectId: "p", drillholeId: "h1", sampleNumber: "SIP-00003", type: "standard", fromM: null, toM: null, standardRef: "OREAS 45e", parentSampleId: null, note: null, status: "created" },
  ],
};

const table = (name: string) => {
  const found = buildExportTables(data).find((t) => t.name === name);
  if (!found) {
    throw new Error(`no ${name} table`);
  }
  return found;
};
const lines = (name: string) => table(name).csv.trimEnd().split("\r\n");

describe("buildExportTables", () => {
  it("returns one file per table with stable, slugged filenames", () => {
    const tables = buildExportTables(data);
    expect(tables.map((t) => t.filename)).toEqual([
      "sipalay-test-collars.csv",
      "sipalay-test-surveys.csv",
      "sipalay-test-log.csv",
      "sipalay-test-runs.csv",
      "sipalay-test-samples.csv",
    ]);
  });

  it("uses the column names Leapfrog and GEOVIA recognise", () => {
    expect(lines("collars")[0]).toBe(
      "HOLEID,LONGITUDE,LATITUDE,COORDINATE_SYSTEM,COLLAR_SOURCE,ACCURACY_M,PLANNED_DEPTH,FINAL_DEPTH,STATUS,STARTED,COMPLETED",
    );
    expect(lines("surveys")[0]).toBe("HOLEID,DEPTH,AZIMUTH,DIP");
    expect(lines("log")[0]).toBe(
      "HOLEID,FROM,TO,LITHOLOGY,ALTERATION_TYPE,ALTERATION_INTENSITY,MINERAL,MINERAL_STYLE,MINERAL_PERCENT,WEATHERING,STRUCTURE_TYPE,NOTES",
    );
    expect(lines("runs")[0]).toBe(
      "HOLEID,FROM,TO,DRILLED_M,RECOVERED_M,RECOVERY_PCT,RQD_PIECES_M,RQD_PCT",
    );
    expect(lines("samples")[0]).toBe(
      "SAMPLE_ID,HOLEID,FROM,TO,SAMPLE_TYPE,QC,STANDARD_REF,PARENT_SAMPLE_ID,STATUS,NOTES",
    );
  });

  it("sorts holes naturally and counts rows", () => {
    expect(lines("collars").slice(1).map((l) => l.split(",")[0])).toEqual([
      "DDH-01",
      "RC-10",
    ]);
    expect(table("collars").rowCount).toBe(2);
  });

  it("labels a GPS collar WGS84 and a typed one with the project system", () => {
    const [, gps, manual] = lines("collars");
    expect(gps).toBe(
      "DDH-01,121.032869,14.613951,WGS84,gps,100,150,152.5,drilling,2026-09-19,",
    );
    expect(manual).toBe("RC-10,122.5,10.5,PRS92,manual,,80,,planned,,");
  });

  it("gives a hole with no collar empty coordinate fields", () => {
    const noCollar: ExportData = {
      ...data,
      drillholes: [{ ...data.drillholes[1]!, collar: null }],
    };
    const row = buildExportTables(noCollar)[0]!.csv.trimEnd().split("\r\n")[1];
    expect(row).toBe("DDH-01,,,,,,150,152.5,drilling,2026-09-19,");
  });

  it("writes one survey station per hole that has a planned azimuth or dip", () => {
    expect(lines("surveys").slice(1)).toEqual(["DDH-01,0,270,-60"]);
  });

  it("escapes commas and quotes in free text", () => {
    expect(lines("log")[1]).toBe(
      'DDH-01,0,4.5,AND,PROP,2,PY,DISS,3,SW,VEIN,"vuggy, ""sugary"""',
    );
  });

  it("sorts runs by depth and computes recovery and RQD", () => {
    expect(lines("runs").slice(1)).toEqual([
      "DDH-01,0,3,3,2.9,96.7,2.1,70",
      "DDH-01,3,6,3,3.4,113.3,,",
    ]);
  });

  it("flags QC samples, sorts numbers naturally and resolves the parent's number", () => {
    expect(lines("samples").slice(1)).toEqual([
      "SIP-00002,DDH-01,1,2,primary,N,,,created,",
      "SIP-00003,DDH-01,,,standard,Y,OREAS 45e,,created,",
      "SIP-00010,DDH-01,1,2,duplicate,Y,,SIP-00002,created,",
    ]);
  });

  it("still writes every file, header only, for a project with no data", () => {
    const empty = buildExportTables({
      project: data.project,
      drillholes: [],
      runs: [],
      intervals: [],
      samples: [],
    });
    expect(empty).toHaveLength(5);
    for (const t of empty) {
      expect(t.rowCount).toBe(0);
      expect(t.csv.trimEnd().split("\r\n")).toHaveLength(1);
    }
  });
});
