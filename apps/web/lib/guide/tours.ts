// The in-app guide: a short tour of each page, started from "Guide" in the top
// bar. Each step lights up one part of the live page and says what it is.
// Pages link into one path: Next on a page's last part opens the next page's
// tour, and Back on its first part returns to the previous one.
//
// Written for any team's live data, so no step names a hole or a figure. A
// step whose part is not on the page (no phones flagged, no project picker
// with one project) is skipped.

export type GuideTarget = {
  /** CSS selector for the part to light up. */
  selector: string;
  /** Only an element whose own h2 or h3 reads exactly this. */
  heading?: string;
  /** Only an element containing this text; the smallest such element wins. */
  text?: string;
};

export type GuideStep = GuideTarget & {
  title: string;
  body: string;
};

/** How Next reaches the following page: a fixed address, or a link on this page. */
export type GuideNext = { page: string; href: string } | { page: string; linkSelector: string };

export type GuidePage = {
  id: string;
  name: string;
  /** The page's own address; a fixed one lets Back return to it directly. */
  href?: string;
  match: RegExp;
  steps: GuideStep[];
  next?: GuideNext;
};

export type GuideTour = {
  id: "manager" | "qaqc";
  /** Where "Guide" starts on a page with no tour of its own. */
  start: string;
  pages: GuidePage[];
};

const panel = (heading: string): GuideTarget => ({ selector: "section.mg-panel", heading });

const PROJECT = "/team/projects/[^/?#]+";

