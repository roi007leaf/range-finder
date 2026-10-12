/** Default measuring for adapters without their own rules: the scene's diagonal rule, edge-to-edge tokens. */
import { DIAGONALS, diagonalDistance, edgeDistance } from '../core/cells.mjs';

export const sceneRule = (c = globalThis.canvas) => c?.grid?.diagonals ?? DIAGONALS.ALTERNATING_1;

export function defaultCellMeasure(_spec, unit = 5, rule = sceneRule()) {
  return Object.assign((from, to) => diagonalDistance(from, to, unit, rule), { bandSensitive: () => false });
}

/** Square grids: closest occupied cells (large tokens match the bands). Hex/gridless: center to center. */
export function defaultDistance(source, target, _spec, c = globalThis.canvas) {
  const grid = c?.grid;
  if (!grid || !source || !target) return NaN;
  if (grid.isSquare) {
    const a = source.document?.getOccupiedGridSpaceOffsets?.();
    const b = target.document?.getOccupiedGridSpaceOffsets?.();
    if (a?.length && b?.length) return edgeDistance(a, b, grid.distance, grid.diagonals);
  }
  if (!grid.measurePath || !source.center || !target.center) return NaN;
  return grid.measurePath([source.center, target.center]).distance;
}
