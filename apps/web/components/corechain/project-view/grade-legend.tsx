import { formatGrade, type AnalyteOption, type GradeScale, type GradeState } from "@corechain/domain";
import { RAMP_GRADIENT } from "./colors";

/** The colour key under the 3D view: the grade ramp, then whichever other states are on screen. */
export function GradeLegend({
  analyte,
  scale,
  states,
}: {
  analyte: AnalyteOption | null;
  scale: GradeScale | null;
  states: ReadonlySet<GradeState>;
}) {
  return (
    <div className="pv-legend">
      {analyte && scale ? (
        <span className="pv-ramp">
          <span>
            {analyte.label} {formatGrade(scale.low, null)}
          </span>
          <i style={{ background: RAMP_GRADIENT }} aria-hidden="true" />
          <span>{formatGrade(scale.high, analyte.unit)}</span>
        </span>
      ) : null}
      {states.has("below_detection") ? (
        <span>
          <span className="pv-swatch is-below" aria-hidden="true" />
          Below detection
        </span>
      ) : null}
      {states.has("awaiting_results") ? (
        <span>
          <span className="pv-swatch is-awaiting" aria-hidden="true" />
          Waiting for results
        </span>
      ) : null}
      {states.has("not_analysed") || states.has("not_comparable") ? (
        <span>
          <span className="pv-swatch is-trace" aria-hidden="true" />
          No {analyte?.label ?? ""} result to plot (trace only)
        </span>
      ) : null}
      {analyte && scale ? (
        <span className="pv-legend-note">
          One scale for the whole project. The lowest and highest 5% of {analyte.label} results take
          the end colours
          {scale.belowLow + scale.aboveHigh > 0
            ? ` (${scale.belowLow} below, ${scale.aboveHigh} above)`
            : ""}
          , so one very high value doesn&apos;t wash out the rest. Standards and blanks are not drawn,
          and duplicates are not drawn twice.
        </span>
      ) : null}
    </div>
  );
}
