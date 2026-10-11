# Range Finder

See an item's, attack's or spell's range right on the canvas.

- **📏 button** on every strike, weapon and spell row — PF2e character and NPC sheets, and PF2e HUD sidebars and shortcuts. Click to pin, click again (or press Esc) to clear.
- **Shift+click** shares the range with everyone, tinted in your player color (needs the **Allow sharing** world setting). Shift+click an already pinned range to share it.
- **Hold Alt** while hovering a row to preview its range without pinning. Alt is also Foundry's default "highlight objects" key, so placeables highlight while you hold it; rebind either in Configure Controls if that bothers you.
- **GMs** get a "Range Finder — clear shared ranges" tool in the Token scene controls (and an unbound keybinding) that clears everyone's shared ranges.
- **Penalty bands**: range increments drawn as merged bands labelled `60 ft · –2`, reach for melee weapons (including PF2e's 10 ft reach diagonal), volley zones hatched. PF2e thrown melee weapons (e.g. dagger) show both reach and thrown bands.
- **Target badges**: every visible token shows `45 ft · –2`, `✓` or `✗`.
- **Gets out of the way**: the window you clicked from fades while the range is shown; from PF2e HUD, the sidebar, token HUD and persistent bar fade together; hover it to bring it back.
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
| Also hide PF2e HUD bar | client | on |
| Allow sharing | world | on |
| Badges only in combat | world | off |

## For developers

Register an adapter for your system from the `rangeFinder.registerAdapters` hook. Range Finder calls it during `setup`, before it picks the adapter for the current system:

```js
Hooks.once('rangeFinder.registerAdapters', api => api.registerAdapter('my-system', adapter));
```

See `scripts/adapters/generic.mjs` for the adapter shape. `game.modules.get('range-finder').api` exposes the same `registerAdapter` and `clear` functions, but a registration made after `setup` is not picked up.

Run tests with `npm test`.
