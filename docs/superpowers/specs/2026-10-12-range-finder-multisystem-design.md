# Range Finder — Multi-system Design

Date: 2026-10-12
Status: approved in brainstorming, awaiting spec review
Builds on: `2026-10-11-range-finder-design.md` (v1, PF2e). Everything there still holds unless changed here.

## Goal

Make Range Finder genuinely system-agnostic: universal triggers that work in any system, a core free of PF2e assumptions (units, diagonals, penalty model), and first-class adapters for PF2e, SF2e and D&D 5e.

## Scope

- **Systems with full adapters:** `pf2e`, `sf2e` (pf2e codebase — shares the pf2e adapter), `dnd5e` (6.x).
- **Everything else:** generic adapter + universal triggers (Token HUD list, item-sheet header button) + a GM-configurable range field.
- **Areas:** range only. Area-shape previews (Fireball sphere, cones, SF2e area-fire) stay in phase 2. Self-range area spells/abilities show a radius equal to the area size.
- **Out of scope:** Daggerheart / Draw Steel / Crucible dedicated adapters (they use the generic layer); HUD integrations other than pf2e-hud.

## Core changes (system-agnostic)

### Band marks
- `Band` gains optional `mark: string | null` (default `null`).
- Badge mark precedence: out of range → `✗`; else `band.mark` if set; else `penalty ? fmtPenalty(penalty) : '✓'`.
- PF2e output unchanged (no marks).

### Units
- Labels use the scene's units: `canvas.scene.grid.units` (fallback `ft`). Core label helpers take a `units` string; `incrementBands`, `singleBand` defaults and `badgeText` format `"{n} {units}"`.
- Adapters return distances in **scene units**. dnd5e converts with `dnd5e.utils.convertLength(value, from, to)` when an item's units differ from the scene's.

### Diagonals
- The default cell measure follows Foundry's grid rule `canvas.grid.diagonals` (`CONST.GRID_DIAGONALS`): EQUIDISTANT (Chebyshev), EXACT (Euclidean), APPROXIMATE (1.5), RECTILINEAR (Manhattan), ALTERNATING_1 (5/10/5), ALTERNATING_2 (10/5/10), ILLEGAL (Manhattan). Implemented as a pure `diagonalDistance(a, b, unit, rule)` in `core/cells.mjs`, with `alternatingDistance` kept as the ALTERNATING_1 case.
- PF2e/SF2e keep their own measure (alternating + reach-10 exception).

### Token distance (default)
- Edge-to-edge: minimum over the two tokens' occupied cells of the cell measure (`diagonalDistance` with the scene rule), so large tokens measure correctly and match the bands. PF2e/SF2e keep `TokenPF2e#distanceTo`.

## Adapters

Adapter interface additions:
- `listItems(actor) → [{ item, actionIndex, group: 'attacks' | 'spells' | 'other' }]` — items for the Token HUD list (only those whose spec has a range or a note are shown).
- `rangeLabel(spec) → string` — short label for list rows (default: derived from the spec: `"80/320 ft"`, `"Reach 10 ft"`, `"30 ft"`, or the note).

### pf2e / sf2e
- Unchanged rules. `listItems`: strikes from `actor.system.actions` (group attacks, with actionIndex), spells from all `actor.spellcasting.collections` (group spells; includes scroll/wand/staff spells), other ranged items (group other).
- SF2e area weapons: strikes whose action `type` is `area-fire`/`auto-fire`, or weapons with an `area-*` / `automatic` trait, keep their range bands and get a label suffix on the first band, e.g. `"30 ft · Auto-fire cone 15 ft"`, `"60 ft · Area burst 10 ft"`. No shape drawn.

### dnd5e (new, 6.x)
Reads `item.system.range = { value, long, reach, units }` (weapons) and `system.range` / first activity's `range` (spells, features). Activities' `range.value` is not used for bands (the system rewrites it).
- **Ranged or thrown weapon** (`hasRange`): bands `[0, value]` (✓, tone base) and `(value, long]` (mark `"Disadv."`, tone increment) when `long > value`. Thrown melee weapons also get a reach overlay (`system.range.reach`, default 5; 10 with the `rch` property).
- **Melee weapon:** reach band `[0, reach]`, label `"Reach N ft"`.
- **Spells / features:**
  - distance units (`ft`, `m`, `mi`, `km`) with a value → radius band.
  - `touch` → reach band labelled `"Touch · 5 ft"` (actor reach default 5).
  - `self` with `target.template` (type + size) → radius band of the template size, labelled e.g. `"Cone 15 ft"`, `"Emanation 10 ft"`.
  - `self` without template → no button.
  - `spec` / `any` → disabled button, note `"Range: special"` / `"Range: any"`.
