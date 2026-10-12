export const MODULE_ID = 'range-finder';

const choices = (key, values) => Object.fromEntries(values.map(value => [value, `RANGE_FINDER.Settings.${key}.Choices.${value}`]));

export const SETTINGS = {
  bandStyle: { scope: 'client', type: String, default: 'both', choices: choices('bandStyle', ['fill', 'outline', 'both']) },
  bandOpacity: { scope: 'client', type: Number, default: 1, range: { min: 0.3, max: 1.5, step: 0.1 } },
  showLabels: { scope: 'client', type: Boolean, default: true },
  badgeScale: { scope: 'client', type: Number, default: 1, range: { min: 0.6, max: 1.6, step: 0.1 } },
  palette: { scope: 'client', type: String, default: 'default', choices: choices('palette', ['default', 'colorblind']) },
  dimBehindWalls: { scope: 'client', type: Boolean, default: false },
  ghostMode: { scope: 'client', type: String, default: 'fade', choices: choices('ghostMode', ['fade', 'minimize', 'off']) },
  ghostPersistentHud: { scope: 'client', type: Boolean, default: false },
  allowSharing: { scope: 'world', type: Boolean, default: true },
  badgesCombatOnly: { scope: 'world', type: Boolean, default: false },
  rangeField: { scope: 'world', type: String, default: '' },
  tokenHudButton: { scope: 'client', type: Boolean, default: true },
  genericSheetRows: { scope: 'client', type: Boolean, default: true }
};

// Foundry localizes setting names, hints and choices itself, so the default localize is the identity.
const BUILT_IN_SYSTEMS = new Set(['pf2e', 'sf2e', 'dnd5e', 'daggerheart', 'draw-steel', 'crucible']);

// The range field is only for systems without a built-in adapter, so it's hidden for the rest.
export function registerSettings(onChange, settings = game.settings, localize = key => key, systemId = null) {
  for (const [key, data] of Object.entries(SETTINGS)) {
    const localized = data.choices
      ? { ...data, choices: Object.fromEntries(Object.entries(data.choices).map(([value, label]) => [value, localize(label)])) }
      : data;
    settings.register(MODULE_ID, key, {
      name: localize(`RANGE_FINDER.Settings.${key}.Name`),
      hint: localize(`RANGE_FINDER.Settings.${key}.Hint`),
      config: !(key === 'rangeField' && BUILT_IN_SYSTEMS.has(systemId)),
      ...localized,
      onChange
    });
  }
}

export function readSettings(settings = game.settings) {
  return Object.fromEntries(Object.keys(SETTINGS).map(key => [key, settings.get(MODULE_ID, key)]));
}
