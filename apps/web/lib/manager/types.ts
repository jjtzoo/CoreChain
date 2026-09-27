import type { DrillholePriority } from "@corechain/domain";
import type { DispatchState } from "./stats";

// Shapes the project manager's pages pass to their client components.

export type HoleRow = {
  id: string;
  holeId: string;
  projectId: string;
  projectName: string;
  status: string;
  plannedDepthM: number;
  drilledM: number;
  loggedM: number;
  avgRecoveryPercent: number | null;
  waitingToBag: number;
  waitingToDispatch: number;
  sampleCount: number;
  loggedByNames: string[];
  assignedToUserId: string | null;
  priority: DrillholePriority;
  priorityNote: string | null;
  updatedAt: string;
  /** The most serious standing QA/QC decision across stages: reject, hold, then accept. */
  qaqcDecision: string | null;
  hasCollar: boolean;
  /** Why the hole is on the "Needs attention" list, or null. */
  attention: string | null;
};

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  title: string | null;
};

export type DeviceRow = {
  id: string;
  name: string;
  userId: string;
  ownerName: string;
  lastSeenAt: string | null;
};

export type AttentionRow = {
  id: string;
  title: string;
  detail: string;
  href: string | null;
  severity: "danger" | "warn";
};

export type ActivityRow = {
  id: string;
  byName: string;
  summary: string;
  when: string;
};

export type DispatchRow = {
  id: string;
  dispatchNumber: string;
  laboratory: string;
  projectId: string;
  projectName: string;
  sampleCount: number;
  handoverDay: string | null;
  returnedDay: string | null;
  returnedAt: Date | null;
  state: DispatchState;
};

export type DecisionRow = {
  id: string;
  drillholeId: string;
  holeId: string;
  projectId: string;
  projectName: string;
  stageLabel: string;
  decision: string;
  note: string | null;
  decidedBy: string;
  decidedDay: string;
  decidedAt: Date;
};

export type ProjectCardData = {
  id: string;
  name: string;
  commodity: string | null;
  location: string | null;
  holeCount: number;
  statusCounts: Record<string, number>;
  plannedM: number;
  drilledM: number;
  resultsBack: number;
  waitingForResults: number;
  hasCollars: boolean;
};
