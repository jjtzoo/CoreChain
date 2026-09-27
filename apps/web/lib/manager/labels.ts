// Words and pill styles shared by the project manager's pages.

export const HOLE_STATUSES = ["logged", "complete", "drilling", "planned"] as const;

export const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  drilling: "Drilling",
  complete: "Complete",
  logged: "Logged",
};

export const STATUS_PILL_CLASS: Record<string, string> = {
  planned: "status-pill is-muted",
  drilling: "status-pill is-copper",
  complete: "status-pill is-muted",
  logged: "status-pill is-success",
};

export const QAQC_DECISION_DISPLAY: Record<string, { label: string; className: string }> = {
  accept: { label: "Accepted", className: "status-pill is-success" },
  hold: { label: "Held", className: "status-pill is-warn" },
  reject: { label: "Rejected", className: "status-pill is-danger" },
};

export const QAQC_NOT_REVIEWED = { label: "Not reviewed", className: "status-pill is-muted" };

export function qaqcDisplay(decision: string | null) {
  return decision ? (QAQC_DECISION_DISPLAY[decision] ?? QAQC_NOT_REVIEWED) : QAQC_NOT_REVIEWED;
}

export const CONTROL_LABELS: Record<string, string> = {
  standard: "Standards",
  blank: "Blanks",
  duplicate: "Duplicates",
};

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}
