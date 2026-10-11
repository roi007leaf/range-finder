/** Which grid cells fall in which range band. Pure — no Foundry globals. */
import { inBand } from './spec.mjs';

export const cellKey = ({ i, j }) => `${i},${j}`;

/** Square grid, diagonals alternate 5/10/5 (PF2e and Foundry's default rule). */
export function alternatingDistance(a, b, unit = 5) {
  const di = Math.abs(a.i - b.i), dj = Math.abs(a.j - b.j);
  return unit * (Math.max(di, dj) + Math.floor(Math.min(di, dj) / 2));
}

export function chebyshevDistance(a, b, unit = 5) {
  return unit * Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
}

export function bandCells({ originCells, bands, measure, unit = 5, bounds = null }) {
  const groups = bands.map(() => []);
  if (!originCells?.length || !bands.length) return groups;
  const steps = Math.ceil(Math.max(...bands.map(band => band.max)) / unit);
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
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      if (occupied.has(`${i},${j}`)) continue;
      const cell = { i, j };
      for (let b = 0; b < bands.length; b++) {
        let distance = Infinity;
        for (const origin of originCells) distance = Math.min(distance, measure(origin, cell, bands[b]));
        if (inBand(bands[b], distance)) { groups[b].push(cell); break; }
      }
    }
  }
  return groups;
}
