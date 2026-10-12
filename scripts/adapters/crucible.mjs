/**
 * Crucible adapter: weapon ranges and action ranges, in feet (Crucible's grid unit).
 *
 * Weapons: `item.system.range` is derived in prepareBaseData from the weapon category (reach ×1.5, ambush ×0.5);
 * melee weapons reach 1–3 ft, ranged ones 30–120 ft. Drawn as [0, range], melee ones as a reach band.
 *
 * Actions are not Items: they live on `actor.actions` (actor.system.actions), keyed by id (consumables
 * `<id>.<itemId>`, composed spells `spell.<rune>.<gesture>.<inflection>`), each with
 * `range = { minimum, maximum, weapon, category }`. The system rejects targets when
 * `range < minimum` or `range > maximum` (CrucibleAction target acquisition), so the band is [minimum, maximum]
 * and anything closer than the minimum is out of range. With `range.weapon` the strike tag sets
 * `maximum = max(maximum, source maximum + the struck weapons' smallest range)` while the actor prepares, so actor
 * actions already carry it; effectiveRange only re-applies it for actions not prepared with their strikes. `category` none → no range; melee → reach tone.
 *
 * Distances are base-to-base (crucible.api.canvas.grid.getLinearRangeCost): adjacent tokens are 0 ft apart,
 * which is why a 1 ft sword reaches the next square. Band cells are measured the same way.
 */
import { makeSpec, noneSpec, showsButton } from '../core/spec.mjs';
import { diagonalDistance } from '../core/cells.mjs';
import { itemsOf } from './util.mjs';
import { sceneRule } from './measure.mjs';
import { sceneUnits } from '../canvas/geometry.mjs';

const systemFormat = (key, data) => globalThis.game?.i18n?.format?.(key, data) ?? key;
const systemLinearRange = (source, target) => {
  const measure = globalThis.crucible?.api?.canvas?.grid?.getLinearRangeCost;
  return typeof measure === 'function' ? measure(source, target) : null;
};
const num = value => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : 0);

/** Base-to-base distance between two cells: the empty cells between them (adjacent or overlapping → 0). */
export function cellGap(a, b, unit = 5, rule = sceneRule()) {
  const gi = Math.max(0, Math.abs(a.i - b.i) - 1), gj = Math.max(0, Math.abs(a.j - b.j) - 1);
  return diagonalDistance({ i: 0, j: 0 }, { i: gi, j: gj }, unit, rule);
}

/** Base-to-base distance between two tokens' occupied cells (0 when they overlap). */
export function baseToBase(aCells, bCells, unit = 5, rule = sceneRule()) {
  let best = Infinity;
  for (const a of aCells ?? []) for (const b of bCells ?? []) best = Math.min(best, cellGap(a, b, unit, rule));
  return best === Infinity ? NaN : best;
}

/**
 * The action's [minimum, maximum] as the system checks targets against it. Prepared actor actions already fold
 * the strike weapon range into `range.maximum` (the strike tag's prepare, except movement actions), so for them
 * this is just range.minimum / range.maximum; the weapon fold here only matters for actions not yet prepared
 * with their strikes (e.g. item-bound actions read before the actor's preparation), and is a no-op otherwise.
 */
export function effectiveRange(action) {
  const range = action?.range ?? {};
  let max = num(range.maximum);
  if (range.weapon) {
    const strikes = action.usage?.strikes ?? [];
    const weaponRange = num(action.usage?.weaponRange)
      || (strikes.length ? Math.min(...strikes.map(weapon => num(weapon?.system?.range))) : 0);
    max = Math.max(max, num(action._source?.range?.maximum) + weaponRange);
  }
  return { min: num(range.minimum), max };
}

const actionsOf = actor => {
  const actions = actor?.actions ?? actor?.system?.actions;
  if (!actions || typeof actions !== 'object') return [];
  return Object.entries(actions).filter(([, action]) => action && typeof action === 'object');
};
const ownerOf = (actor, item) => actor ?? (item?.documentName === 'Actor' ? item : item?.actor ?? item?.parent ?? null);
const hasTag = (action, tag) => Boolean(action?.tags?.has?.(tag));
const isWeapon = item => item?.type === 'weapon';

