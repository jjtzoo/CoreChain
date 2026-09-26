// The landing page's words and demo values, kept out of the JSX so they can be
// read in one place and checked by content.test.ts. Everything here must be
// true of the product today: see the status rows, and never claim customers,
// pilots, tester numbers, iOS, Google Play, public sign-up or modelling-software
// import. The lab and QA/QC values are the laboratory demo project's own
// (DSP-QC-01), worked out with the same rules the app uses.

export const SAMPLE_PROJECT_HREF = "/projects/alberta-drillhole-demo";

export const nav = [
  { href: "#workflow", label: "Workflow" },
  { href: "#field", label: "Field app" },
  { href: "#sample", label: "Traceability" },
  { href: "#qaqc", label: "QA/QC" },
  { href: "#status", label: "Status" },
] as const;

export const hero = {
  kicker: "Core logging and sample traceability",
  title: "From drillhole to assay. One traceable record.",
  lede: "A hole, a depth and a sample number are entered once at the rig. CoreChain carries them through logging, sampling, custody, the laboratory and QA/QC, so nobody re-types them at the next hand-off.",
  primary: "Request pilot access",
  secondary: "See a sample project",
  secondaryNote: "Read-only, built on Alberta Geological Survey open data.",
  status: "In development testing. Not yet released.",
  phoneAlt:
    "CoreChain Field on an Android phone: drillhole CDL-001, 302.5 of 302.5 m logged, with its hole log of lithology, alteration and mineralisation.",
  caption:
    "Phone: CoreChain Field, Cordillera demo project. Web: the same hole on the team workspace, simplified.",
  web: {
    title: "CDL-001",
    sub: "Cordillera porphyry sample (synthetic) · 302.5 m final",
    badge: "Logged",
    stats: [
      { label: "Core logged", value: "302.5 m", note: "13 intervals" },
      { label: "Core runs", value: "101", note: "94.3% recovery" },
      { label: "Core boxes", value: "101", note: "recorded" },
      { label: "Samples", value: "7", note: "QC included" },
    ],
    synced: "The same record on the web. Nothing re-typed.",
  },
} as const;

export const workflow = {
  title: "Enter it once. Carry it forward.",
  intro:
    "Each step is recorded where the work happens and keeps what came before it. The laboratory result still knows its sample, depth and hole.",
  steps: [
    {
      n: "01",
      title: "Drill",
      text: "Hole, core boxes and runs, with recovery and RQD.",
      carries: ["Hole ID"],
    },
    {
      n: "02",
      title: "Log",
      text: "Depth intervals with the project's own code lists, and photos.",
      carries: ["Hole ID", "Depth"],
    },
    {
      n: "03",
      title: "Sample",
      text: "Numbers from the phone's own block or a tag book. QC inserted at the project's rate.",
      carries: ["Hole ID", "Depth", "Sample no."],
    },
    {
      n: "04",
      title: "Custody and dispatch",
      text: "Every hand-over recorded and never edited, then dispatched to the laboratory.",
      carries: ["Sample no.", "Dispatch"],
    },
    {
      n: "05",
      title: "Laboratory",
      text: "Receives the batch, assays it and uploads the results against it.",
      carries: ["Sample no.", "Result"],
    },
    {
      n: "06",
      title: "Lab QA/QC",
      text: "Standards, blanks and duplicates judged against the results.",
      carries: ["Result", "Decision"],
    },
  ],
  note: "Reviewers for core and logging, and for sampling and custody, check steps 01 to 04 as they happen, not only at the end.",
} as const;

export const roles = {
  title: "One workflow, different people.",
  intro: "A team is the people around one drill rig. Each person works on the part that is theirs.",
  items: [
    {
      where: "Android app",
      title: "Field geologist",
      text: "Logs core, photographs it, takes samples and hands them over, at the rig or the core yard, with or without signal.",
    },
    {
      where: "Web",
      title: "QA/QC",
      text: "Reviews the evidence for one stage: core and logging, sampling and custody, or laboratory assays.",
    },
    {
      where: "Web",
      title: "Laboratory",
      text: "Receives dispatched samples by scan, then uploads the results file for the batch.",
    },
    {
      where: "Web",
      title: "Resident / project manager",
      text: "Follows the team's holes, samples and activity, and keeps the code lists, standards and tags.",
    },
  ],
} as const;

