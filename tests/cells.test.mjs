import assert from 'node:assert/strict';
import test from 'node:test';
import { alternatingDistance, bandCells, cellKey, chebyshevDistance } from '../scripts/core/cells.mjs';
import { incrementBands, singleBand } from '../scripts/core/spec.mjs';

const plain = (a, b) => alternatingDistance(a, b, 5);

test('distances', () => {
  assert.equal(alternatingDistance({ i: 0, j: 0 }, { i: 0, j: 1 }), 5);
  assert.equal(alternatingDistance({ i: 0, j: 0 }, { i: 1, j: 1 }), 5);
  assert.equal(alternatingDistance({ i: 0, j: 0 }, { i: 2, j: 2 }), 15);
  assert.equal(alternatingDistance({ i: 0, j: 0 }, { i: 3, j: 3 }), 20);
  assert.equal(chebyshevDistance({ i: 0, j: 0 }, { i: 3, j: 2 }), 15);
  assert.equal(cellKey({ i: 2, j: 7 }), '2,7');
});

test('1x1 token, two 10 ft bands, alternating diagonals', () => {
  const [near, far] = bandCells({ originCells: [{ i: 10, j: 10 }], bands: incrementBands(10, 20), measure: plain });
  assert.equal(near.length, 20);
  assert.equal(far.length, 40);
  assert.ok(!near.some(c => c.i === 10 && c.j === 10));
  assert.ok(far.some(c => c.i === 12 && c.j === 12));
});

test('2x2 token excludes its own cells', () => {
  const origin = [{ i: 5, j: 5 }, { i: 5, j: 6 }, { i: 6, j: 5 }, { i: 6, j: 6 }];
  const [ring] = bandCells({ originCells: origin, bands: singleBand(5), measure: plain });
  assert.equal(ring.length, 12);
});

test('bounds clip to the scene grid', () => {
  const [cells] = bandCells({ originCells: [{ i: 0, j: 0 }], bands: singleBand(5), measure: plain, bounds: { rows: 10, cols: 10 } });
  assert.equal(cells.length, 3);
});

test('per-band measure override (PF2e reach 10 diagonal)', () => {
  const reach10 = (a, b, band) => {
    if (band.tone === 'reach' && band.max === 10 && Math.abs(a.i - b.i) === 2 && Math.abs(a.j - b.j) === 2) return 10;
    return plain(a, b);
  };
  const band = singleBand(10, 'reach', 'Reach 10 ft');
  assert.equal(bandCells({ originCells: [{ i: 5, j: 5 }], bands: band, measure: reach10 })[0].length, 24);
  assert.equal(bandCells({ originCells: [{ i: 5, j: 5 }], bands: singleBand(10), measure: reach10 })[0].length, 20);
});

test('empty origin or bands', () => {
  assert.deepEqual(bandCells({ originCells: [], bands: singleBand(5), measure: plain }), [[]]);
  assert.deepEqual(bandCells({ originCells: [{ i: 0, j: 0 }], bands: [], measure: plain }), []);
});

test('600 ft longbow stays bounded and fast', () => {
  const started = Date.now();
  const groups = bandCells({ originCells: [{ i: 10, j: 10 }], bands: incrementBands(100, 600), measure: plain, unit: 5, bounds: { rows: 300, cols: 300 } });
  const cells = groups.flat();
  assert.ok(cells.length > 10000);
  assert.ok(cells.every(c => c.i >= 0 && c.i < 300 && c.j >= 0 && c.j < 300), 'cells outside the scene grid');
  assert.ok(cells.every(c => c.i <= 130 && c.j <= 130), 'cells beyond 600 ft');
  assert.ok(Date.now() - started < 3000, 'banding took too long');
});
