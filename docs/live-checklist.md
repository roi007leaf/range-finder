# Range Finder — live checklist (Foundry v14, PF2e)

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
- [ ] pf2e-hud actions/spells sidebars and shortcuts show 📏 and work; persistent bar does not fade unless the setting is on.
- [ ] Settings: outline-only, labels off, colorblind palette, badge size, dim behind walls (hatched squares + eye-slash badge), minimize mode.
- [ ] Hex scene and gridless scene: rings with labels.
- [ ] Open a sheet from the sidebar for an actor without a token on the scene: clicking 📏 warns, nothing breaks.
- [ ] Change scene with a pin active: no errors, windows restored.
- [ ] Console has no `Range Finder |` errors throughout.
