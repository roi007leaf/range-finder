/** Draws range bands: merged fills, outer outlines, edge labels, wall hatching, fade-in. */
import { bandCells, cellKey } from '../core/cells.mjs';
import { outline, rowRuns, topRightPoint } from '../core/outline.mjs';
import { bandStyle } from '../core/theme.mjs';

const FADE_MS = 150;
/** Above the token layer (zIndex 200) so neighbouring tokens' erase-blended void meshes don't cut the labels. */
export const LABEL_Z_INDEX = 1000;
const reducedMotion = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
const defaultFrame = () => (typeof globalThis.requestAnimationFrame === 'function' ? fn => globalThis.requestAnimationFrame(fn) : null);

const LABEL_FONT = 13;

/** Screen-constant label size: inverse of the canvas zoom. Scenes with large grids (e.g. 296 px) sit at
 *  zoom ~0.1–0.2, so the clamp is wide; it only guards against degenerate zoom values. */
export function labelScale(zoom = 1) {
  const z = Number(zoom) > 0 ? Number(zoom) : 1;
  return Math.min(12, Math.max(0.25, 1 / z));
}

export class RangeOverlay {
  /** Fade start time per pin key; survives the per-draw layer rebuild. */
  #fades = new Map();
  /** Current draw's layers per pin key: [fill layer, label layer]. */
  #layers = new Map();
  #frame = null;
  #cache = new Map();

  constructor({ parent, labelParent = parent, PIXI = globalThis.PIXI, makeText, settings, now = () => performance.now(), requestFrame = defaultFrame() }) {
    Object.assign(this, { PIXI, makeText, settings, now, requestFrame });
    this.container = new PIXI.Container();
    this.container.eventMode = 'none';
    parent.addChild(this.container);
    this.labels = new PIXI.Container();
    this.labels.eventMode = 'none';
    this.labels.zIndex = LABEL_Z_INDEX;
    labelParent.addChild(this.labels);
  }

  destroy() {
    this.container.destroy({ children: true });
    this.labels.destroy({ children: true });
    this.#cache.clear();
    this.#fades.clear();
    this.#layers.clear();
  }