- **Distance:** default edge-to-edge measure (scene diagonal rule).
- **Rows:** hooks `renderCharacterActorSheet`, `renderNPCActorSheet` (AppV2, HTMLElement root); selector `li.item[data-item-id]` inside `dnd5e-inventory`; host `.item-controls`; resolve `actor.items.get(itemId)`, skip items without a range spec. Favorites sidebar rows are out of scope.

### generic
- World setting `rangeField` (string, default empty = auto-detect). If set, read that path on the item: a number → radius band in scene units; `{ value, long }` → normal band + long band marked `"Long"`.
- Auto-detect (when empty or the path yields nothing): `system.range` as number, `{ value, long }`, or `{ value, units }`.
- `listItems`: all actor items whose spec has a range or note, grouped by `item.type`: `weapon` → attacks, `spell` → spells, everything else → other.

## Universal triggers

### Token HUD button
- `renderTokenHUD`: add a `📏` control (`fa-ruler-combined`) to the right column for tokens the user owns (`token.isOwner`).
- Click toggles a popover anchored next to the HUD listing `adapter.listItems(actor)`, grouped Attacks / Spells / Other, each row: icon, name, `rangeLabel`. Pinned rows highlighted (`is-active`).
- Row click → pin (same PinManager request: tokenId, itemUuid, actionIndex); Shift+click → share; hold the preview key while hovering a row → preview. Disabled rows (note only) show the note as tooltip.
- Popover closes with the Token HUD (`closeTokenHUD` / HUD clear) and on Esc. It is never ghosted.
- Built with the same `Triggers` row machinery (rows registered with a resolver over the popover's `data-item-uuid` / `data-action-index`).

### Item sheet header button
- `getHeaderControlsDocumentSheetV2` (AppV2 document sheets, e.g. dnd5e's `ItemSheet5e`; filtered to embedded Items) and `getItemSheetHeaderButtons` (AppV1 item sheets, e.g. PF2e): add a `📏` control for embedded items whose adapter spec has a range.
- Click pins the item for the owning actor's token (same token resolution as sheet rows; warning if none); Shift+click shares. The item sheet is ghosted like actor sheets.

## PF2e/SF2e skill actions and range modifiers

Source data: `docs/research/pf2e-range-catalog.json` (+ `.md`), curated from the PF2e 8.6 compendia (actions, feats, class/ancestry features, equipment, effects). PF2e action definitions carry no range data, so ranges come from a module table.

### Runtime table
`scripts/adapters/pf2e-ranges.mjs` — a curated, data-only table derived from the catalog:
- `SKILL_ACTIONS`: slug → range rule: `{ kind: 'radius', feet }`, `'reach'` (melee reach; Athletics maneuvers use weapon reach), `'adjacent'` (label "Adjacent", 5 ft regardless of reach), `'touch'`, or `{ kind: 'emanation', feet }` (radius labelled "Emanation N ft").
- `FEAT_ACTIONS`: slug → range rule for feat/feature actions that are ranged skill checks (Bon Mot, Scare to Death, You're Next, Pistol Twirl, …).
- `SKILL_MODIFIERS`: feat slug → `{ actions: [...slugs], set | add feet, toggle?: rollOption }` (Legendary Laugh → Demoralize 60; Mage's Field Dressing → Battle Medicine 60; Hydraulic Maneuvers → Disarm/Shove/Trip 15 when `hydraulic-maneuvers`; Dimensional Pilfer / Thief of Moonlight → Steal/Palm ranges; Loud Singer; …).
- `SPELL_MODIFIERS`: passive spell-range changes the system doesn't apply (Touch Focus, Witch's Charge, Grasping Spirits Spell, psychic conscious-mind cantrip ranges, Wand of Reaching, …) and per-use spellshapes (Reach Spell: +30 ft, touch → 30 ft).
- `WEAPON_MODIFIERS` / `REACH_MODIFIERS`: only the entries PF2e does NOT already reflect in `WeaponPF2e#range` / `CreaturePF2e#getReach` (Axe Thrower, Magnifying Scope, Throw and Catch, Harpoon Bolt, Galloping Launch, Scatter Blast; Looming Gait, Well-Armed, Giant's Lunge, Mutate Weapon, Extending rune, Soulpiercer, Tasset of Flexibility). Everything the system already applies (Far Shot, Far Lobber, Strong Arm, Crossbow Crack Shot, runes/scopes, Lunge/Enlarge/size/battle forms via reach) is read for free and must not be double-applied.
- Detection: owning the feat/item by slug (`actor.items` / `itemTypes.feat`), plus roll options for toggles (`actor.getRollOptions()` contains e.g. `lunge`, `hydraulic-maneuvers`).

### Rules (decided)
1. Battle Medicine, Treat Wounds, Treat Poison/Disease, Administer First Aid, Steal, Palm an Object → **adjacent** ("Adjacent"); Force Open / Disable a Device / Pick a Lock are not shown (interact, no tactical value).
2. **Seek** — no button (GM-chosen area; phase 2 with area shapes).
3. **`reach-N` weapons + Lunge** — add the Lunge bonus ourselves when the `lunge` roll option is active (the system's `getReach` ignores it for `reach-N`).
4. **Athletics maneuvers** (Shove, Trip, Disarm, Grapple, Reposition) — best reach among equipped weapons with the matching trait, else base reach; Trip with a `ranged-trip` weapon uses that weapon's first range increment (labelled "Ranged trip · –2").
5. **Base-action modifiers** (e.g. Legendary Laugh) change the base row's range when owned; feat actions with their own rows (You're Next, Warning Shot, Pistol Twirl, Talent Envy) get their own buttons with their own rules.
6. **Area Demoralize feats** ("each enemy within 30 ft") — radius labelled "Emanation N ft".
7. **Per-use modifiers** — toggles are read from the actor's roll options at draw time. **Reach Spell** (cast-time spellshape, no toggle): **Alt+click 📏 on a spell row = "with Reach Spell"**, available only when the actor owns Reach Spell (or an equivalent from the table); the pin label reads e.g. "Electric Arc · Reach Spell 60 ft". Alt+click must not collide with the hold-Alt preview: the preview key's hover-preview is suppressed while a click with Alt is in progress (click wins).
8. **pf2e-hud quirks** — skills-sidebar rows are identified by `data-item-uuid` (actions resolve via `fromUuidSync` to the compendium action → slug), avoiding the `disable-device` vs `disable-a-device` key mismatch. Actions pf2e-hud doesn't list (Encouraging Words) get no HUD button.

### Triggers for skill actions
- **pf2e-hud skills sidebar:** hook `renderSkillsSidebarPF2eHUD`; rows `.item.statistic[data-item-uuid]`; host `.controls`; resolve slug from the uuid; ghosting like other HUD sidebar rows.
- **Owned action/feat rows:** PF2e character sheet `li.action.item[data-item-id]` and pf2e-hud actions sidebar `.item.action[data-item-id]` — a button appears when the item's slug is in `FEAT_ACTIONS` or `SKILL_ACTIONS`.
- The PF2e character sheet doesn't list generic skill actions (Demoralize etc.), so those buttons live in the pf2e-hud skills sidebar and the Token HUD list (`listItems` gains a "Skill actions" group: base skill actions with ranges + owned feat actions).
- Skill-action pins are keyed by a synthetic item: `itemUuid` = the action's compendium uuid (or owned feat uuid) and the spec is built by the adapter from the table + the actor's modifiers. `build`/`resolveItem` must resolve compendium action uuids (`fromUuidSync` works for compendium index entries; fall back to slug lookup in the table).

### Testing (additions)
- Table-driven tests: each `SKILL_ACTIONS` rule → spec (radius/reach/adjacent/touch/emanation labels).
- Modifiers: Legendary Laugh → Demoralize 60; Hydraulic Maneuvers only with roll option; Lunge + `reach-N`; Mage's Field Dressing; Reach Spell Alt+click (+30, touch → 30) only when owned; a system-applied modifier (Far Shot) is not double-applied.
- Athletics maneuver weapon choice (trait match, best reach, ranged-trip).
- pf2e-hud skills row resolution by uuid (fixture DOM).

## Settings (additions)

| Key | Scope | Default | Meaning |
|---|---|---|---|
| `rangeField` | world | `""` | data path for the generic adapter; empty = auto-detect |
| `tokenHudButton` | client | `true` | show the 📏 Token HUD button |

## Testing

- Core: band `mark` precedence in `badgeText`; units in labels (`ft`, `m`); `diagonalDistance` for every `GRID_DIAGONALS` rule; default edge-to-edge token distance for 1×1 and 2×2 tokens.
- dnd5e fixtures (6.0.6 shapes): longbow 150/600, dagger thrown 20/60 + reach 5, glaive reach 10 (`rch`), Fire Bolt 120 ft, Shocking Grasp touch, Burning Hands self + cone 15, a `spec` range, a metres item on a feet scene (conversion stubbed).
- SF2e: auto-fire / area label suffix.
- generic: `rangeField` number and `{value,long}` paths; auto-detect shapes.
- Token HUD popover (jsdom): list grouping, pin, Shift+click share, preview key, disabled note row, close on Esc.
- Header button: shown only for items with range; pins for the owning actor's token.
- Live checklist: dnd5e world and SF2e world sections.
