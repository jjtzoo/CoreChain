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
