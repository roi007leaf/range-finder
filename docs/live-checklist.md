# Range Finder — live checklist (Foundry v14: PF2e, SF2e, D&D 5e, other systems)

Setup: square-grid scene, a PF2e character with longbow, dagger, whip, a fist (basic unarmed strike) and spells (Electric Arc 30 ft, Shocking Grasp touch, Bless emanation, Wish varies); a few enemy tokens at 20–300 ft; one wall between the character and an enemy. pf2e-hud enabled.

- [ ] Character sheet: 📏 shows on strikes, weapons in inventory, ranged/touch spells; disabled (tooltip) on Wish; absent on Shield/self spells.
- [ ] Longbow pin: 6 bands to 600 ft, labels `100 ft`, `200 ft · –2` … `600 ft · –10`; volley 30 hatch; sheet fades; hovering the faded sheet restores it.
- [ ] Badges: enemies show `NN ft · ✓/–N/✗` matching PF2e's own attack roll range penalty.
- [ ] Dagger: thrown bands + reach outline. Whip: reach 10 includes both 2-square diagonals.
- [ ] Basic unarmed strike (Fist) can be pinned.
- [ ] Drag the pinned token: bands and badges follow smoothly; drop settles.
- [ ] Hold Alt over a spell row: lighter preview; release clears; sheet restores.
- [ ] Alt+Tab while previewing doesn't leave a stuck preview.
- [ ] Esc clears pins and restores windows.
- [ ] Shift+click: second client sees the range tinted with the sharer's color and the owner label; unpin clears it there; GM "clear shared" tool clears all.
- [ ] Two-client test: a shared pin's unpin from another player can't be spoofed (sender check).
- [ ] pf2e-hud actions/spells sidebars and shortcuts show 📏 and work; pinning from a sidebar fades only the sidebar (the persistent bar too if "Also hide PF2e HUD bar" is on); hovering each brings it back; unpin restores all.
- [ ] Settings: outline-only, labels off, colorblind palette, badge size, dim behind walls (hatched squares + eye-slash badge), minimize mode.
- [ ] Hex scene and gridless scene: rings with labels.
- [ ] Open a sheet from the sidebar for an actor without a token on the scene: clicking 📏 warns, nothing breaks.
- [ ] Change scene with a pin active: no errors, windows restored.
- [ ] Badge on a target with another token directly north of it (touching): the badge is fully visible, not cut by the neighbour.
- [ ] Sharer switches scene, reloads, or closes the tab: the other client's copy of the shared range clears.
- [ ] Preview fade-in is visible on Alt press (and absent with OS reduced motion on).
- [ ] Elevated token (e.g. 30 ft) with dim behind walls on: hatching and eye-slash match what the token sees from its elevation/level.
- [ ] Pin a strike, then add a new weapon to the character: the pin keeps showing the originally pinned weapon.
- [ ] Esc with no pins still closes the top window (Foundry's default).
- [ ] Large token with a pinned longbow: dragging stays smooth.
- [ ] NPC sheet strikes and character-sheet inventory weapons show 📏 and pin.
- [ ] Minimize mode from a pf2e-hud sidebar (frameless): note whether it minimizes; if it can't, it stays as-is and is restored cleanly — record the result in the README.
- [ ] Tab to a 📏 button and press Enter/Space: pins (Shift+Enter shares).
- [ ] Console has no `Range Finder |` errors throughout.

## PF2e — skill actions, modifiers, universal triggers

- [ ] pf2e-hud skills sidebar: 📏 on Demoralize (30 ft), Feint (reach), Shove/Trip/Disarm/Grapple/Reposition, Administer First Aid / Treat Wounds / Steal / Palm an Object (`Adjacent`), Bon Mot (when owned); none on Seek, Force Open, Disable a Device, Pick a Lock, Recall Knowledge.
- [ ] Dimensional Pilfer owned: its own feat-action row shows 60 ft; Thief of Moonlight: its own row shows 30 ft; Steal / Palm an Object stay `Adjacent`.
- [ ] Natural Medicine row (nature) shows Treat Wounds' `Adjacent` range.
- [ ] Character sheet Actions tab and pf2e-hud actions sidebar: 📏 on owned Battle Medicine, Terrifying Howl (`Emanation 30 ft`), You're Next (60 ft); none on Toughness.
- [ ] Legendary Laugh owned → Demoralize 60 ft. Hydraulic Maneuvers: Shove 15 ft only while its toggle is on.
- [ ] Whip equipped: Trip/Disarm at 10 ft, Grapple at 5 ft. Bola equipped: Trip shows reach + a `Ranged trip · –2` band to 20 ft.
- [ ] Touch Focus owned: with its toggle on, touch spells reach 30 ft (per the table entry); with it off they stay at touch reach.
- [ ] Reach-N weapon with the Lunge toggle on: strike and Trip reach +5; without the toggle unchanged. Whip + Lunge: the system's value (not +10).
- [ ] Far Shot longbow: bands to 1200 ft (system value), not 2400.
- [ ] Reach Spell owned: spell 📏 tooltip says "Alt+click: with Reach Spell"; point at 📏, hold Alt, click → `Reach Spell 60 ft` for Electric Arc, 30 ft for Shocking Grasp; no preview started while pointing at the 📏; plain click shows the normal range. Second client sees the shared variant.
- [ ] Alt+click on a variant 📏 works while its window is faded (pin a range from the sheet, then Alt+click a variant 📏 on the faded sheet).
- [ ] Galloping Launch / Throw and Catch Alt+click variants work on a melee weapon with thrown-N (e.g. a dagger or spear) as well as on thrown weapons.
- [ ] Token HUD 📏: list grouped Attacks / Spells / Skill actions / Other with range labels (`100/600 ft`, `Reach 10 ft`, `30 ft`); only items with a range or a note are listed; Wish is disabled with its note as tooltip; row click pins for *that* token (try two unlinked tokens of one actor); Shift+click shares; Alt held over a row previews; Esc and closing the HUD close the list; the list never fades.
- [ ] Token HUD list follows the HUD: drag/move the token (or pan/zoom the canvas) with the list open — it stays attached to the HUD.
- [ ] pf2e-hud: pinning from the open sidebar fades only that sidebar; the persistent bar stays until "Also hide PF2e HUD bar" is on (default off).
- [ ] PF2e item sheet header shows 📏 for a longbow (pins the owner's token, the sheet fades), not for a ring.
- [ ] "Token HUD button" off → no 📏 on the HUD.

## SF2e world

- [ ] Same sheets/HUD rows as PF2e; skill actions resolve (Demoralize 30 ft) even without the pf2e compendium.
- [ ] Automatic weapon: first band `NN ft · Auto-fire cone MM ft`; area weapon: `NN ft · Area burst 10 ft`; no shape drawn.

## D&D 5e world (6.x)

Setup: square grid (5 ft), a character with a longbow, dagger, glaive, Fire Bolt, Shocking Grasp, Burning Hands, Shield, a feature with a 30 ft activity; enemies at 5–700 ft.

- [ ] Character and NPC sheets: 📏 in the controls column of inventory, features and spell rows that have a range; none on Shield or loot.
- [ ] Longbow: `150 ft` band + `600 ft · Disadv.` band; badges `200 ft · Disadv.`, `700 ft · ✗`.
- [ ] Dagger: 20/60 bands + 5 ft reach outline. Glaive: `Reach 10 ft`.
- [ ] Fire Bolt 120 ft; Shocking Grasp `Touch · 5 ft`; Burning Hands `Cone 15 ft`; a "Special" range spell shows a disabled 📏 with `Range: special`.
- [ ] Scene diagonal rule "Equidistant" vs "Alternating (5/10/5)": bands and badges change accordingly and agree with each other; a large token's badges measure edge to edge.
- [ ] Scene in metres (1.5 m grid): labels and badges in `m` with one decimal.
- [ ] Item sheet header menu has "Show range"; Shift+click shares.
- [ ] Token HUD 📏 list works as in PF2e (Attacks / Spells / Other).

## Other system (generic)

- [ ] A system with `system.range` numbers: Token HUD 📏 and item sheet 📏 show ranges.
- [ ] Set **Range field** to a custom path: ranges come from it; clearing it falls back to auto-detect.