export const MANAGER_TOUR: GuideTour = {
  id: "manager",
  start: "/team",
  pages: [
    {
      id: "today",
      name: "Today",
      href: "/team",
      match: /^\/team\/?$/,
      next: { page: "projects", href: "/team/projects" },
      steps: [
        { selector: ".mg-nav", title: "The top bar", body: "Today, Projects, Holes, Samples & lab, Team and Setup. The page you are on is shaded." },
        { selector: ".mg-search", title: "Find a sample or hole", body: "Type a bag-tag number or a hole name and press Enter." },
        { selector: ".mg-kpis", title: "This week's figures", body: "Metres drilled against the week before, holes drilling, samples waiting, results overdue and QA/QC holds. Amber means late; red means QA/QC rejected work. A card with an arrow opens the detail behind it." },
        { selector: ".mg-projects", title: "Your projects", body: "One card per project: metres drilled against plan, holes by status, and samples with results or still at the laboratory. Open project goes into it; 3D view shows its holes." },
        { ...panel("Needs attention"), title: "Needs attention", body: "Everything waiting on a decision, most serious first: rejections, holds, overdue batches, urgent or quiet holes, holes with nobody assigned, and phones that stopped syncing. Each row opens what it is about." },
        { ...panel("Team this week"), title: "Team this week", body: "Which holes each person has, and when their phone last synced." },
        { ...panel("Recent activity"), title: "Recent activity", body: "The latest intervals, core runs and samples recorded, and by whom." },
      ],
    },
    {
      id: "projects",
      name: "Projects",
      href: "/team/projects",
      match: /^\/team\/projects\/?$/,
      next: { page: "summary", linkSelector: '.mg-project-card a[href^="/team/projects/"]' },
      steps: [
        { selector: ".mg-project-card", title: "A project", body: "Its name opens it. The copper bar is metres drilled against plan; the bar below splits the holes by status." },
        { selector: ".mg-project-card .mg-actions", title: "Open project, 3D view", body: "Go into the project, or straight to its holes in 3D. Next opens the first project." },
      ],
    },
    {
      id: "summary",
      name: "Project summary",
      match: new RegExp(`^${PROJECT}/?$`),
      next: { page: "three-d", linkSelector: '.mg-tabs a[href$="/3d"]' },
      steps: [
        { selector: ".mg-tabs", title: "Project tabs", body: "Summary, Holes, 3D view, Samples & lab and Progress report. The underlined tab is the one you are on." },
        { selector: ".mg-kpis", title: "Programme figures", body: "Percent of planned metres drilled, holes finished, average core recovery, samples and QC inserts, and laboratory turnaround. Cards with an arrow open the detail." },
        { ...panel("Drilled against planned depth, by hole"), title: "Drilled against planned depth", body: "One bar per hole on the same scale. Green is finished, copper is still drilling, and the dark mark is the planned depth." },
        { ...panel("QC inserted against the project's rates"), title: "QC inserted against the project's rates", body: "Standards, blanks and duplicates expected at the project's rates, against what was inserted. A figure in amber is short." },
        { ...panel("Laboratory and QA/QC"), title: "Laboratory and QA/QC", body: "Samples with results, samples at the laboratory, and holes held or rejected." },
      ],
    },
    {
      id: "three-d",
      name: "3D view",
      match: new RegExp(`^${PROJECT}/3d/?$`),
      next: { page: "report", linkSelector: '.mg-tabs a[href$="/report"]' },
      steps: [
        { selector: ".pv-toolbar", title: "Controls", body: "Colour the samples by element, and stretch depth to separate holes that are close together." },
        { selector: ".pv-canvas", title: "The holes", body: "Each hole drawn at its surveyed angle from its collar. Drag to turn and scroll to zoom. Samples with results are coloured by grade, grey ones have none yet, and dashed lines are the planned path still to drill." },
        { selector: ".pv-panel", title: "Hole list", body: "Pick a hole here, or in the view, to see its samples and results." },
      ],
    },
    {
      id: "report",
      name: "Progress report",
      match: new RegExp(`^${PROJECT}/report/?$`),
      next: { page: "holes", href: "/team/holes" },
      steps: [
        { selector: ".mg-report-bar .mg-chips", title: "Period", body: "Last 7 days, last 30 days or since the start." },
        { selector: ".mg-report-bar .mg-button", title: "Print or save as PDF", body: "Opens the print window. Choose Save as PDF to send it." },
        { selector: ".mg-sheet-figs", title: "Key figures", body: "Metres drilled, percent of plan, samples taken and results returned in the period." },
        { selector: ".mg-sheet", title: "The report", body: "Drilling, laboratory and quality, written from the recorded data. Nothing to type." },
      ],
    },
    {
      id: "holes",
      name: "Holes",
      href: "/team/holes",
      match: /^\/team\/holes\/?$/,
      next: { page: "hole", linkSelector: '.workspace-detail .mg-actions a[href^="/team/holes/"]' },
      steps: [
        { selector: ".mg-chips", title: "Filters", body: "All, Urgent, Drilling, Needs attention and Unassigned, with how many holes each shows." },
        { selector: ".workspace-queue", title: "Hole list", body: "Urgent holes come first, with status and metres drilled against plan. Click a hole to open it on the right." },
        { selector: ".workspace-detail .mg-actions", title: "Open hole, See in 3D", body: "The hole's full record, or the 3D view with this hole picked out." },
        { selector: ".workspace-detail > div", text: "Assigned to", title: "Assign and mark urgent", body: "Choose the geologist responsible, or mark the hole as needing urgent attention with a note. The geologist sees it on the phone after the next sync." },
      ],
    },
    {
      id: "hole",
      name: "A hole's record",
      match: /^\/team\/holes\/[^/?#]+\/?$/,
      next: { page: "lab", href: "/team/lab" },
      steps: [
        { selector: ".admin-page-header", title: "The hole", body: "Its project, planned and final depth, who is assigned, and links to the 3D view and bag tags." },
        { selector: '[aria-labelledby="runs-title"]', title: "Core runs", body: "Every run with the core recovered and who recorded it. Logged intervals, and samples with their custody, follow below." },
        { selector: '[aria-labelledby="side-title"]', title: "Photos and decisions", body: "Photos taken at the rig, and the QA/QC decisions on the hole with the reviewer's notes." },
      ],
    },
    {
      id: "lab",
      name: "Samples & lab",
      href: "/team/lab",
      match: /^\/team\/lab\/?$/,
      next: { page: "people", href: "/team/people" },
      steps: [
        { selector: ".mg-kpis", title: "Chain figures", body: "Waiting to be sent, at the laboratory, average turnaround, overdue batches, and QA/QC holds and rejections." },
        { selector: "#dispatches", title: "Dispatches", body: "Every batch sent to the laboratory, longest waiting first. Amber is overdue (more than 14 days), grey is waiting, and green is back, with how long it took." },
        { selector: "#qaqc", title: "QA/QC held or rejected", body: "Every hold and rejection with the reviewer's note. Read-only: the manager follows up, QA/QC decides." },
        { ...panel("Find a sample"), title: "Find a sample", body: "Type a bag-tag number to see its hole, depth, custody steps, dispatch and results." },
      ],
    },
    {
      id: "sample",
      name: "A sample",
      match: /^\/team\/samples\/[^/?#]+\/?$/,
      steps: [
        { selector: '[aria-labelledby="progress-title"]', title: "Its journey", body: "Sampled, bagged, dispatched, received by the laboratory and results in, each with its date." },
        { selector: '[aria-labelledby="custody-title"]', title: "Chain of custody", body: "Every hand-over, who did it and where. Steps are only ever added; a mistake is corrected, never erased." },
        { selector: '[aria-labelledby="lab-title"]', title: "Laboratory", body: "The batch it went in and the results entered by the laboratory." },
      ],
    },
    {
      id: "people",
      name: "Team",
      href: "/team/people",
      match: /^\/team\/people\/?$/,
      next: { page: "setup", href: "/team/setup" },
      steps: [
        { ...panel("People"), title: "People", body: "Each person, their holes, metres logged in the last 7 days, and their phones. Green is synced recently; amber has been quiet for more than 21 days." },
        { ...panel("Recent activity"), title: "Recent activity", body: "What was recorded and by whom. Full activity shows the last 24 hours and quiet holes." },
      ],
    },
    {
      id: "setup",
      name: "Setup",
      href: "/team/setup",
      match: /^\/team\/setup\/?$/,
      steps: [
        { ...panel("Team lists"), title: "Team lists", body: "The code library geologists log with, the standards and blanks results are checked against, and bag tags to print." },
        { ...panel("Project settings"), title: "Project settings", body: "Each project's sample prefix and QC rates. Shown here but changed on the phone, so the field and the office never overwrite each other." },
      ],
    },
  ],
};

export const QAQC_TOUR: GuideTour = {
  id: "qaqc",
  start: "/qaqc",
  pages: [
    {
      id: "queue",
      name: "QA/QC",
      href: "/qaqc",
      match: /^\/qaqc\/?$/,
      next: { page: "standards", href: "/qaqc/standards" },
      steps: [
        { selector: ".lifecycle-legend", title: "Your stage", body: "Each reviewer checks one stage of the chain: core and logging, sampling and custody, or laboratory and assays. An admin sets yours on the Users page." },
        { selector: ".qaqc-project-picker", title: "Project", body: "Show one project's holes, or every project on the team." },
        { selector: ".kpi-strip", title: "The figures", body: "Holes to review, open exceptions, phones gone quiet, and what was resolved or decided this week. Open exceptions and Resolved this week filter the list; click again to show all." },
        { selector: ".workspace-queue", title: "Holes to review", body: "Holes with an open exception come first, with how many in red, and each shows its latest decision. Click one to open it." },
        { selector: ".workspace-detail .exception-list", title: "Open exceptions", body: "What CoreChain found in the recorded data, with the evidence. When one has an explanation, Resolve it and say why; the reason is kept with it." },
        { selector: ".workspace-detail > div", text: "Record decision", title: "Record a decision", body: "Accept, Hold or Reject the hole, with an optional note. The project manager sees holds and rejections on their Today page." },
        { selector: ".workspace-detail > details", text: "Decision history", title: "Decision history", body: "Every decision on the hole, newest first: who made it, the note, and what was still open at the time. Click to open it." },
        { selector: '[aria-labelledby="devices-title"]', title: "Devices", body: "Phones that have not synced for more than 21 days. Worth knowing, not necessarily a problem: the app works offline for weeks." },
        { selector: '[aria-labelledby="how-title"]', title: "How this screen works", body: "The same steps in short, always on the page." },
      ],
    },
    {
      id: "standards",
      name: "Standards and blanks",
      href: "/qaqc/standards",
      match: /^\/qaqc\/standards\/?$/,
      steps: [
        { selector: '[aria-labelledby="qc-form-title"]', title: "Add a line", body: "A standard's certified value and one standard deviation, copied from its certificate, or a blank's limit." },
        { selector: '[aria-labelledby="qc-standards-title"]', title: "Standards", body: "Each standard and element: the certified value, one standard deviation, the range that passes (within 2 SD) and the limits beyond which it fails (3 SD). Between the two is a warning." },
        { selector: '[aria-labelledby="qc-blanks-title"]', title: "Blanks", body: "Each blank material and element, and the value above which it fails." },
        { selector: '[aria-labelledby="sop-title"]', title: "Where the numbers come from", body: "How to copy values from a certificate and set a blank's limit." },
        { selector: '[aria-labelledby="rules-title"]', title: "How results are checked", body: "The rules applied to every result: two warnings in a row fail, units must match, and a field duplicate more than 30% from its original fails." },
      ],
    },
  ],
};

export const GUIDE_TOURS = { manager: MANAGER_TOUR, qaqc: QAQC_TOUR } as const;

/** The address parameter that holds the part being shown: ?guide=3, or ?guide=last. */
export const GUIDE_PARAM = "guide";

/** The tour page for an address, or null when the page has no tour. */
export function guidePageFor(tour: GuideTour, pathname: string): GuidePage | null {
  return tour.pages.find((page) => page.match.test(pathname)) ?? null;
}

/** The page whose Next leads here, if any. */
export function previousGuidePage(tour: GuideTour, pageId: string): GuidePage | null {
  return tour.pages.find((page) => page.next?.page === pageId) ?? null;
}

/**
 * The part to show from the address parameter, among `count` parts on the
 * page: a number from 0, or "last". Anything else starts at the first part;
 * null means the guide is not open.
 */
export function guidePartFromParam(value: string | null, count: number): number | null {
  if (value === null || count <= 0) return null;
  if (value === "last") return count - 1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, count - 1);
}

/** The same address with the guide parameter set, or removed when `part` is null. */
export function withGuideParam(href: string, part: number | "last" | null): string {
  const url = new URL(href, "http://guide.invalid");
  if (part === null) url.searchParams.delete(GUIDE_PARAM);
  else url.searchParams.set(GUIDE_PARAM, String(part));
  const query = url.searchParams.toString();
  return url.pathname + (query ? `?${query}` : "") + url.hash;
}
