export type SourceProvenance = {
  sourceTable: string;
  sourceId: string;
  sourceGroup: string;
  raw: Readonly<Record<string, string>>;
};

export type Drillhole = {
  id: string;
  name: string;
  drillType: string | null;
  drillDate: string | null;
  finalDepthM: number | null;
  reportedAzimuthDeg: number | null;
  reportedInclinationDeg: number | null;
  location: {
    longitude: number | null;
    latitude: number | null;
    easting: number | null;
    northing: number | null;
    groundElevationM: number | null;
    coordinateReferenceSystem: string;
  };
  contractor: string | null;
  diameter: string | null;
  note: string | null;
  provenance: SourceProvenance;
};

export type GeologicalInterval = {
  id: string;
  drillholeName: string;
  fromM: number;
  toM: number;
  material: string | null;
  rockType: string | null;
  lithologicalUnit: string | null;
  stratigraphicUnit: string | null;
  description: string | null;
  provenance: SourceProvenance;
};

export type AssayRecord = {
  id: string;
  drillholeName: string;
  sampleId: string | null;
  fromM: number | null;
  toM: number | null;
  certificateDate: string | null;
  sampleDate: string | null;
  laboratory: string | null;
  preparationCode: string | null;
  methodCode: string | null;
  detectionLimit: string | null;
  qaqcDescription: string | null;
  provenance: SourceProvenance;
};

export type RecordOrigin =
  "Public source data" | "Synthetic demonstration data";

export type CoreBox = {
  id: string;
  drillholeName: string;
  boxNumber: string;
  fromM: number;
  toM: number;
  receivedStatus: "Received" | "Not recorded";
  condition: string;
  location: string;
  origin: RecordOrigin;
  note: string;
};

export type Sample = {
  id: string;
  projectSampleId: string;
  sourceSampleId: string;
  drillholeName: string;
  linkedIntervalId: string;
  fromM: number;
  toM: number;
  sampleType: "Primary" | "Standard" | "Blank" | "Field duplicate" | "Other";
  purpose: string;
  status: string;
  origin: RecordOrigin;
};

export type CustodyEvent = {
  id: string;
  sampleId: string;
  eventType: "Created" | "Packed" | "Handed over" | "Dispatched";
  occurredAt: string;
  handledBy: string;
  location: string;
  note: string;
  evidence: string;
  origin: RecordOrigin;
};

export type Dispatch = {
  id: string;
  dispatchNumber: string;
  laboratory: string;
  preparationRequest: string;
  createdAt: string;
  handedOffAt: string;
  receivedAt: string | null;
  status: string;
  sampleIds: readonly string[];
  origin: RecordOrigin;
  note: string;
};

export type AssayResultValue = {
  analyte: string;
  unit: "ppm" | "pct";
  reportedValue: string;
};

export type AssayMatch = {
  id: string;
  corechainSampleId: string;
  sourceSampleId: string;
  sourceAssayId: string;
  fromM: number;
  toM: number;
  laboratory: string | null;
  methodCode: string | null;
  certificateDate: string | null;
  reportedValues: readonly AssayResultValue[];
  origin: RecordOrigin;
};

export type QaqcControl = {
  id: string;
  controlType: "Standard" | "Blank" | "Field duplicate";
  insertedWithSampleId: string;
  observation: string;
  demonstrationRule: string;
  status: "No alert shown" | "Flagged for review" | "Review recorded";
  origin: RecordOrigin;
};

export type QaqcReview = {
  id: string;
  sampleId: string;
  status: "Review required";
  decision: string;
  note: string;
  origin: RecordOrigin;
};

export type ImportIntegrity = {
  drillholeCount: number;
  intervalCount: number;
  assayCount: number;
  orphanIntervalCount: number;
  orphanAssayCount: number;
};

export type AlbertaDemoDataset = {
  drillholes: readonly Drillhole[];
  intervals: readonly GeologicalInterval[];
  assays: readonly AssayRecord[];
  integrity: ImportIntegrity;
};

export * from "./field";
export * from "./core";
export * from "./logging";
export * from "./holeLog";
export * from "./myWork";
export * from "./conflicts";
export * from "./sampling";
export * from "./export";
export * from "./photos";
export * from "./photoBackup";
export * from "./dates";
export * from "./overview";
export * from "./session";
export * from "./sampleBlocks";
export * from "./labQc";
export * from "./collarMap";
export * from "./projectView";
export * from "./lithology";
export * from "./roles";
export * from "./signIn";
export * from "./passwords";
export * from "./depthLandmarks";
export * from "./feedback";
export * from "./syncStatus";
export * from "./recordSync";
export * from "./signOut";
export * from "./appVersion";

export * from "./custody";
export * from "./qaqc";
export * from "./laboratory";
export * from "./assayImport";
export * from "./codeImport";
export * from "./workspace";
