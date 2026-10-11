# Range Finder — Design

Date: 2026-10-11
Status: approved in brainstorming, awaiting spec review

## Goal

A polished Foundry VTT v14 module that shows an item's / attack's / spell's range on the canvas around its token, so a player can see in one click where to stand and what range penalty each target carries. Standalone: no dependency on Aedif's Tactical Grid or any other range module.

## Scope

- **Systems:** system-agnostic core + adapter per system. v1 ships the `pf2e` adapter (SF2e works through it when it exposes the same item APIs) and a minimal `generic` adapter.
- **Grids:** square grids get per-cell bands. Hex and gridless scenes get smooth rings using the same distance measurement.
- **Spells (v1):** range only — `N feet`, touch, emanation size. Area-shape previews (burst ghost, cones, lines) are deferred to phase 2. Template placement is out of scope (PF2e already does it).
- **Out of scope v1:** summary panel of targets, token tinting, all-ranges overview, cover calculation.

## User-facing behavior

### Triggers
- **Row button (📏 `fa-ruler-combined`)** injected into item rows:
  - PF2e character sheet: strikes `li.strike[data-action-index]`, spells `li.spell[data-item-id]`, actions `li.action.item[data-item-id]`, inventory weapons.
  - PF2e NPC sheet: `li.item.action[data-action-index][data-item-id]`, spells.
  - pf2e-hud: actions sidebar `div.item.attack[data-item-id][data-index]` and `div.item.action[data-item-id]`, spells sidebar `div.item[data-item-type=spell][data-item-id]`, persistent shortcuts `div.item.shortcut` (itemId in dataset). Injected via `render<Class>` hooks of the sidebar/shortcut apps.
  - Button only rendered when the adapter returns a spec with `kind !== 'none'`, or a note (then the button shows a tooltip like "Range: varies" and does nothing on click).
- **Click** pins the range. Click again unpins. **Shift+click** pins and shares (see Sharing).
- **Preview keybind** (default `Alt`, rebindable, registered via `game.keybindings`): while held, hovering a supported row shows a temporary preview of that row's range. Once started, the preview locks to that item until the key is released (the window is ghosted, so hover would otherwise be lost). Release clears it. A preview draws above an existing pin in a lighter style and does not replace it.

### Pins
- One pin per token per client. Pinning another item of the same token replaces it.
- A pin clears on: clicking its button again, `Esc` (clears all local pins and previews), token deleted, item deleted, scene change.
- Pinned button shows an active state (teal glow; sharer color when shared).
- Pin follows the token: during drag the overlay redraws (throttled to animation frames) from the drag preview position; badges update live; on drop it settles.

### Sharing
- Shift+click shares the pin. Socket payload: `{ action: 'pin'|'unpin'|'clearAll', tokenId, itemUuid, actionIndex?, userId }`. Each client builds the spec and badges locally (visibility-correct: a client only gets badges for tokens it can see).
- Shared pins are tinted with the sharer's user color and labelled with the sharer's name and item ("Valeros — Longsword").
- The sharer unpinning clears it everywhere. GMs get a "clear all shared ranges" control (keybind + scene control tool).
- World setting `allowSharing` (default true) gates it.

### Ghosting windows
- When a range shows from an app window (sheet or pf2e-hud sidebar), that source window gets a `range-finder-ghost` CSS class: ~10% opacity, `pointer-events: none`, 150 ms transition.
- Preview: ghosted while the key is held; restored on release.
- Pin: ghosted while pinned. A document-level `pointermove` listener compares cursor position with the window's bounding rect; inside → class removed (full opacity, interactive), outside → class re-added. Unpin restores permanently.
- pf2e-hud persistent HUD (bottom bar) is not ghosted unless client setting `ghostPersistentHud` is on.
- Client setting `ghostMode`: `fade` (default) | `minimize` (Foundry minimize, restored afterwards) | `off`.
- `Esc` and module errors always remove ghost classes / restore minimized windows.

### Target badges
- For every token the viewer can see (`token.visible`), except the source token: a rounded plate above the token showing `45 ft · –2`, colored by band.
- `✓` instead of a penalty when penalty is 0; `✗` when beyond max range.
- Eye-slash icon when the wall-dimming setting is on and the target's line from the source is blocked by sight walls.
- Size scales with zoom, clamped to a readable range.
- World setting `badgesCombatOnly` (default false): only badge combatants of the active combat.

