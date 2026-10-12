/** Which grid cells fall in which range band. Pure — no Foundry globals. */
import { inBand } from './spec.mjs';

export const cellKey = ({ i, j }) => `${i},${j}`;

/** Foundry's CONST.GRID_DIAGONALS values (v14 common/constants.mjs). */
export const DIAGONALS = Object.freeze({ EQUIDISTANT: 0, EXACT: 1, APPROXIMATE: 2, RECTILINEAR: 3, ALTERNATING_1: 4, ALTERNATING_2: 5, ILLEGAL: 6 });

/** Cell-to-cell distance under a grid diagonal rule; mirrors SquareGrid#measurePath for 2D offsets. */
export function diagonalDistance(a, b, unit = 5, rule = DIAGONALS.ALTERNATING_1) {
  const di = Math.abs(a.i - b.i), dj = Math.abs(a.j - b.j);
  const straight = Math.max(di, dj), diagonal = Math.min(di, dj);
  switch (rule) {
    case DIAGONALS.EQUIDISTANT: return unit * straight;
    case DIAGONALS.EXACT: return unit * (straight + (Math.SQRT2 - 1) * diagonal);
    case DIAGONALS.APPROXIMATE: return unit * (straight + 0.5 * diagonal);
    case DIAGONALS.RECTILINEAR:
    case DIAGONALS.ILLEGAL: return unit * (di + dj);
    case DIAGONALS.ALTERNATING_2: return unit * (straight + Math.ceil(diagonal / 2));
    case DIAGONALS.ALTERNATING_1:
    default: return unit * (straight + Math.floor(diagonal / 2));
  }
}

/** Square grid, diagonals alternate 5/10/5 (PF2e's rule). */
export function alternatingDistance(a, b, unit = 5) {
  return diagonalDistance(a, b, unit, DIAGONALS.ALTERNATING_1);
}

export function chebyshevDistance(a, b, unit = 5) {
  return diagonalDistance(a, b, unit, DIAGONALS.EQUIDISTANT);
}

/** Edge-to-edge distance between two tokens: the closest pair of their occupied cells. */
export function edgeDistance(aCells, bCells, unit = 5, rule = DIAGONALS.ALTERNATING_1) {
  let best = Infinity;
  for (const a of aCells ?? []) for (const b of bCells ?? []) best = Math.min(best, diagonalDistance(a, b, unit, rule));
  return best === Infinity ? NaN : best;
}

/**
 * Group the cells around `originCells` by the first band they fall in.
 * `measure(from, to, band)` may carry a `bandSensitive(band)` predicate: then each cell is measured once
 * (band-independent, `measure(from, to)`) and re-measured only for bands the predicate flags.
 * `measure.pad` (optional) widens the scanned window by that many cells, for measures where a cell N units
 * away sits more than N/unit cells out (Crucible's base-to-base: an adjacent cell is 0).
 */
export function bandCells({ originCells, bands, measure, unit = 5, bounds = null }) {
  const groups = bands.map(() => []);
  if (!originCells?.length || !bands.length) return groups;
  const pad = Math.max(0, Math.ceil(Number(measure.pad) || 0));
  const steps = Math.ceil(Math.max(...bands.map(band => band.max)) / unit) + pad;
  let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
  for (const { i, j } of originCells) {
    i0 = Math.min(i0, i); i1 = Math.max(i1, i);
    j0 = Math.min(j0, j); j1 = Math.max(j1, j);
  }
  i0 -= steps; i1 += steps; j0 -= steps; j1 += steps;
  if (bounds) {
    i0 = Math.max(i0, 0); j0 = Math.max(j0, 0);
    i1 = Math.min(i1, bounds.rows - 1); j1 = Math.min(j1, bounds.cols - 1);
  }
  const occupied = new Set(originCells.map(cellKey));
  const nearest = (cell, band) => {
    let distance = Infinity;
    for (const origin of originCells) distance = Math.min(distance, measure(origin, cell, band));
    return distance;
  };
  const sensitive = typeof measure.bandSensitive === 'function' ? bands.map(band => Boolean(measure.bandSensitive(band))) : null;
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      if (occupied.has(`${i},${j}`)) continue;
      const cell = { i, j };
      const base = sensitive ? nearest(cell) : null;
      for (let b = 0; b < bands.length; b++) {
        const distance = sensitive && !sensitive[b] ? base : nearest(cell, bands[b]);
        if (inBand(bands[b], distance, b === 0)) { groups[b].push(cell); break; }
      }
    }
  }
  return groups;
}
