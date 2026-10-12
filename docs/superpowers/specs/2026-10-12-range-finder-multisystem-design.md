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
- `getHeaderControlsApplicationV2` (AppV2 item sheets) and `getItemSheetHeaderButtons` / `getApplicationHeaderButtons` (AppV1 sheets, e.g. PF2e item sheets): add a `📏` control for embedded items whose adapter spec has a range.
- Click pins the item for the owning actor's token (same token resolution as sheet rows; warning if none); Shift+click shares. The item sheet is ghosted like actor sheets.

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