export const field = {
  title: "Field logging that gives something back.",
  intro:
    "CoreChain Field is built for a geologist working alone, in sun and gloves. Every screen that takes an entry shows something back.",
  shots: [
    {
      src: "/landing/field-graphic-log.png",
      width: 720,
      height: 1282,
      alt: "Graphic hole log of CDL-001: lithology, alteration, mineralisation, recovery and RQD columns by depth.",
      title: "Graphic log",
      text: "The hole as it is logged: rock, alteration, minerals, recovery and RQD against depth.",
    },
    {
      src: "/landing/field-collar-map.png",
      width: 720,
      height: 931,
      alt: "Collar map of six drillholes on terrain contours, with each hole's planned direction.",
      title: "Collar map",
      text: "The project's holes on terrain, with their planned direction, and where you are standing.",
    },
    {
      src: "/landing/field-my-work.png",
      width: 720,
      height: 1282,
      alt: "My work: 1446.2 m of core logged in the last seven days, with samples and custody steps.",
      title: "My work",
      text: "What was logged, sampled and handed over, by day, from what is on the phone.",
    },
  ],
  offline: {
    title: "Keep working when the signal drops.",
    text: "Everything is saved on the phone first, in an encrypted database. Records wait, marked as waiting to send, and go up when there is signal again. Conflicting changes are shown for a choice, never silently overwritten.",
    src: "/landing/field-waiting-to-send.png",
    width: 720,
    height: 447,
    alt: "Two drillholes in the project list; CDL-001 is marked Waiting to send.",
  },
  points: [
    {
      title: "Built for gloves and glare",
      text: "Large targets, light and dark themes, and known depths offered as one tap, so a depth already entered is never typed twice.",
    },
    {
      title: "Sample numbers never repeat",
      text: "Each phone draws from its own block, or the geologist types the tag. A number is never issued twice or reused, even after a delete.",
    },
  ],
} as const;

export const sampleStory = {
  title: "Every sample has a story.",
  intro:
    "Open any sample on the web and its whole record is there, joined up from the phone and the laboratory. Here is one from the laboratory demo project.",
  number: "LQC-00005",
  sub: "QC-DDH-01 · 12.0–13.5 m · Field duplicate",
  rows: [
    { label: "Hole and depth", value: "QC-DDH-01, 12.0–13.5 m" },
    { label: "QC link", value: "Field duplicate of LQC-00001, split from the same interval" },
    { label: "Bagged", value: "By Maria Santos, field geologist" },
    { label: "Dispatched to lab", value: "In dispatch DSP-QC-01" },
    { label: "Received by laboratory", value: "By Ramon Cruz, checked in by scan" },
    { label: "Result", value: "Cu 1190 ppm · Zn 301 ppm, from the re-assay" },
  ],
  note: "When the hole has been logged, the geology at that depth and the core photos are shown with the sample too. QA/QC decisions are kept on the reviewer's page.",
  caption: "The sample page, simplified. Names and values from the laboratory demo project.",
} as const;

export const laboratory = {
  title: "The chain does not stop when the sample leaves the field.",
  intro:
    "The laboratory checks the batch in by scan, then uploads its results file. Problem rows are shown before anything is accepted.",
  steps: [
    "Samples are received by scan against the dispatch sheet. Anything missing is flagged.",
    "The results file is uploaded and its columns chosen: there is no single lab-certificate format.",
    "Rows that do not match a received sample, or have no value, are listed and left out.",
    "A re-assay is uploaded the same way. The latest result for each sample and element becomes the current one.",
  ],
  first: {
    label: "First results file",
    file: "DSP-QC-01-results-first-run.csv",
    ready: "7 results across 7 samples ready to import.",
    problems: [
      'Row 7, sample "LQC-0006": not a received sample on this dispatch',
      'Row 8, sample "LQC-00007": no result value in any selected column',
    ],
  },
  second: {
    label: "Re-assay",
    file: "DSP-QC-01-results-reassay.csv",
    ready: "9 results across 9 samples ready to import.",
    problems: [],
  },
  caption: "The laboratory's upload, simplified. Copper column selected. Values from the laboratory demo project.",
} as const;

