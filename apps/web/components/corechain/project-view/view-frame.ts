import { scaleBarMetres, type ProjectViewLayout } from "@corechain/domain";

type Bounds = NonNullable<ProjectViewLayout<unknown>["bounds"]>;

/** The widest extent of the view in metres: across, along or down (never under 20 m). */
export function viewSpan(bounds: Bounds): number {
  return Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxDown, 20);
}

/** A round grid square, about a sixth of the view (5 m, 20 m, 50 m, 100 m...). */
export function gridCellMetres(bounds: Bounds): number {
  return scaleBarMetres(viewSpan(bounds) / 6);
}
