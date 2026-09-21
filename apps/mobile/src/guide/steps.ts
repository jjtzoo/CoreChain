// Sprint 6, E10-1: the field-geologist first-run guide. A practice project
// walks a new geologist through the whole field chain — a hole, a box, a
// logged interval, a sample and the export — on data they can delete
// afterwards. Wording is a first draft; the plan calls for a friendly
// geologist's review before the field test (see the sprint plan, Sprint 6).

export type GuideStepKey =
  | 'welcome'
  | 'open-hole-list'
  | 'new-drillhole'
  | 'add-box'
  | 'log-interval'
  | 'add-sample'
  | 'export'
  | 'done';

export type GuideStep = {
  key: GuideStepKey;
  /** Steps with no coachmark (the Home prompt and the finish) are not listed here. */
  title: string;
  body: string;
};

export const GUIDE_STEPS: readonly GuideStepKey[] = [
  'welcome',
  'open-hole-list',
  'new-drillhole',
  'add-box',
  'log-interval',
  'add-sample',
  'export',
  'done',
];

export const GUIDE_STEP_CONTENT: Record<
  Exclude<GuideStepKey, 'welcome' | 'done'>,
  GuideStep
> = {
  'open-hole-list': {
    key: 'open-hole-list',
    title: 'Add your first drillhole',
    body: 'Every hole starts here. Tap New drillhole to record its ID and collar.',
  },
  'new-drillhole': {
    key: 'new-drillhole',
    title: 'Give this hole an ID and its collar',
    body: 'Type a hole ID, then set the collar from GPS or by typing coordinates. Azimuth and dip are optional here — fill them in when you know them.',
  },
  'add-box': {
    key: 'add-box',
    title: 'Register a core box',
    body: 'A box holds a depth range of core. Its number and starting depth are filled in for you; set where it ends.',
  },
  'log-interval': {
    key: 'log-interval',
    title: 'Log what you saw',
    body: 'Record lithology, alteration and mineralisation for a depth range. This is the graphic log your Home screen will show.',
  },
  'add-sample': {
    key: 'add-sample',
    title: 'Take a sample',
    body: 'The sample number is filled in from this phone’s own block. Set the depth range it covers, then save it.',
  },
  export: {
    key: 'export',
    title: 'See it exported',
    body: 'Every table you just filled in is here as a CSV, ready to share. This is what leaves the phone.',
  },
};

export function stepIndex(step: GuideStepKey): number {
  return GUIDE_STEPS.indexOf(step);
}

export const TOTAL_GUIDE_STEPS = GUIDE_STEPS.length;

export function nextStep(step: GuideStepKey): GuideStepKey {
  const index = stepIndex(step);
  return GUIDE_STEPS[Math.min(index + 1, GUIDE_STEPS.length - 1)];
}
