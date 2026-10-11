/** Merge a band's cells into outline loops and fill runs. Pure — no Foundry globals. */
import { cellKey } from './cells.mjs';

/** Remove points that sit on a straight line between their neighbours. */
function simplify(points) {
  const n = points.length;
  return points.filter((p, k) => {
    const a = points[(k - 1 + n) % n], b = points[(k + 1) % n];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/** At a pinch point (two cells touching diagonally) take the sharpest right turn (screen y-down). */
function pickTurn(current, candidates) {
  const dx = current.x2 - current.x1, dy = current.y2 - current.y1;
  let best = candidates[0], bestCross = -Infinity;
  for (const edge of candidates) {
    const cross = dx * (edge.y2 - edge.y1) - dy * (edge.x2 - edge.x1);
    if (cross > bestCross) { bestCross = cross; best = edge; }
  }
  return best;
}

export function outline(cells) {
  const set = new Set(cells.map(cellKey));
  const has = (i, j) => set.has(`${i},${j}`);
  const edges = new Map();
  const add = (x1, y1, x2, y2) => {
    const key = `${x1},${y1}`;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push({ x1, y1, x2, y2, used: false });
  };
  // Clockwise on screen (y down): interior is always on the right of each edge.
  for (const { i, j } of cells) {
    if (!has(i - 1, j)) add(j, i, j + 1, i);
    if (!has(i, j + 1)) add(j + 1, i, j + 1, i + 1);
    if (!has(i + 1, j)) add(j + 1, i + 1, j, i + 1);
    if (!has(i, j - 1)) add(j, i + 1, j, i);
  }
  const loops = [];
  for (const list of edges.values()) {
    for (const start of list) {
      if (start.used) continue;
      const points = [];
      let edge = start;
      while (edge && !edge.used) {
        edge.used = true;
        points.push({ x: edge.x1, y: edge.y1 });
        const next = (edges.get(`${edge.x2},${edge.y2}`) ?? []).filter(candidate => !candidate.used);
        edge = next.length > 1 ? pickTurn(edge, next) : next[0];
      }
      loops.push(simplify(points));
    }
  }
  return loops;
}

export function rowRuns(cells) {
  const rows = new Map();
  for (const { i, j } of cells) {
    if (!rows.has(i)) rows.set(i, []);
    rows.get(i).push(j);
  }
  const runs = [];
  for (const i of [...rows.keys()].sort((a, b) => a - b)) {
    const columns = rows.get(i).sort((a, b) => a - b);
    let start = columns[0], previous = columns[0];
    for (const j of columns.slice(1)) {
      if (j === previous + 1) { previous = j; continue; }
      runs.push({ i, j0: start, j1: previous });
      start = previous = j;
    }
    runs.push({ i, j0: start, j1: previous });
  }
  return runs;
}

export function topRightPoint(loops) {
  let best = null;
  for (const loop of loops) for (const point of loop) if (!best || point.x - point.y > best.x - best.y) best = point;
  return best;
}
