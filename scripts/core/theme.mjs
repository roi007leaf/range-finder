/** Colors per semantic tone. Adapters never pick colors. Pure — no Foundry globals. */
export const PALETTES = {
  default: {
    ramp: [0x2ec4b6, 0x8ac926, 0xffca3a, 0xff924c, 0xe76f51, 0xb5432a],
    reach: 0x5b8def, penalty: 0xe63946, boost: 0xb388ff, halo: 0x0b0f14, text: 0xf5f7fa
  },
  colorblind: {
    ramp: [0x0072b2, 0x56b4e9, 0x009e73, 0xf0e442, 0xe69f00, 0xd55e00],
    reach: 0xcc79a7, penalty: 0xd55e00, boost: 0xbbbbbb, halo: 0x000000, text: 0xffffff
  }
};

/** Fill alpha of a boost band ("only with Reach Spell"): light, the outline and hatch carry it. */
const BOOST_FILL = 0.05;

const clamp01 = value => Math.min(1, Math.max(0, value));

export function bandStyle({ tone, index = 0, palette = 'default', opacity = 1, preview = false, tint = null }) {
  const colors = PALETTES[palette] ?? PALETTES.default;
  const color = tone === 'reach' ? colors.reach
    : tone === 'penalty-zone' ? colors.penalty
    : tone === 'boost' ? colors.boost
    : colors.ramp[Math.min(index, colors.ramp.length - 1)];
  const baseFill = tone === 'penalty-zone' ? 0.12 : tone === 'boost' ? BOOST_FILL : Math.max(0.06, 0.18 - 0.02 * index);
  return {
    fill: color,
    line: tint ?? color,
    fillAlpha: clamp01(baseFill * opacity * (preview ? 0.5 : 1)),
    lineAlpha: clamp01((preview ? 0.6 : 0.95) * Math.min(1, opacity)),
    lineWidth: preview ? 1.5 : 2,
    halo: colors.halo,
    text: colors.text
  };
}