### Walls
- Client setting `dimBehindWalls` (default **off**). When on: cells whose center is not visible from the source token's center (sight-blocking walls, via the polygon backend) render at 40% fill with diagonal hatching and a dashed outline. Range itself is never clipped (range is distance; line of effect is a separate rule).

## Visual style

- **Band fills:** base band soft teal ~18% fill + crisp 2 px outline; each further increment shifts teal → amber → rust with slightly decreasing opacity. Reach (melee) = single steel-blue band. Volley zone = red hatch overlay.
- **Outlines:** outer edges of each band only (merged cells → polygons), rounded joins, subtle dark halo for contrast on any map.
- **Labels:** small pill on each band's outer edge (`30 ft · –2`), placed top-right of the band, upright.
- **Motion:** 150 ms fade + slight scale on show/hide. Disabled when the user prefers reduced motion (`matchMedia('(prefers-reduced-motion: reduce)')`).
- **Palette:** defined by the core theme; client setting to pick `default` or `colorblind-safe` preset. Adapters never set colors; they set band semantic `tone` (`base`, `increment`, `reach`, `penalty-zone`).

## Architecture

```
range-finder/
  module.json
  scripts/
    main.mjs                 hooks, settings, keybindings, socket wiring
    core/
      spec.mjs               RangeSpec types + validation/normalization
      cells.mjs              bandCells(): cells per band (pure)
      outline.mjs            outline(): merge cells → polygons (pure)
      targets.mjs            classifyTargets() (pure, injected distance fn)
      theme.mjs              palettes, tone → color
    canvas/
      RangeOverlay.mjs       PIXI container: fills, outlines, labels, hatch, fade
      TargetBadges.mjs       badge plates above tokens
    ui/
      PinManager.mjs         pin/preview state, sharing, lifecycle
      Triggers.mjs           row buttons, preview keybind, hover tracking
      Ghost.mjs              window ghosting
    adapters/
      index.mjs              registry: getAdapter(systemId)
      pf2e.mjs               PF2e adapter + DOM selectors
      generic.mjs            fallback adapter
  styles/range-finder.css
  lang/en.json
  tests/*.test.mjs           node --test
```

### Core contracts

```js
// RangeSpec
{
  kind: 'reach' | 'increments' | 'radius' | 'none',
  bands: [{ min: number, max: number, penalty: number, label: string, tone: 'base'|'increment'|'reach'|'penalty-zone' }],
  overlays: [{ min, max, tone: 'penalty-zone', label }],   // e.g. volley
  note: string | null,                                     // e.g. "Range: varies"
  itemName: string
}
```

- `bandCells({ originCells, bands, grid, measure })` → `Map<bandIndex, Cell[]>`. `originCells` = cells occupied by the token; distance of a cell = min over origin edge cells of `measure(from, to)`. Each cell goes into the first band whose `[min, max]` contains its distance. Cells occupied by the source token are excluded. Bounded to the bounding box of `max` around the token.
- `outline(cells, gridSize)` → array of closed polygons (outer boundaries + holes) for a band's cell set.
- `classifyTargets({ source, targets, spec, distance, blocked })` → `[{ tokenId, distance, bandIndex | null, penalty | null, outOfRange: boolean, blocked: boolean }]`.
- Adapter interface:
  ```js
  {
    id, 
    specFor({ actor, token, item, actionIndex }) → RangeSpec,
    measure(token, fromCell, toCell) → feet,      // optional override; default canvas.grid.measurePath
    distance(sourceToken, targetToken) → feet,    // for badges
    rowSelectors: [{ hook, selector, resolve(el, app) → { actor, item, actionIndex } }]
  }
  ```

