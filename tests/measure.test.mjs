import assert from 'node:assert/strict';
import test from 'node:test';
import { DIAGONALS } from '../scripts/core/cells.mjs';
import { defaultCellMeasure, defaultDistance, sceneRule } from '../scripts/adapters/measure.mjs';

const tokenAt = cells => ({ center: { x: 0, y: 0 }, document: { getOccupiedGridSpaceOffsets: () => cells } });

test('defaultCellMeasure uses the given rule and ignores bands', () => {
  const m = defaultCellMeasure(null, 5, DIAGONALS.EQUIDISTANT);
  assert.equal(m({ i: 0, j: 0 }, { i: 2, j: 2 }), 10);
  assert.equal(m.bandSensitive({ tone: 'reach', max: 10 }), false);
  assert.equal(defaultCellMeasure(null, 5, DIAGONALS.ALTERNATING_2)({ i: 0, j: 0 }, { i: 1, j: 1 }), 10);
});

test('sceneRule reads canvas.grid.diagonals, ALTERNATING_1 without a canvas', () => {
  assert.equal(sceneRule({ grid: { diagonals: DIAGONALS.EXACT } }), DIAGONALS.EXACT);
  assert.equal(sceneRule(null), DIAGONALS.ALTERNATING_1);
});

test('defaultDistance: edge-to-edge on square grids, centers elsewhere', () => {
  const square = { grid: { isSquare: true, distance: 5, diagonals: DIAGONALS.EQUIDISTANT } };
  const big = tokenAt([{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }, { i: 1, j: 1 }]);
  assert.equal(defaultDistance(big, tokenAt([{ i: 3, j: 3 }]), null, square), 10);
  assert.equal(defaultDistance(tokenAt([{ i: 0, j: 0 }]), tokenAt([{ i: 0, j: 1 }]), null, square), 5);
  const hex = { grid: { isSquare: false, measurePath: () => ({ distance: 42 }) } };
  assert.equal(defaultDistance(big, tokenAt([]), null, hex), 42);
  assert.ok(Number.isNaN(defaultDistance(big, big, null, null)));
});
