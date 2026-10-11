import assert from 'node:assert/strict';
import test from 'node:test';
import { outline, rowRuns, topRightPoint } from '../scripts/core/outline.mjs';

const sortPts = pts => pts.map(p => `${p.x},${p.y}`).sort();

test('single cell → one 4-point loop', () => {
  const loops = outline([{ i: 2, j: 3 }]);
  assert.equal(loops.length, 1);
  assert.deepEqual(sortPts(loops[0]), ['3,2', '3,3', '4,2', '4,3']);
});

test('L shape → one 6-point loop', () => {
  const loops = outline([{ i: 0, j: 0 }, { i: 1, j: 0 }, { i: 1, j: 1 }]);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 6);
});

test('ring (3x3 minus center) → outer and hole loops', () => {
  const cells = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!(i === 1 && j === 1)) cells.push({ i, j });
  const loops = outline(cells);
  assert.equal(loops.length, 2);
  assert.deepEqual(loops.map(l => l.length).sort(), [4, 4]);
  assert.ok(loops.some(l => sortPts(l).join() === ['0,0', '0,3', '3,0', '3,3'].join()));
  assert.ok(loops.some(l => sortPts(l).join() === ['1,1', '1,2', '2,1', '2,2'].join()));
});

test('diagonal pinch still yields closed loops', () => {
  const loops = outline([{ i: 0, j: 0 }, { i: 1, j: 1 }]);
  assert.equal(loops.reduce((n, l) => n + l.length, 0), 8);
  assert.ok(loops.every(l => l.length >= 4));
});

test('empty input', () => {
  assert.deepEqual(outline([]), []);
  assert.equal(topRightPoint([]), null);
});

test('rowRuns merges contiguous columns', () => {
  assert.deepEqual(rowRuns([{ i: 1, j: 1 }, { i: 0, j: 3 }, { i: 0, j: 0 }, { i: 0, j: 1 }]), [
    { i: 0, j0: 0, j1: 1 }, { i: 0, j0: 3, j1: 3 }, { i: 1, j0: 1, j1: 1 }
  ]);
});

test('topRightPoint', () => {
  assert.deepEqual(topRightPoint(outline([{ i: 2, j: 3 }])), { x: 4, y: 2 });
});