export const qaqc = {
  title: "QA/QC happens at more than one hand-off.",
  intro:
    "Each reviewer owns one stage of the chain. CoreChain lays out the evidence; the reviewer decides to accept, hold or reject, with a note.",
  stages: [
    {
      n: "Stage 1",
      title: "Core and logging",
      text: "Gaps and overlaps between runs, recovery over 100%, and runs past the hole's final depth, while the hole is being worked.",
    },
    {
      n: "Stage 2",
      title: "Sampling and custody",
      text: "QC inserted below the project's rate, overlapping samples, and custody that has stalled, before the results come back.",
    },
    {
      n: "Stage 3",
      title: "Laboratory assays",
      text: "Standards, blanks and duplicates judged against the returned results.",
    },
  ],
  hole: "QC-DDH-01",
  holeSub: "Laboratory QA/QC sample (synthetic) · first results file",
  exceptions: [
    {
      title: "Standard OREAS 45e failed for Cu: LQC-00004",
      evidence:
        "LQC-00004: Cu 612 ppm, certified 742 ppm ± 20 (-6.5 SD). Outside the 3 SD limit of 682 to 802 ppm.",
    },
    {
      title: "Blank failed for Cu: LQC-00003",
      evidence:
        "LQC-00003: Cu 85 ppm, limit 10 ppm (Blank). Possible contamination during preparation; check the samples prepared just before it.",
    },
    {
      title: "Duplicate failed for Cu: LQC-00005 against LQC-00001",
      evidence:
        "LQC-00001 1240 ppm, duplicate LQC-00005 610 ppm: 68% apart, limit 30% for field duplicates. Check the splitting, or a nugget effect in this interval.",
    },
  ],
  checks: [
    {
      kind: "Standard",
      rule: "Warning beyond 2 SD. Fails beyond 3 SD, or on a second reading in a row beyond 2 SD on the same side.",
      before: "612 ppm · -6.5 SD",
      after: "749 ppm · +0.3 SD",
    },
    {
      kind: "Blank",
      rule: "Fails above the team's limit for that element.",
      before: "85 ppm · limit 10",
      after: "below 2 ppm",
    },
    {
      kind: "Duplicate",
      rule: "Fails when the pair is more than 30% apart.",
      before: "68% apart",
      after: "3% apart",
    },
  ],
  also: "Missing results are flagged once the laboratory marks a batch complete, and results in the wrong unit are flagged too.",
  caption: "The QA/QC review page, simplified. Values from the laboratory demo project, before and after its re-assay.",
} as const;

export const integrity = {
  title: "Built around the records a report has to stand on.",
  pmrc: "CoreChain is structured around the records the Philippine Mineral Reporting Code (PMRC 2020) asks a company to be able to demonstrate: recovery, logging, sampling, QA/QC and chain of custody. It supports that work; it does not replace the judgement of your Accredited Competent Person.",
  points: [
    {
      title: "No silent overwrite",
      text: "When two people change the same record, the conflict is shown for a choice instead of one quietly replacing the other.",
    },
    {
      title: "Custody is never edited",
      text: "A mistake in a hand-over is corrected with a new step. The original stays on the record.",
    },
    {
      title: "Every record has an author",
      text: "Each entry keeps who made it and when, and edits are versioned.",
    },
    {
      title: "Field work survives poor signal",
      text: "Records are kept on the phone until the server has them.",
    },
  ],
} as const;

export const status = {
  title: "Where the product stands.",
  intro:
    "CoreChain is in development testing and has not been released yet. This is what works in testing today.",
  rows: [
    {
      stage: "Field capture",
      what: "Holes, boxes, runs, logging, photographs, samples and QC, export to CSV",
      state: "Working in development testing",
      tone: "now",
    },
    {
      stage: "Accounts and backup",
      what: "Sign-in, encrypted storage, and cloud backup and sync of records and photos",
      state: "Working in development testing",
      tone: "now",
    },
    {
      stage: "Custody and dispatch",
      what: "Recorded hand-overs, dispatch batches, and PDF or CSV dispatch sheets",
      state: "Working in development testing",
      tone: "now",
    },
    {
      stage: "QA/QC review",
      what: "Three review stages: core and logging, sampling and custody, laboratory assays",
      state: "Working in development testing",
      tone: "now",
    },
    {
      stage: "Laboratory",
      what: "Receive dispatched samples, upload results, and flag problem rows before they are accepted",
      state: "Working in development testing",
      tone: "now",
    },
    {
      stage: "Manager dashboard",
      what: "The team's holes, samples and activity, code lists, standards and tags",
      state: "Working in development testing",
      tone: "now",
    },
  ],
} as const;

export const access = {
  title: "Bring CoreChain into the field.",
  intro:
    "Accounts are set up by us; there is no public sign-up. Tell us which of these fits, and we will reply.",
  routes: [
    {
      title: "Test CoreChain Field",
      text: "Try the field app on your own time with made-up data and tell us what gets in the way. Geologists, mining people and software people are all welcome. A few geologists have already signed up.",
      detail: "Android phones only. We set up your account and send you the install link.",
    },
    {
      title: "Discuss a pilot",
      text: "For an exploration or mining team that wants to see whether the workflow fits a real drilling programme.",
      detail: "We start with a conversation about your holes, your lab and how samples move today.",
    },
  ],
  formTitle: "Request access",
} as const;

export const finalCta = {
  title: "Your exploration record starts at the drillhole.",
  text: "Keep it connected all the way to the assay.",
  footer: "Core logging and sample traceability for exploration teams.",
} as const;

/** Every string above, for content.test.ts. */
export const allLandingCopy = {
  nav,
  hero,
  workflow,
  roles,
  field,
  sampleStory,
  laboratory,
  qaqc,
  integrity,
  status,
  access,
  finalCta,
};