/** Strikes and weapon-range actions → attacks; spell actions → spells; the rest → other. */
const groupOf = action => {
  if (action.range?.weapon || hasTag(action, 'strike') || action.usage?.strikes?.length) return 'attacks';
  if (hasTag(action, 'spell') || action.item?.type === 'spell') return 'spells';
  return 'other';
};

/** Stand-in "item" for an action (name / img for lists, a uuid for pins); resolved back by resolveItem. */
const actionHandle = (actor, id, action) => ({
  id, name: action.name ?? id, img: action.img ?? null, uuid: `${actor.uuid}.Action.${id}`, actor, crucibleActionId: id
});

/** Sheet rows of CrucibleBaseActorSheet (hero and adversary sheets). */
const HOOKS = ['renderCrucibleBaseActorSheet'];
const sheetActor = app => app?.actor ?? app?.document ?? null;
const resolveAction = (el, app) => {
  const actor = sheetActor(app);
  const id = el.dataset.actionId;
  const action = id ? actor?.actions?.[id] : null;
  if (!action || (el.dataset.uuid && actor.uuid && el.dataset.uuid !== actor.uuid)) return null;
  return { actor, item: actionHandle(actor, id, action), actionIndex: id };
};
const resolveItemRow = (el, app) => {
  const actor = sheetActor(app);
  const id = el.dataset.itemId ?? /\.Item\.([^.]+)$/.exec(el.dataset.uuid ?? '')?.[1];
  const item = id ? actor?.items?.get?.(id) ?? null : null;
  return item ? { actor, item, actionIndex: null } : null;
};
const controls = el => el.querySelector(':scope > .controls') ?? el;

export const crucibleRows = [
  // Actions tab (templates/sheets/actor/actions.hbs): data-uuid is the actor's.
  { hooks: HOOKS, selector: 'li.line-item.action[data-action-id]', resolve: resolveAction, host: controls, button: { tag: 'a', classes: ['button', 'icon'] } },
  // Inventory (inventory.hbs): the system's row controls are <button type="button" class="icon …">.
  { hooks: HOOKS, selector: '[data-inventory-section] li.line-item[data-item-id]', resolve: resolveItemRow, host: controls, button: { tag: 'button', classes: ['icon'] } },
  // Talents and iconic spells (talents.hbs, spells.hbs): <a class="button icon …">.
  { hooks: HOOKS, selector: '[data-tab="talents"] li.line-item[data-item-id], [data-tab="spells"] li.line-item[data-item-id]', resolve: resolveItemRow, host: controls, button: { tag: 'a', classes: ['button', 'icon'] } },
  // Sidebar (sidebar.hbs): equipped gear and favorite actions have no controls; the button ends the row.
  { hooks: HOOKS, selector: '.sheet-sidebar div.action.line-item[data-action-id]', resolve: resolveAction, host: el => el, button: { tag: 'a', classes: ['button', 'icon'] } },
  { hooks: HOOKS, selector: '.sheet-sidebar div.equipped.line-item[data-uuid]', resolve: resolveItemRow, host: el => el, button: { tag: 'a', classes: ['button', 'icon'] } }
];

