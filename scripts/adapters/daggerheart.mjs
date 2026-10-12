/**
 * Daggerheart adapter: range bands (Melee → Very Far) from an item's attack / action range.
 *
 * The system measures bands against `canvas.scene.rangeSettings` (scene flag or the world's
 * variantRules.rangeMeasurement): `{ melee: 5, veryClose: 15, close: 30, far: 60 }` by default, compared
 * directly with grid-measured distances, so the values are already in scene units. Very Far has no upper
 * bound in the system (isWithinRange('veryFar') is always true); it is drawn out to 5× Far (300 ft by
 * default, the "100-300 feet" of the rules text). CONFIG.DH.GENERAL.range[*].distance (1/3/10/20/30) is
 * not used by the system for measuring and is ignored here. No band carries a penalty or mark.
 */
import { makeSpec, noneSpec, showsButton } from '../core/spec.mjs';
import { itemsOf } from './util.mjs';
import { sceneUnits } from '../canvas/geometry.mjs';
import { defaultCellMeasure, defaultDistance } from './measure.mjs';

export const BANDS = ['melee', 'veryClose', 'close', 'far', 'veryFar'];
/** The SRD's grid conversion (squares), used only when the system's range settings are unavailable. */
const SRD_SQUARES = { melee: 1, veryClose: 3, close: 6, far: 12 };
const VERY_FAR_FACTOR = 5;
const ENGLISH = { melee: 'Melee', veryClose: 'Very Close', close: 'Close', far: 'Far', veryFar: 'Very Far' };

const systemRanges = () => globalThis.canvas?.scene?.rangeSettings ?? globalThis.game?.system?.settings?.variantRules?.rangeMeasurement ?? null;
const systemGridDistance = () => globalThis.canvas?.scene?.grid?.distance ?? globalThis.canvas?.grid?.distance ?? 5;
const systemLocalize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
const round = n => Math.round(n * 100) / 100;

const valuesOf = collection => {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  return Array.from(collection.values?.() ?? Object.values(collection));
};
const actionId = action => action?.id ?? action?._id ?? null;
/** An action object on its own (e.g. an adversary's `actor.system.attack`), not an Item. */
const isBareAction = item => Boolean(item) && !item.system && typeof item.range === 'string';
const hasBand = action => BANDS.includes(action?.range);

/** The action whose range to show: the one named by `actionIndex`, else a weapon's attack, else the first ranged action. */
export function actionFor(item, actionIndex = null) {
  if (!item) return null;
  if (isBareAction(item)) return item;
  const sys = item.system ?? {};
  const actions = valuesOf(sys.actions);
  if (actionIndex !== null && actionIndex !== undefined) {
    if (sys.attack && actionId(sys.attack) === actionIndex) return sys.attack;
    return sys.actions?.get?.(actionIndex) ?? actions.find(action => actionId(action) === actionIndex) ?? null;
  }
  if (hasBand(sys.attack)) return sys.attack;
  return actions.find(hasBand) ?? null;
}

const groupOf = item => (item.type === 'weapon' || isBareAction(item) ? 'attacks'
  : item.type === 'domainCard' || item.type === 'spell' ? 'spells' : 'other');

/** Character / adversary / companion / environment sheet rows (inventory-item-V2.hbs and -compact.hbs). */
export const daggerheartRows = [
  {
    hooks: ['renderDHBaseActorSheet'],
    selector: 'li.inventory-item[data-item-id]',
    resolve: (el, app) => {
      const actor = app?.actor ?? app?.document ?? null;
      if (!actor) return null;
      const id = el.dataset.actionId;
      if (id) {
        const attack = actor.system?.attack;
        if (attack && actionId(attack) === id) return { actor, item: attack, actionIndex: null };
        // An item's action: its uuid is "<item uuid>.Action.<id>".
        const itemId = /\.Item\.([^.]+)\.Action\./.exec(el.dataset.itemUuid ?? '')?.[1];
        const owner = itemId ? actor.items?.get?.(itemId) : itemsOf(actor).find(item => actionFor(item, id));
        return owner ? { actor, item: owner, actionIndex: id } : null;
      }
      const item = actor.items?.get?.(el.dataset.itemId) ?? null;
      return item ? { actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .controls, :scope > .item-main > .inventory-item-header > .controls')
      ?? el.querySelector(':scope .inventory-item-header') ?? el,
    // Plain <a> like the system's own row controls (equip, send to chat, context menu).
    button: { tag: 'a', classes: [] }
  }
];

export function createDaggerheartAdapter({
  ranges = systemRanges, gridDistance = systemGridDistance, units = sceneUnits, localize = systemLocalize
} = {}) {
  const nameOf = band => {
    const key = `DAGGERHEART.CONFIG.Range.${band}.name`;
    const text = localize(key);
    return text && text !== key ? text : ENGLISH[band];
  };

  /** Outer edge of each band in scene units (Very Far = 5× Far). */
  function thresholds() {
    const settings = ranges() ?? null;
    const grid = Number(gridDistance()) || 5;
    const edge = {};
    for (const band of BANDS.slice(0, -1)) {
      const value = Number(settings?.[band]);
      edge[band] = Number.isFinite(value) && value > 0 ? value : round(SRD_SQUARES[band] * grid);
    }
    edge.veryFar = round(edge.far * VERY_FAR_FACTOR);
    return edge;
  }

  function specFor({ item, actionIndex = null, units: given } = {}) {
    if (!item) return noneSpec();
    const name = item.name ?? '';
    const action = actionFor(item, actionIndex);
    if (!hasBand(action)) return noneSpec(null, name);
    const u = given ?? units();
    const edge = thresholds();
    const bands = [];
    let min = 0;
    for (const band of BANDS.slice(0, BANDS.indexOf(action.range) + 1)) {
      const max = edge[band];
      if (!(max > min)) continue;
      const shown = band === 'veryFar' ? `${edge.far}+` : max;
      bands.push({ min, max, penalty: 0, tone: bands.length ? 'increment' : 'base', label: `${nameOf(band)} · ${shown} ${u}` });
      min = max;
    }
    return makeSpec({ kind: bands.length > 1 ? 'increments' : 'radius', bands, itemName: name });
  }

  /** Token HUD label: the outermost band ("Close · 30 ft"). */
  const rangeLabel = spec => spec?.bands?.at(-1)?.label ?? spec?.note ?? '';

  /** Pins of an adversary's / unarmed attack carry the action's uuid ("Actor.x.Action.y"). */
  function resolveItem(actor, uuid) {
    const attack = actor?.system?.attack;
    return attack && attack.uuid && attack.uuid === uuid ? attack : null;
  }

  function listItems(actor) {
    const entries = itemsOf(actor)
      .filter(item => showsButton(specFor({ item })))
      .map(item => ({ item, actionIndex: null, group: groupOf(item) }));
    const attack = actor?.system?.attack;
    const ownAttack = attack && (actor.type !== 'character' || actor.system?.usesUnarmed);
    if (ownAttack && showsButton(specFor({ item: attack }))) entries.unshift({ item: attack, actionIndex: null, group: 'attacks' });
    return entries;
  }

  return {
    id: 'daggerheart', specFor, rangeLabel, resolveItem, listItems,
    cellMeasure: defaultCellMeasure, distance: defaultDistance, rows: daggerheartRows
  };
}

export const daggerheartAdapter = createDaggerheartAdapter();
