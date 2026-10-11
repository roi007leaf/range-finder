# Range Finder

See an item's, attack's or spell's range right on the canvas.

- **📏 button** on every strike, weapon and spell row — PF2e character and NPC sheets, and PF2e HUD sidebars and shortcuts. Click to pin, click again (or press Esc) to clear.
- **Shift+click** shares the range with everyone, tinted in your player color.
- **Hold Alt** while hovering a row to preview its range without pinning.
- **Penalty bands**: range increments drawn as merged bands labelled `60 ft · –2`, reach for melee weapons (including PF2e's 10 ft reach diagonal), volley zones hatched. PF2e thrown melee weapons (e.g. dagger) show both reach and thrown bands.
- **Target badges**: every visible token shows `45 ft · –2`, `✓` or `✗`.
- **Gets out of the way**: the window you clicked from fades while the range is shown; hover it to bring it back.
- Optional: hatch squares without line of effect, colorblind palette, outline-only bands.

Works on square grids (per-square bands) and hex/gridless scenes (rings). System-agnostic core with a PF2e adapter; other systems get a basic numeric-range fallback.

## Keybindings

Rebindable in **Configure Controls**.

| Action | Default |
|---|---|
| Preview hovered range | Alt |
| Clear my ranges | Esc |
| Clear shared ranges (GM) | unbound |

## Settings

| Setting | Scope | Default |
|---|---|---|
| Band style | client | Fill and outline |
| Band opacity | client | 1 |
| Band labels | client | on |
| Badge size | client | 1 |
| Colors | client | Default |
| Dim behind walls | client | off |
| Hide windows while showing range | client | Fade |
| Also hide PF2e HUD bar | client | off |
| Allow sharing | world | on |
| Badges only in combat | world | off |

## For developers

`game.modules.get('range-finder').api.registerAdapter(systemId, adapter)` — see `scripts/adapters/generic.mjs` for the adapter shape.

Adapters must be registered during the `init` hook, so they are in place before any sheet renders.

Run tests with `npm test`.
