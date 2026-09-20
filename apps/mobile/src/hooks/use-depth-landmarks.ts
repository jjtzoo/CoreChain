import {
  depthLandmarks,
  type DepthLandmark,
  type LandmarkContext,
  type LandmarkKind,
} from '@corechain/domain';
import { useEffect, useState } from 'react';

import { listBoxes, listRuns } from '@/data/coreRepository';
import { getDrillhole } from '@/data/drillholesRepository';
import { listIntervals } from '@/data/intervalsRepository';
import { listHoleSamples } from '@/data/samplesRepository';

const NONE: LandmarkContext = {
  runs: [],
  boxes: [],
  intervals: [],
  samples: [],
};

/**
 * The depths already known on a hole that the record being entered could end at
 * (design principle P1: capture once, derive everywhere): the next run, box,
 * logged or sampled end below `fromText`, and the hole's planned depth. Loaded
 * once per hole; recomputed as the start depth changes. Empty until the hole's
 * records have loaded, and when the start depth isn't a number yet.
 */
export function useDepthLandmarks(
  drillholeId: string | null | undefined,
  fromText: string,
  entering: Exclude<LandmarkKind, 'hole'>,
): DepthLandmark[] {
  const [context, setContext] = useState<LandmarkContext>(NONE);

  useEffect(() => {
    if (!drillholeId) return;
    let cancelled = false;
    (async () => {
      const [runs, boxes, intervals, samples, hole] = await Promise.all([
        listRuns(drillholeId),
        listBoxes(drillholeId),
        listIntervals(drillholeId),
        listHoleSamples(drillholeId),
        getDrillhole(drillholeId),
      ]);
      if (cancelled) return;
      setContext({
        runs,
        boxes,
        intervals,
        samples: samples.filter(
          (sample): sample is typeof sample & { fromM: number; toM: number } =>
            sample.fromM != null && sample.toM != null,
        ) as LandmarkContext['samples'],
        plannedDepthM: hole?.plannedDepthM ?? null,
      });
    })().catch(() => {
      // Shortcuts are a convenience: if they can't load, the form works without them.
    });
    return () => {
      cancelled = true;
    };
  }, [drillholeId]);

  const from = fromText.trim().length > 0 ? Number(fromText) : Number.NaN;
  return depthLandmarks(context, from, entering);
}
