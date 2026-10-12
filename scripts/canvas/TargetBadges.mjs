/** Distance/penalty plates above target tokens. */
import { labelScale } from './RangeOverlay.mjs';
import { badgeText, classifyTargets } from '../core/targets.mjs';
import { bandStyle } from '../core/theme.mjs';
import { faFamily } from './geometry.mjs';
import { LABEL_Z_INDEX } from './RangeOverlay.mjs';

/** Font Awesome `eye-slash`. */
const EYE_SLASH = '\uf070';

export class TargetBadges {
  constructor({ parent, PIXI = globalThis.PIXI, makeText, settings }) {
    Object.assign(this, { PIXI, makeText, settings });
    this.container = new PIXI.Container();
    this.container.eventMode = 'none';
    // canvas.interface sorts by zIndex; stay above the token layer (200) so tokens' void meshes can't erase badges.
    this.container.zIndex = LABEL_Z_INDEX;
    parent.addChild(this.container);
  }

  destroy() { this.container.destroy({ children: true }); }

  draw(entries, { targets, zoom = 1, blockedFor = () => false, units = 'ft' }) {
    for (const child of this.container.removeChildren()) child.destroy({ children: true });
    const settings = this.settings();
    const stack = new Map();
    for (const entry of entries) {
      const { pin, token, adapter } = entry;
      if (pin.spec.kind === 'none') continue;
      const list = targets.filter(target => target.id !== token.id && target.id !== pin.tokenId);
      const results = classifyTargets({
        spec: pin.spec,
        targets: list.map(target => ({
          id: target.id,
          distance: adapter.distance(token, target, pin.spec),
          blocked: Boolean(settings.dimBehindWalls && blockedFor(entry, target))
        }))
      });
      results.forEach((result, k) => {
        const target = list[k];
        const level = stack.get(target.id) ?? 0;
        stack.set(target.id, level + 1);
        this.container.addChild(this.#badge(result, target, level, entry, settings, zoom, units));
      });
    }
  }

  #badge(result, target, level, { pin, tint }, settings, zoom, units) {
    const band = result.bandIndex === null ? null : pin.spec.bands[result.bandIndex];
    const s = band
      ? bandStyle({ tone: band.tone, index: result.bandIndex, palette: settings.palette, tint })
      : bandStyle({ tone: 'penalty-zone', palette: settings.palette });
    const plate = new this.PIXI.Container();
    const pad = 5;
    const parts = [];
    if (result.blocked) parts.push(this.makeText(EYE_SLASH, { fontFamily: faFamily(), fontWeight: '900', fontSize: 13, fill: s.text }));
    parts.push(this.makeText(badgeText({ ...result, mark: band?.mark ?? null }, units), { fontSize: 14, fill: s.text }));
    let x = pad;
    const height = Math.max(...parts.map(part => part.height));
    for (const part of parts) { part.position.set(x, pad / 2); x += part.width + 4; }
    const box = new this.PIXI.Graphics();
    box.beginFill(s.halo, pin.preview ? 0.6 : 0.85);
    box.lineStyle(2, s.line, 0.95);
    box.drawRoundedRect(0, 0, x - 4 + pad, height + pad, 7);
    box.endFill();
    plate.addChild(box, ...parts);
    const scale = labelScale(zoom) * settings.badgeScale;
    plate.scale.set(scale);
    const width = (x - 4 + pad) * scale, plateHeight = (height + pad) * scale;
    // x and y both from the rendered center so the plate doesn't drift while the token animates.
    const top = target.center.y - target.h / 2;
    plate.position.set(target.center.x - width / 2, top - (plateHeight + 4) * (level + 1));
    return plate;
  }
}
