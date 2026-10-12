/** Where PF2e sheets and pf2e-hud list items, attacks and spells. */
import { skillItem } from './pf2e-skills.mjs';

const itemOf = (actor, id) => (id ? actor?.items?.get(id) ?? null : null);

function strikeAt(actor, index, itemId) {
  const i = Number(index);
  const action = Number.isInteger(i) ? actor?.system?.actions?.[i] : null;
  if (action?.item && (!itemId || action.item.id === itemId)) return { item: action.item, actionIndex: i };
  return { item: itemOf(actor, itemId), actionIndex: null };
}

const hudActor = app => app?.actor ?? app?.parent?.actor ?? null;
// pf2e-hud panels to fade while a range shows: just the sidebar, plus the persistent bar when enabled.
const hudGhost = (row, { includeBar }) => {
  const byId = id => row.ownerDocument?.getElementById(id) ?? null;
  return [...new Set([byId('pf2e-hud-sidebar'), includeBar ? byId('pf2e-hud-persistent') : null])].filter(Boolean);
};
// Scroll, wand and staff spells live in their entry's collection, not in actor.items.
const spellOf = (actor, entryId, id) => (entryId && id ? actor?.spellcasting?.collections?.get(entryId)?.get(id) : null) ?? itemOf(actor, id);
// Sheet rows: prefer the row's controls strip, else its name heading.
const controlsHost = el => el.querySelector(':scope .item-controls, :scope .controls') ?? el.querySelector(':scope .item-name, :scope .name, :scope h4') ?? el;
// pf2e-hud sidebar rows: their `.controls` are ammo/variant strips, so use the name line.
const nameHost = el => el.querySelector(':scope .name') ?? el;

export const pf2eRows = [
  {
    hooks: ['renderCharacterSheetPF2e'],
    selector: 'li.strike[data-action-index]',
    resolve: (el, app) => ({ actor: app.actor, ...strikeAt(app.actor, el.dataset.actionIndex, null) }),
    host: controlsHost
  },
  {
    hooks: ['renderNPCSheetPF2e'],
    selector: 'li.item.action[data-action-index][data-item-id]',
    resolve: (el, app) => ({ actor: app.actor, ...strikeAt(app.actor, el.dataset.actionIndex, el.dataset.itemId) }),
    host: controlsHost
  },
  {
    hooks: ['renderActorSheetPF2e'],
    selector: 'li.spell[data-item-id]',
    resolve: (el, app) => ({ actor: app.actor, item: itemOf(app.actor, el.dataset.itemId), actionIndex: null }),
    host: controlsHost
  },
  {
    hooks: ['renderCharacterSheetPF2e'],
    selector: '.tab.inventory li[data-item-id]',
    resolve: (el, app) => {
      const item = itemOf(app.actor, el.dataset.itemId);
      return item?.type === 'weapon' ? { actor: app.actor, item, actionIndex: null } : null;
    },
    host: controlsHost
  },
  {
    hooks: ['renderActionsSidebarPF2eHUD'],
    selector: '.item.attack[data-item-id]',
    resolve: (el, app) => ({ actor: hudActor(app), ...strikeAt(hudActor(app), el.dataset.index, el.dataset.itemId) }),
    host: nameHost,
    ghostTargets: hudGhost
  },
  {
    hooks: ['renderSpellsSidebarPF2eHUD'],
    selector: '.item[data-item-type="spell"][data-item-id]',
    resolve: (el, app) => ({ actor: hudActor(app), item: spellOf(hudActor(app), el.dataset.entryId, el.dataset.itemId), actionIndex: null }),
    host: nameHost,
    ghostTargets: hudGhost
  },
  {
    hooks: ['renderItemsSidebarPF2eHUD'],
    selector: '.item[data-item-id]',
    resolve: (el, app) => {
      const item = itemOf(hudActor(app), el.dataset.itemId);
      return item?.type === 'weapon' ? { actor: hudActor(app), item, actionIndex: null } : null;
    },
    host: controlsHost,
    ghostTargets: hudGhost
  },
  {
    hooks: ['renderPersistentShortcutsPF2eHUD'],
    selector: '.item.shortcut[data-item-id]',
    resolve: (el, app) => ({ actor: hudActor(app), item: itemOf(hudActor(app), el.dataset.itemId), actionIndex: null }),
    persistentHud: true,
    ghostTargets: hudGhost
  },
  {
    // Character sheet Actions tab: owned action/feat items whose slug is a ranged skill action.
    hooks: ['renderCharacterSheetPF2e'],
    selector: 'li.action.item[data-item-id]',
    resolve: (el, app) => {
      const item = itemOf(app.actor, el.dataset.itemId);
      return item && (item.type === 'action' || item.type === 'feat') ? { actor: app.actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .button-group') ?? controlsHost(el)
  },
  {
    hooks: ['renderActionsSidebarPF2eHUD'],
    selector: '.item.action[data-item-id]',
    resolve: (el, app) => {
      const actor = hudActor(app);
      const item = itemOf(actor, el.dataset.itemId) ?? skillItem(el.dataset.itemUuid);
      return item ? { actor, item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .controls') ?? nameHost(el),
    ghostTargets: hudGhost
  },
  {
    // Skills sidebar: rows carry the action's compendium uuid (avoids pf2e-hud's key mismatches, e.g. disable-device).
    hooks: ['renderSkillsSidebarPF2eHUD'],
    selector: '.item.statistic[data-item-uuid]',
    resolve: (el, app) => {
      const item = skillItem(el.dataset.itemUuid);
      return item ? { actor: hudActor(app), item, actionIndex: null } : null;
    },
    host: el => el.querySelector(':scope > .controls') ?? nameHost(el),
    ghostTargets: hudGhost
  }
];
