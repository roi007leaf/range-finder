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
  ghostPersistentHud: { scope: 'client', type: Boolean, default: true },
  allowSharing: { scope: 'world', type: Boolean, default: true },
  badgesCombatOnly: { scope: 'world', type: Boolean, default: false }
};

// Foundry localizes setting names, hints and choices itself, so the default localize is the identity.
export function registerSettings(onChange, settings = game.settings, localize = key => key) {
  for (const [key, data] of Object.entries(SETTINGS)) {
    const localized = data.choices
      ? { ...data, choices: Object.fromEntries(Object.entries(data.choices).map(([value, label]) => [value, localize(label)])) }
      : data;
    settings.register(MODULE_ID, key, {
      name: localize(`RANGE_FINDER.Settings.${key}.Name`),
      hint: localize(`RANGE_FINDER.Settings.${key}.Hint`),
      config: true,
      ...localized,
      onChange
    });
  }
}

export function readSettings(settings = game.settings) {
  return Object.fromEntries(Object.keys(SETTINGS).map(key => [key, settings.get(MODULE_ID, key)]));
}
