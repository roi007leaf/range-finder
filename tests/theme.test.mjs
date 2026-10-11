import assert from 'node:assert/strict';
import test from 'node:test';
import { PALETTES, bandStyle } from '../scripts/core/theme.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('base band is teal at 18%', () => {
  const s = bandStyle({ tone: 'base' });
  assert.equal(s.fill, PALETTES.default.ramp[0]);
  near(s.fillAlpha, 0.18);
  assert.equal(s.lineWidth, 2);
});

test('increments shift color and fade, clamped', () => {
  const s3 = bandStyle({ tone: 'increment', index: 3 });
  assert.equal(s3.fill, PALETTES.default.ramp[3]);
  near(s3.fillAlpha, 0.12);
  near(bandStyle({ tone: 'increment', index: 9 }).fillAlpha, 0.06);
  assert.equal(bandStyle({ tone: 'increment', index: 9 }).fill, PALETTES.default.ramp[5]);
});

test('reach, penalty zone, palette, preview, tint, opacity', () => {
  assert.equal(bandStyle({ tone: 'reach' }).fill, PALETTES.default.reach);
  assert.equal(bandStyle({ tone: 'penalty-zone' }).fill, PALETTES.default.penalty);
  assert.equal(bandStyle({ tone: 'base', palette: 'colorblind' }).fill, PALETTES.colorblind.ramp[0]);
  assert.equal(bandStyle({ tone: 'base', palette: 'missing' }).fill, PALETTES.default.ramp[0]);
  near(bandStyle({ tone: 'base', preview: true }).fillAlpha, 0.09);
  assert.ok(bandStyle({ tone: 'base', preview: true }).lineAlpha < bandStyle({ tone: 'base' }).lineAlpha);
  assert.equal(bandStyle({ tone: 'base', tint: 0xff0000 }).line, 0xff0000);
  near(bandStyle({ tone: 'base', opacity: 1.5 }).fillAlpha, 0.27);
});