export function createCrucibleAdapter({ units = sceneUnits, format = systemFormat, linearRange = systemLinearRange } = {}) {
  const label = text => {
    const key = 'ITEM.PROPERTIES.Range';
    const localized = format(key, { range: text });
    return localized && localized !== key ? localized : `Range ${text}`;
  };

  function rangeSpec({ min = 0, max, melee, name, u }) {
    if (!(max > 0) || !(max > min)) return noneSpec(null, name);
    const text = min > 0 ? `${min}–${max} ${u}` : `${max} ${u}`;
    return makeSpec({
      kind: melee ? 'reach' : 'radius',
      bands: [{ min, max, penalty: 0, tone: melee ? 'reach' : 'base', label: label(text) }],
      itemName: name
    });
  }

  function actionSpec(action, name, u) {
    if (!action || action.range?.category === 'none') return noneSpec(null, name);
    const { min, max } = effectiveRange(action);
    return rangeSpec({ min, max, melee: action.range?.category === 'melee', name: action.name ?? name, u });
  }

  function specFor({ actor = null, item, actionIndex = null, units: given } = {}) {
    const u = given ?? units();
    // A pin whose action handle could not be rebuilt still names the action: resolve it on the token's actor.
    if (!item) return actor && actionIndex !== null && actionIndex !== undefined ? actionSpec(actor.actions?.[actionIndex], '', u) : noneSpec();
    const name = item.name ?? '';
    const owner = ownerOf(actor, item);
    if (actionIndex !== null && actionIndex !== undefined) return actionSpec(owner?.actions?.[actionIndex], name, u);
    if (isWeapon(item)) {
      return rangeSpec({ max: num(item.system?.range), melee: !item.system?.config?.category?.ranged, name, u });
    }
    // Any other item: its first bound action with a range (a talent's or an iconic spell's action).
    for (const [, action] of actionsOf(owner)) {
      if (action.item !== item && !(action.item?.id && action.item.id === item.id)) continue;
      const spec = actionSpec(action, name, u);
      if (showsButton(spec)) return spec;
    }
    return noneSpec(null, name);
  }

  const rangeLabel = spec => spec?.bands?.at(-1)?.label ?? spec?.note ?? '';

  /**
   * Action pins carry "<actor uuid>.Action.<id>". A sheet opened from the world actor gives "Actor.<id>.Action.…"
   * while an unlinked token's actor is "Scene.….Token.….Actor.<id>", so match the actor id, not the whole prefix.
   * The action id is everything after the last ".Action." (ids may contain dots).
   */
  function resolveItem(actor, uuid) {
    const text = String(uuid ?? '');
    const at = text.lastIndexOf('.Action.');
    if (!actor?.id || at < 0) return null;
    const owner = /(?:^|\.)Actor\.([^.]+)$/.exec(text.slice(0, at))?.[1];
    if (owner !== actor.id) return null;
    const id = text.slice(at + '.Action.'.length);
    const action = actor.actions?.[id];
    return action ? actionHandle(actor, id, action) : null;
  }

  function listItems(actor) {
    const weapons = itemsOf(actor)
      .filter(item => isWeapon(item) && showsButton(specFor({ actor, item })))
      .map(item => ({ item, actionIndex: null, group: 'attacks' }));
    // Like the sheet's actions tab: no suppressFromSheet actions; movement actions (target.type) have no target range.
    const actions = actionsOf(actor)
      .filter(([, action]) => !action.suppressFromSheet && action.target?.type !== 'movement')
      .filter(([id]) => showsButton(specFor({ actor, item: actor, actionIndex: id })))
      .map(([id, action]) => ({ item: actionHandle(actor, id, action), actionIndex: id, group: groupOf(action) }));
    return [...weapons, ...actions];
  }

  // pad: base-to-base, a cell N ft away is N/unit + 1 cells out, one past bandCells' default window.
  const cellMeasure = (_spec, unit = 5, rule = sceneRule()) => Object.assign((from, to) => cellGap(from, to, unit, rule), { bandSensitive: () => false, pad: 1 });

  /** The system's own base-to-base range; otherwise base-to-base over occupied cells (square grids). */
  function distance(source, target, _spec, c = globalThis.canvas) {
    if (!source || !target) return NaN;
    try {
      const measured = linearRange(source, target);
      if (Number.isFinite(measured)) return measured;
    } catch { /* fall through */ }
    const grid = c?.grid;
    if (!grid?.isSquare) return NaN;
    const a = source.document?.getOccupiedGridSpaceOffsets?.();
    const b = target.document?.getOccupiedGridSpaceOffsets?.();
    return a?.length && b?.length ? baseToBase(a, b, grid.distance, grid.diagonals) : NaN;
  }

  return { id: 'crucible', specFor, rangeLabel, resolveItem, listItems, cellMeasure, distance, rows: crucibleRows };
}

export const crucibleAdapter = createCrucibleAdapter();
