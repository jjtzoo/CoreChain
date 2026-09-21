import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { dismissGuide, setGuideStep, completeGuide } from '@/data/guideRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useGuide } from '@/guide/guide-context';
import {
  GUIDE_STEP_CONTENT,
  nextStep,
  stepIndex,
  TOTAL_GUIDE_STEPS,
  type GuideStepKey,
} from '@/guide/steps';

/**
 * Shows this screen's coachmark when the guide is on this exact step, for
 * the practice project it started on. `onAdvance` fires once the geologist
 * has actually done the real thing this step asks for (created the hole,
 * saved the box, and so on) — the coachmark's own "Got it" only hides the
 * tip for this visit, it does not by itself move the guide along.
 */
export function useGuideStep(step: GuideStepKey, projectId: string | null) {
  const router = useRouter();
  const { progress, reload } = useGuide();
  const [hidden, setHidden] = useState(false);
  useFocusReload(
    useCallback(() => {
      setHidden(false);
      reload();
    }, [reload]),
  );

  const active =
    progress?.currentStep === step &&
    progress.practiceProjectId != null &&
    progress.practiceProjectId === projectId;

  async function advance() {
    const next = nextStep(step);
    if (next === 'done') {
      await completeGuide();
    } else {
      await setGuideStep(next);
    }
    reload();
  }

  async function skip() {
    await dismissGuide();
    reload();
    router.replace('/');
  }

  if (!active || step === 'welcome' || step === 'done') {
    return { visible: false as const, advance, skip };
  }

  return {
    visible: !hidden,
    hide: () => setHidden(true),
    step: GUIDE_STEP_CONTENT[step],
    stepNumber: stepIndex(step) + 1,
    totalSteps: TOTAL_GUIDE_STEPS,
    advance,
    skip,
  };
}