  draw(entries, geo) {
    for (const child of this.container.removeChildren()) child.destroy({ children: true });
    for (const child of this.labels.removeChildren()) child.destroy({ children: true });
    const settings = this.settings();
    const time = this.now();
    const layers = new Map(), used = new Set();
    for (const entry of entries) {
      const layer = new this.PIXI.Container(), labelLayer = new this.PIXI.Container();
      this.#drawPin(layer, labelLayer, entry, geo, settings, used);
      this.container.addChild(layer);
      this.labels.addChild(labelLayer);
      const key = `${entry.pin.key}|${entry.pin.itemUuid}|${entry.pin.actionIndex}|${entry.pin.preview}`;
      if (!this.#fades.has(key)) this.#fades.set(key, time);
      layers.set(key, [...(layers.get(key) ?? []), layer, labelLayer]);
    }
    for (const key of this.#fades.keys()) if (!layers.has(key)) this.#fades.delete(key);
    this.#layers = layers;
    this.#applyFades(time);
    for (const key of this.#cache.keys()) if (!used.has(key)) this.#cache.delete(key);
  }

  /** Alpha from each key's fade start; one frame loop runs while any fade is unfinished. */
  #applyFades(time) {
    const reduced = reducedMotion();
    let pending = false;
    for (const [key, group] of this.#layers) {
      const alpha = reduced ? 1 : Math.min(1, Math.max(0, (time - this.#fades.get(key)) / FADE_MS));
      if (alpha < 1) pending = true;
      for (const layer of group) layer.alpha = alpha;
    }
    if (!pending || this.#frame !== null || !this.requestFrame) return;
    this.#frame = this.requestFrame(() => {
      this.#frame = null;
      if (this.container.destroyed) return;
      this.#applyFades(this.now());
    });
  }

  /** Cells and outlines per band, cached by spec object + origin cells + grid size. */
  #groups(spec, bands, which, origin, geo, adapter, used) {
    const key = `${which}|${origin.map(cellKey).join(';')}|${geo.size}|${geo.unit}`;
    let bySpec = this.#cache.get(spec);
    used.add(spec);
    if (!bySpec) { bySpec = new Map(); this.#cache.set(spec, bySpec); }
    if (!bySpec.has(key)) {
      const measure = adapter.cellMeasure(spec, geo.unit);
      // measure.bandSensitive (optional) lets bandCells measure once per cell and re-measure only where a band needs it.
      const groups = bandCells({ originCells: origin, bands, measure, unit: geo.unit, bounds: geo.bounds });
      bySpec.set(key, groups.map(cells => ({ cells, loops: outline(cells), runs: rowRuns(cells) })));
      for (const old of [...bySpec.keys()]) if (old !== key && old.startsWith(`${which}|`)) bySpec.delete(old);
    }
    return bySpec.get(key);
  }

  #drawPin(layer, labelLayer, { pin, token, adapter, tint, ownerName }, geo, settings, used) {
    const g = new this.PIXI.Graphics();
    layer.addChild(g);
    const { spec } = pin;
    const style = (band, index) => bandStyle({ tone: band.tone, index, palette: settings.palette, opacity: settings.bandOpacity, preview: pin.preview, tint });
    if (ownerName) this.#ownerLabel(labelLayer, `${ownerName} — ${spec.itemName}`, token, geo, style(spec.bands[0], 0));
    if (!geo.isSquare) return this.#drawRings(labelLayer, g, spec, token, geo, settings, style);
    const origin = geo.originCells(token);
    const blocked = settings.dimBehindWalls ? geo.losFor(token).cell : null;
    const paint = (bands, which) => {
      const groups = this.#groups(spec, bands, which, origin, geo, adapter, used);
      groups.forEach(({ cells, loops, runs }, index) => {
        if (!cells.length) return;
        const band = bands[index];
        const overlay = which === 'overlays';
        const s = style(band, overlay ? 0 : index);
        if (!overlay && settings.bandStyle !== 'outline') {
          if (blocked) {
            const open = [], shut = [];
            for (const cell of cells) (blocked(cell) ? shut : open).push(cell);
            this.#fill(g, rowRuns(open), s.fill, s.fillAlpha, geo);
            this.#fill(g, rowRuns(shut), s.fill, s.fillAlpha * 0.4, geo);
            this.#hatch(g, shut, s.line, 0.5, geo);
          } else {
            this.#fill(g, runs, s.fill, s.fillAlpha, geo);
          }
        }
        if (overlay && band.tone === 'penalty-zone') this.#hatch(g, cells, s.fill, 0.45, geo);
        if (overlay || settings.bandStyle !== 'fill') this.#stroke(g, loops, s, geo);
        if (settings.showLabels) this.#label(labelLayer, band.label, topRightPoint(loops), s, geo);
      });
    };
    paint(spec.bands, 'bands');
    if (spec.overlays.length) paint(spec.overlays, 'overlays');
  }

  #fill(g, runs, color, alpha, geo) {
    if (!runs.length) return;
    g.beginFill(color, alpha);
    for (const { i, j0, j1 } of runs) {
      const a = geo.topLeft(i, j0), b = geo.topLeft(i + 1, j1 + 1);
      g.drawRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    g.endFill();
  }

  #hatch(g, cells, color, alpha, geo) {
    if (!cells.length) return;
    const size = geo.size;
    g.lineStyle(1, color, alpha);
    for (const { i, j } of cells) {
      const { x, y } = geo.topLeft(i, j);
      g.moveTo(x, y + size); g.lineTo(x + size, y);
      g.moveTo(x, y + size / 2); g.lineTo(x + size / 2, y);
      g.moveTo(x + size / 2, y + size); g.lineTo(x + size, y + size / 2);
    }
    g.lineStyle(0);
  }

  #stroke(g, loops, s, geo) {
    const trace = () => {
      for (const loop of loops) {
        if (loop.length < 3) continue;
        const points = loop.map(point => geo.topLeft(point.y, point.x));
        g.moveTo(points[0].x, points[0].y);
        for (const p of points.slice(1)) g.lineTo(p.x, p.y);
        g.closePath();
      }
    };
    g.lineStyle({ width: s.lineWidth + 2, color: s.halo, alpha: 0.45, join: 'round' });
    trace();
    g.lineStyle({ width: s.lineWidth, color: s.line, alpha: s.lineAlpha, join: 'round' });
    trace();
    g.lineStyle(0);
  }

  #pill(text, s, geo) {
    const label = this.makeText(text, { fontSize: LABEL_FONT, fill: s.text });
    const pad = 4;
    const box = new this.PIXI.Graphics();
    box.beginFill(s.halo, 0.75);
    box.lineStyle(1, s.line, 0.9);
    box.drawRoundedRect(0, 0, label.width + pad * 2, label.height + pad, 6);
    box.endFill();
    label.position.set(pad, pad / 2);
    const pill = new this.PIXI.Container();
    pill.addChild(box, label);
    // Keep labels the same size on screen at any zoom (clamped so they never swamp the map).
    pill.scale.set(labelScale(geo.zoom));
    return pill;
  }

  #label(layer, text, point, s, geo) {
    if (!point || !text) return;
    const corner = geo.topLeft(point.y, point.x);
    const pill = this.#pill(text, s, geo);
    pill.position.set(corner.x - pill.width - 4, corner.y + 4);
    layer.addChild(pill);
  }

  #ownerLabel(layer, text, token, geo, s) {
    const pill = this.#pill(text, s, geo);
    const center = geo.center(token);
    pill.position.set(center.x - pill.width / 2, center.y - geo.tokenRadius(token) - pill.height - 6);
    layer.addChild(pill);
  }

  #drawRings(layer, g, spec, token, geo, settings, style) {
    const { x, y } = geo.center(token);
    const base = geo.tokenRadius(token);
    const ring = (band, index, overlay) => {
      const s = style(band, overlay ? 0 : index);
      const inner = base + band.min * geo.pxPerFoot, outer = base + band.max * geo.pxPerFoot;
      if (!overlay && settings.bandStyle !== 'outline') {
        g.beginFill(s.fill, s.fillAlpha);
        g.drawCircle(x, y, outer);
        if (band.min > 0) { g.beginHole(); g.drawCircle(x, y, inner); g.endHole(); }
        g.endFill();
      }
      if (overlay || settings.bandStyle !== 'fill') {
        g.lineStyle({ width: s.lineWidth + 2, color: s.halo, alpha: 0.45 });
        g.drawCircle(x, y, outer);
        g.lineStyle({ width: s.lineWidth, color: s.line, alpha: s.lineAlpha });
        g.drawCircle(x, y, outer);
        g.lineStyle(0);
      }
      if (settings.showLabels) {
        const pill = this.#pill(band.label, s, geo);
        pill.position.set(x + outer * Math.SQRT1_2 - pill.width, y - outer * Math.SQRT1_2);
        layer.addChild(pill);
      }
    };
    spec.bands.forEach((band, index) => ring(band, index, false));
    spec.overlays.forEach((band, index) => ring(band, index, true));
  }
}