### PF2e adapter rules
- **Weapons/strikes (character):** `actor.system.actions[actionIndex]`, use `action.item`. Ranged: `item.range` → `{ increment, max }`; bands `[k*inc, (k+1)*inc]` for k = 0..5, capped at `max`, penalty `-2k`, label `"{end} ft · {penalty}"`. Weapon with `maxRange` and no increment → one band `[0, max]` penalty 0. Thrown melee weapons show both reach band and the thrown increments.
- **Melee:** `actor.getReach({ action: 'attack', weapon: item })` → one `reach` band `[0, reach]`.
- **NPC strikes:** melee item `range`/`reach` getters (`reach`/`reach-N` traits).
- **Volley N:** overlay `penalty-zone` `[0, N]` labelled `"Volley · –2"`.
- **Spells:** `spell.range` → touch (`isMelee`) = actor base reach band; `{ max }` from `N feet` → one `radius` band. Emanation area (`system.area.type === 'emanation'`) with no range → band `[0, area.value]`. Anything else (`varies`, `unlimited`, `planetary`, null) → `kind: 'none'` with note `Range: <raw text>`.
- **Measure:** PF2e square rule (alternating diagonals 5/10) via `canvas.grid.measurePath`; reach exactly 10 ft special case: a cell at 15 ft measured distance that is 2 diagonal steps counts as 10 ft (PF2e reach rule).
- **Distance for badges:** `sourceToken.distanceTo(targetToken)` (accounts for size and elevation).
- **Penalty cap:** penalty floors at `-10` within 6 increments; beyond max → out of range.

### Data flow

1. Trigger (click / preview key) → `Triggers` resolves `{ actor, item, actionIndex, token }` from the row (token = the actor's controlled token on canvas, else the first active token of the actor on the scene; if none → notification "No token on this scene").
2. `adapter.specFor(...)` → `RangeSpec` (cached by `item.uuid + actionIndex + token size`, invalidated on `updateItem`/`updateActor`).
3. `PinManager` stores the pin / preview, tells `Ghost` the source window, tells `RangeOverlay` and `TargetBadges` to render.
4. `RangeOverlay` computes cells (core) → outlines (core) → draws. `TargetBadges` runs `classifyTargets` → draws plates.
5. Hooks `refreshToken` (source moved or dragged), `updateToken`, `createToken`/`deleteToken`, `updateWall`/`createWall`/`deleteWall`, `sightRefresh` → redraw affected pins (rAF-throttled).
6. Shared pins: socket message → receiving `PinManager` rebuilds locally.

### Error handling
- Adapter throws or returns invalid spec → button shows a disabled state with tooltip "Range unavailable"; error logged with a `Range Finder |` prefix; never breaks sheet rendering (all injection wrapped in try/catch).
- Missing token/item/scene → pin dropped silently.
- `Esc` always clears pins, previews and ghosting.

## Settings

| Key | Scope | Default | Meaning |
|---|---|---|---|
| `bandStyle` | client | `both` | `fill` / `outline` / `both` |
| `bandOpacity` | client | `1` | multiplier 0.3–1.5 |
| `showLabels` | client | `true` | band edge labels |
| `badgeScale` | client | `1` | 0.6–1.6 |
| `palette` | client | `default` | `default` / `colorblind` |
| `dimBehindWalls` | client | `false` | hatch cells without line of effect |
| `ghostMode` | client | `fade` | `fade` / `minimize` / `off` |
| `ghostPersistentHud` | client | `false` | also ghost pf2e-hud persistent HUD |
| `allowSharing` | world | `true` | Shift+click sharing |
| `badgesCombatOnly` | world | `false` | badges only on active combatants |

Keybindings: `preview` (hold, default Alt), `clearAll` (Esc, local), `clearShared` (GM only, unbound by default).

## Testing

- `node --test` unit tests on the pure core: `bandCells` for 1×1, 2×2, 3×3 tokens; reach-10 diagonal rule; band boundaries; `outline` for single cell, L shape, ring with hole; `classifyTargets` penalties, out-of-range, blocked.
- PF2e adapter unit tests with fixture objects: longbow (inc 100), javelin (thrown 30), whip (reach), NPC strike with `reach-15`, touch spell, 30 ft spell, emanation, `varies` spell, volley 30 weapon.
- Ghost unit tests with jsdom-free DOM stubs (class toggling, restore on Esc).
- Live verification in Foundry with a showcase scene.

## Phase 2 (not in this spec's plan)
- Spell area preview (burst ghost within range, cones/lines toward cursor).
- Additional adapters (dnd5e, Daggerheart, Draw Steel).
