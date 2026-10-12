# PF2e range catalog for range-finder (pf2e 8.6.0)

Generated from compendium dumps (actions, feats, class-features, ancestry-features, heritages, equipment, feat-effects, equipment-effects, other-effects, spell-effects) + pf2e.mjs + pf2e-hud 2.56.2. Machine-readable: `catalog.json`.

## Runtime notes

- **runtimeReach**: CreaturePF2e#getReach({action:'interact'|'attack', weapon}) → interact: attributes.reach.base; attack: weapon 'reach' trait → base+5; 'reach-N' trait → N (ignores reach.base mods!); melee NPC item → item.reach; else base. attributes.reach.manipulate also exists (interact checks for loot/merchants).
- **runtimeWeaponRange**: WeaponPF2e#range → {increment, max: increment*6} or {max} from system.maxRange. AdjustStrike(range-increment) and ItemAlteration(range-increment/range-max) mutate system.range during actor prep (prepareStrike) so they ARE reflected (when their predicates/toggles are active).
- **runtimeSpellRange**: SpellPF2e#range parses system.range.value '/^(\d+)-f(?:t|eet)/' → {max}; touch → {max: reach.base}. No rule element alters spell range (no ItemAlteration 'range' for spells) — all spell range feats must be applied by range-finder. ItemAlteration 'area-size' (Widen Spell etc.) IS reflected in SpellPF2e#area.
- **volley**: Volley penalty predicate: {lte:['target:distance', N]} and {not:'self:ignore-volley-penalty'} (Point Blank Stance sets that option).
- **spellshapeToggles**: Spellshape feats register RollOption{option:'spellshape', suboptions:[{value:'<slug>'}], placement:'spellcasting'}; when chosen, actor roll options include 'spellshape:<slug>'.
- **systemActionDefs**: game.pf2e.actions (SingleCheckAction) definitions carry no range/distance fields — only slug, statistic, traits, modifiers, notes, variants. Range must come from this catalog.

## 1. Skill actions with a range (22)

| Action | slug | skill(s) | RangeSpec | rule text | HUD key | uuid | notes |
|---|---|---|---|---|---|---|---|
| Demoralize | demoralize | intimidation | radius 30 | Choose a creature within 30 feet of you who you're aware of. | demoralize | `Compendium.pf2e.actionspf2e.Item.2u915NdUyQan6uKF` |  |
| Feint | feint | deception | reach (attack) | Requirements: You are within melee reach of the target you attempt to Feint. | feint | `Compendium.pf2e.actionspf2e.Item.QNAVeNKtHA0EUw4X` |  |
| Shove | shove | athletics | reach (attack) +weapon[shove] | (attack trait; no range in text) core rule: target within your melee reach; a weapon with the shove trait uses that weapon's reach | shove | `Compendium.pf2e.actionspf2e.Item.7blmbDrQFNfdT731` |  |
| Trip | trip | athletics | reach (attack) +weapon[trip] / ranged-trip→increment | (attack trait; no range in text) melee reach; weapon with trip trait uses its reach; weapon with ranged-trip: within its first range increment (system adds -2 'ranged-trip' modifier) | trip | `Compendium.pf2e.actionspf2e.Item.ge56Lu1xXVFYUnLP` |  |
| Disarm | disarm | athletics | reach (attack) +weapon[disarm] | (attack trait; no range in text) melee reach; weapon with disarm trait uses its reach | disarm | `Compendium.pf2e.actionspf2e.Item.Dt6B1slsBy8ipJu9` |  |
| Grapple | grapple | athletics | reach (attack) +weapon[grapple] | You attempt to grab a creature or object with your free hand. (free hand = your base reach; weapon with grapple trait uses its reach) | grapple | `Compendium.pf2e.actionspf2e.Item.PMbdMWc2QroouFGD` |  |
| Reposition | reposition | athletics | reach (attack) +weapon[reposition] | It must remain within your reach during this movement. | reposition | `Compendium.pf2e.actionspf2e.Item.lOE4yjUnETTdaf2T` |  |
| Administer First Aid | administer-first-aid | medicine | adjacent | You perform first aid on an adjacent creature that is Dying or Bleeding. | administer-first-aid | `Compendium.pf2e.actionspf2e.Item.MHLuKy4nQO2Z4Am1` |  |
| Treat Wounds | treat-wounds | medicine, nature (Natural Medicine) | touch *(inferred)* | You spend 10 minutes treating one injured living creature (no distance stated; hands-on) | treatWounds | `Compendium.pf2e.actionspf2e.Item.1kGNdIIhuglAjIp9` | exploration activity; HUD key 'treatWounds' also used for Natural Medicine row (feat uuid WC4xLBGmBsdOdHWu) |
| Treat Poison | treat-poison | medicine | touch *(inferred)* | You treat a patient to prevent the spread of poison. (no distance stated; hands-on, healer's toolkit) | treat-poison | `Compendium.pf2e.actionspf2e.Item.KjoCEEmPGTeFE4hh` |  |
| Treat Disease | treat-disease | medicine | touch *(inferred)* | You spend at least 8 hours caring for a diseased creature. (downtime) | treat-disease | `Compendium.pf2e.actionspf2e.Item.TC7OcDa7JlWbqMaN` | downtime; button probably pointless |
| Steal | steal | thievery | reach (interact) *(inferred)* | You try to take a small object from another creature... you must have a free hand (no distance stated; must be able to reach it) | steal | `Compendium.pf2e.actionspf2e.Item.RDXXE7wMrSPCLv5k` |  |
| Palm an Object | palm-an-object | thievery | reach (interact) *(inferred)* | You pick up a small, unattended object (no distance stated; Interact reach) | palm-an-object | `Compendium.pf2e.actionspf2e.Item.ijZ0DDFpMkWqaShd` |  |
| Seek | seek | perception | area cone 30 / burst 15 / square 10 | The GM determines the area you can scan with one Seek action—almost always 30 feet or less in any dimension. | seek | `Compendium.pf2e.actionspf2e.Item.BlAOM2X92SI6HMtJ` | Default shapes inferred from Jann's Prism text ('twice as large as normal: 60-foot cone, 30-foot burst, 20-foot square') and legacy CRB '30-foot cone or 15-foot burst'. Burst placement range unspecified (line of sight). |
| Encouraging Words | encouraging-words | diplomacy | radius 30 | You give an ally within 30 feet a quick pep talk | — | `Compendium.pf2e.actionspf2e.Item.e2ePMDa7ixbLRryj` | Starfinder-ish Stamina action in pf2e actions pack; not in pf2e-hud skill list (system action exists: section skill) |
| Force Open | force-open | athletics | reach (interact) *(inferred)* | you attempt to forcefully open a door, window, container or heavy gate (object must be within reach) | force-open | `Compendium.pf2e.actionspf2e.Item.SjmKHgI7a5Z9JzBx` | object target; low value |
| Disable a Device | disable-a-device | thievery | reach (interact) *(inferred)* | disarm a trap or another complex device (hands-on) | disable-device | `Compendium.pf2e.actionspf2e.Item.cYdz2grcOcRt4jk6` | object target; HUD/system key 'disable-device' |
| Pick a Lock | pick-a-lock | thievery | reach (interact) *(inferred)* | Opening a lock without a key (hands-on) | pick-a-lock | `Compendium.pf2e.actionspf2e.Item.2EE4aF4SZpYf0R6H` | object target; low value |
| Bon Mot | bon-mot | diplomacy | radius 30 | Choose a foe within 30 feet | bonMot | `Compendium.pf2e.feats-srd.Item.0GF2j54roPFIDmXf` | pf2e-hud lists it under Diplomacy when actor has roll option feat:bon-mot; data-item-uuid = feat uuid |
| Battle Medicine | battle-medicine | medicine | adjacent *(inferred)* | You can patch up wounds, even in combat. (remaster text gives no distance; CRB text: 'yourself or an adjacent ally') | — | `Compendium.pf2e.feats-srd.Item.wYerMk6F1RZb0Fwt` | AMBIGUOUS: Foundry text has no range; treat as adjacent (touch). |
| Scare to Death | scare-to-death | intimidation | radius 30 | a living creature within 30 feet of you that you sense or observe | — | `Compendium.pf2e.feats-srd.Item.mZttsiWl1ql5NvrH` |  |
| Dirty Trick | dirty-trick | thievery | reach (attack) | Requirements: You have a hand free and are within melee reach of an opponent. | — | `Compendium.pf2e.feats-srd.Item.5eNKs6738aykAhK2` |  |

### Considered, no range (39)

Escape (targets the effect/creature grabbing you; no distance); Recall Knowledge (no target distance); Sense Motive (no distance); Create a Diversion (compares vs creatures whose attention you divert; no distance); Command an Animal (auditory; no distance (animal must hear)); Point Out (creature you can see; allies who can see you; no distance); Aid (GM-adjudicated preparation; no distance); Request (no distance (conversation)); Lie (no distance); Coerce (1 min conversation); Make an Impression (conversation); Gather Information (exploration); Impersonate (exploration); Perform (observers; no distance); Hide (no distance); Sneak (movement); Avoid Notice (exploration); Conceal an Object (on your person); Sense Direction (exploration); Track (exploration); Cover Tracks (exploration); Subsist (downtime); Decipher Writing (exploration); Identify Magic (exploration); Learn a Spell (exploration); Craft (downtime); Repair (exploration); Identify Alchemy (exploration); Create Forgery (downtime); Balance (movement); Tumble Through (movement (through an enemy's space)); Climb (movement); Swim (movement); High Jump (movement); Long Jump (movement); Leap (movement); Squeeze (movement); Maneuver in Flight (movement); Borrow an Arcane Spell (exploration)

## 2. Feats/items that modify skill-action ranges (49)

| Name | slug | lvl | affects | change | mode | detection / runtime | uuid |
|---|---|---|---|---|---|---|---|
| Legendary Laugh | legendary-laugh | 17 | demoralize | Demoralize range 30 → 60 ft | passive | feat slug | `Compendium.pf2e.feats-srd.Item.Y6n4EDUnWr1vMJTM` |
| You're Next | youre-next | 1 | demoralize | reaction Demoralize a creature within 60 ft (+2) after downing a foe | action(reaction) | feat slug; RollOption 'youre-next' predicate on +2 | `Compendium.pf2e.feats-srd.Item.gjec0ts3wkFbjvHN` |
| Warning Shot | warning-shot | 2 | demoralize | Demoralize range = wielded firearm's maximum range (increment × 6) instead of 30 ft | action | feat slug + equipped loaded firearm | `Compendium.pf2e.feats-srd.Item.XQEoKoFtq8n3wgA3` |
| Talent Envy | talent-envy | 7 | demoralize | free-action Demoralize an onlooker within 60 ft after a Virtuosic Performer performance | action(free) | feat slug | `Compendium.pf2e.feats-srd.Item.RR6p9r8l1trcByl2` |
| Crush Their Spirits *(not range)* | crush-their-spirits | 13 | demoralize | Demoralize up to 2/4/8 creatures within 30 ft (multi-target, same 30 ft) | passive | feat slug | `Compendium.pf2e.feats-srd.Item.mCW0SmOYCKq42C3i` |
| Threatening Pursuit | threatening-pursuit | 13 | demoralize | Demoralize all enemies within 30 ft; 60 ft in difficult-to-navigate location | action | feat slug | `Compendium.pf2e.feats-srd.Item.DJn652sW7nstvXf5` |
| Frightening Appearance | frightening-appearance | 12 | demoralize | after Startling Appearance, Demoralize each opponent within 10 ft | passive(trigger) | feat slug | `Compendium.pf2e.feats-srd.Item.Ano4tRq88V39eyPq` |
| Intimidating Glare *(not range)* | intimidating-glare | 1 | demoralize | visual instead of auditory; no language penalty — NOT a range change | passive | slug only | `Compendium.pf2e.feats-srd.Item.xQMz6eDgX75WX2ce` |
| Battle Cry *(not range)* | battle-cry | 7 | demoralize | free Demoralize on initiative (observed foe) — NOT a range change (still 30 ft) | passive | rules: Note | `Compendium.pf2e.feats-srd.Item.ePObIpaJDgDb9CQj` |
| Intimidating Prowess *(not range)* | intimidating-prowess | 2 | demoralize, coerce | bonus only — NOT range | passive | rules: FlatModifier,AdjustModifier | `Compendium.pf2e.feats-srd.Item.XFJiGllNZp8Xebda` |
| Terrified Retreat *(not range)* | terrified-retreat | 7 | demoralize | crit effect only — NOT range | passive | rules: Note | `Compendium.pf2e.feats-srd.Item.dc8X2Mbtwq6kGp7F` |
| Pistol Twirl | pistol-twirl | 2 | feint | Feint vs opponent within the one-handed ranged weapon's first range increment (instead of melee reach) | action | feat slug; needs loaded one-handed ranged weapon | `Compendium.pf2e.feats-srd.Item.A2EBy2L4acrehiAA` |
| Pistol Phenom Dedication | pistol-phenom-dedication | 2 | feint | grants Pistol Twirl (GrantItem) — detect via pistol-twirl | passive | GrantItem → pistol-twirl | `Compendium.pf2e.feats-srd.Item.PFMsj4LtdAIuGn4R` |
| Showstopper | showstopper | 14 | feint | Pistol Twirl targets all enemies within first range increment | passive (modifies Pistol Twirl) | feat slug | `Compendium.pf2e.feats-srd.Item.UZpBsHE57rmS0x6S` |
| Ricochet Feint | ricochet-feint | 12 | feint | while in Ricochet Stance: Feint within first range increment of a wielded thrown weapon | stance | feat slug + stance effect active (Ricochet Stance) | `Compendium.pf2e.feats-srd.Item.VIjI8PtkTFjeAA6a` |
| Distracting Toss | distracting-toss | 8 | feint | Feint a creature within 30 ft (not limited to melee) | action | feat slug | `Compendium.pf2e.feats-srd.Item.lGuoGim7J8Z97kor` |
| Cunning Trickster Mask | cunning-trickster-mask | 20 | feint | Feint from up to 30 ft away | passive | feat slug | `Compendium.pf2e.feats-srd.Item.CuJzCxGwd1EZDift` |
| Prayer Attack | prayer-attack | 14 | feint | Feint an enemy within 30 ft | action | feat slug | `Compendium.pf2e.feats-srd.Item.AtpMrGXaMPJtDIDR` |
| It Was Me All Along! | it-was-me-all-along | 14 | feint | Stride then Feint one target within 30 ft | action | feat slug | `Compendium.pf2e.feats-srd.Item.hPfqQpiq6W8RPCxz` |
| Vibrant Display | vibrant-display | 1 | feint | 1/10 min: Feint vs all ADJACENT creatures (area = adjacent) | passive(option) | feat slug | `Compendium.pf2e.feats-srd.Item.txgCXcNMDe9kO7N8` |
| Hydraulic Maneuvers | hydraulic-maneuvers | 13 | disarm, shove, trip | next Disarm/Shove/Trip has range 15 ft | toggle | RollOption 'hydraulic-maneuvers' (toggleable) | `Compendium.pf2e.feats-srd.Item.0jJ5FG72lydY3HHR` |
| Lunge | lunge | 2 | strike, disarm, shove, trip | +5 ft reach for one Strike, or Disarm/Shove/Trip with a weapon having that trait | toggle | RollOption 'lunge' → ActiveEffectLike system.attributes.reach.base +5 (reflected in getReach for base/'reach' weapons; NOT for reach-N trait weapons) | `Compendium.pf2e.feats-srd.Item.rTkr1EqpAN6YtnAh` |
| Stay Here! *(not range)* | stay-here | 8 | trip | Trip a creature within reach without a free hand | action | slug only | `Compendium.pf2e.feats-srd.Item.joNCgjhaGlThqWni` |
| Staff Sweep *(not range)* | staff-sweep | 6 | shove, trip | two foes within your reach, ≤5 ft apart | action | slug only | `Compendium.pf2e.feats-srd.Item.dPmJ91qawZW2U8K3` |
| Unbalancing Sweep *(not range)* | unbalancing-sweep | 12 | shove, trip | up to three enemies within your reach | action | slug only | `Compendium.pf2e.feats-srd.Item.pmz1itHp13JtcrjW` |
| Wave Spiral | wave-spiral | 12 | trip | Trip each creature in a 10-ft emanation | action | feat slug | `Compendium.pf2e.feats-srd.Item.fLlCodqKXyXbZR7C` |
| Clear the Way | clear-the-way | 6 | shove | Shove up to five ADJACENT creatures | action | slug only | `Compendium.pf2e.feats-srd.Item.goFxIDlbWd8GN0kj` |
| Crosscurrent Counter | crosscurrent-counter | 8 | grapple | Grapple triggering creature even if outside your reach | action(reaction) | slug only | `Compendium.pf2e.feats-srd.Item.sI4f0xdCVulyK9sn` |
| Shove Down | shove-down | 6 | trip | Trip after Shove even if target no longer in reach | action(free) | slug only | `Compendium.pf2e.feats-srd.Item.z5fUX9jeqfAViOd8` |
| Titan Wrestler *(not range)* | titan-wrestler | 1 | disarm, grapple, reposition, shove, trip | target size limit +1 (legendary +2) — NOT range | passive | slug only | `Compendium.pf2e.feats-srd.Item.KxaYlC50zzHysJj8` |
| Right Where You Want Them *(not range)* | right-where-you-want-them | 12 | reposition, shove | push distance only — NOT targeting range | passive | rules: Note | `Compendium.pf2e.feats-srd.Item.87OyWx4AktAysKXc` |
| Improved Knockback *(not range)* | improved-knockback | 12 | shove | push distance only — NOT range | passive | slug only | `Compendium.pf2e.feats-srd.Item.HPETR6zq8L6YJyi1` |
| Mage's Field Dressing | mages-field-dressing | 4 | battle-medicine | Battle Medicine on an ally affected by your wizard spell (spell affected an ally within 60 ft) — effectively 60 ft | action | feat slug | `Compendium.pf2e.feats-srd.Item.buUSr6Dh9md9WqJx` |
| Doctor's Visitation *(not range)* | doctors-visitation | 4 | battle-medicine, treat-poison, administer-first-aid | Stride first (movement, not range) | action | slug only | `Compendium.pf2e.feats-srd.Item.1fBHZpM3Z3MQtzvi` |
| Ward Medic *(not range)* | ward-medic | 2 | treat-wounds, treat-disease | multiple targets — NOT range | passive | rules: Note | `Compendium.pf2e.feats-srd.Item.8c61nOIr5AM3KxZi` |
| Continual Recovery *(not range)* | continual-recovery | 2 | treat-wounds | immunity duration — NOT range | passive | rules: Note | `Compendium.pf2e.feats-srd.Item.c85a69mB1urW2Se2` |
| Medic Dedication *(not range)* | medic-dedication | 2 | battle-medicine, treat-wounds | HP bonus/extra use — NOT range | passive | rules: ActiveEffectLike | `Compendium.pf2e.feats-srd.Item.MJg24e9fJd7OASvF` |
| Jann's Prism | janns-prism | 9 | seek | Seek area doubled: 60-ft cone / 30-ft burst / 20-ft square | toggle(item) | RollOption 'janns-prism' on held item | `Compendium.pf2e.equipment-srd.Item.jsTc3wyD0gSdXILQ` |
| Read the Roots | read-the-roots | 5 | seek | Seek within 30 ft using tremorsense | action | slug only | `Compendium.pf2e.feats-srd.Item.tBRhYPGTb30qP34t` |
| Echolocation *(not range)* | echolocation | 6 | seek | when Seeking, hearing is precise 40 ft (sense, not area) | passive | slug only | `Compendium.pf2e.feats-srd.Item.t7SlYWC4M2JcgwRM` |
| Keen Eyes *(not range)* | keen-eyes | 0 | seek | +2 vs hidden/undetected within 30 ft (bonus scope, not range) | passive | rules: FlatModifier | `Compendium.pf2e.ancestryfeatures.Item.y1EmCv2cEb5hXBwx` |
| Scavenger's Search *(not range)* | scavengers-search | 1 | seek | +2 to find objects within 30 ft (bonus scope) | passive | rules: FlatModifier | `Compendium.pf2e.feats-srd.Item.zaGD9Og2p8Opa0oJ` |
| Marvelous Miniature, Swift Sparrow | marvelous-miniature-swift-sparrow | 2 | seek | Seek in a 30-ft burst from a point up to 200 ft away | item activation | slug only | `Compendium.pf2e.equipment-srd.Item.AB9MZTjKQMTBXyi4` |
| Scouting Arrow | scouting-arrow | 8 | seek | Seek from arrow's impact point | item activation | slug only | `Compendium.pf2e.equipment-srd.Item.gogjNYjbw0rKUJ7r` |
| Dimensional Pilfer | dimensional-pilfer | 4 | steal, palm-an-object | Steal/Palm an object you can see within 60 ft | action | slug only | `Compendium.pf2e.feats-srd.Item.g3J3kSfnlYjq34Md` |
| Thief of Moonlight | thief-of-moonlight | 15 | steal, palm-an-object | free Steal/Palm from enemy within 30 ft after Spark Transcendence | action(free) | rules: RollOption,ItemAlteration | `Compendium.pf2e.classfeatures.Item.hNBYP7FbvIBoS9CV` |
| One for All | one-for-all | 1 | aid | designate an ally within 30 ft as Aid preparation | action | slug only | `Compendium.pf2e.feats-srd.Item.bCizH4ByTwbLcYA1` |
| Loud Singer | loud-singer | 5 | goblin-song | Goblin Song range 30 → 60 ft (+1 target) | passive | feat slug | `Compendium.pf2e.feats-srd.Item.7AuOURsTkkjrRekp` |
| Drake Rider Dedication *(not range)* | drake-rider-dedication | 2 | command-an-animal | telepathic command range 100 ft (communication, Command an Animal has no base range) | passive | slug only | `Compendium.pf2e.feats-srd.Item.hh2aqd0TGsrcSXl0` |

## 3. Feat actions that are themselves skill-check actions with a range (65)

These show as their own rows (pf2e-hud Actions sidebar / sheet Actions tab, identified by item slug). Ranges parsed from descriptions and hand-checked.

| Name | slug | lvl | type | skill | RangeSpec | uuid |
|---|---|---|---|---|---|---|
| Bon Mot | bon-mot | 1 | action | diplomacy | radius 30 | `Compendium.pf2e.feats-srd.Item.0GF2j54roPFIDmXf` |
| Scare to Death | scare-to-death | 15 | action | intimidation | radius 30 | `Compendium.pf2e.feats-srd.Item.mZttsiWl1ql5NvrH` |
| Dirty Trick | dirty-trick | 1 | action | thievery | reach | `Compendium.pf2e.feats-srd.Item.5eNKs6738aykAhK2` |
| Battle Medicine | battle-medicine | 1 | action | medicine | adjacent | `Compendium.pf2e.feats-srd.Item.wYerMk6F1RZb0Fwt` |
| Terrifying Howl | terrifying-howl | 10 | action | intimidation | emanation 30 | `Compendium.pf2e.feats-srd.Item.HjinlKihkadhkQ4Z` |
| Dazzling Display | dazzling-display | 10 | action | intimidation | emanation 30 | `Compendium.pf2e.feats-srd.Item.lk80TBn933RECRD7` |
| Deimatic Display | deimatic-display | 8 | action | intimidation | emanation 30 | `Compendium.pf2e.feats-srd.Item.UFVw57jWNC4UCfyN` |
| Terrifying Transformation | terrifying-transformation | 8 | action | intimidation | emanation 30 | `Compendium.pf2e.feats-srd.Item.rAUNZfiulXh4zcm6` |
| Majestic Proclamation | majestic-proclamation | 8 | action | intimidation | emanation 30 | `Compendium.pf2e.feats-srd.Item.SWkeel82rdttxUD3` |
| Brandish Authority | brandish-authority | 18 | action | intimidation | emanation 30 | `Compendium.pf2e.feats-srd.Item.nkYBSuqCWcIgqjj0` |
| Reach for the Sky | reach-for-the-sky | 12 | action | intimidation | emanation 30 | `Compendium.pf2e.feats-srd.Item.ssrublnppwFSvVcb` |
| Threatening Pursuit | threatening-pursuit | 13 | action | intimidation | emanation 30 | `Compendium.pf2e.feats-srd.Item.DJn652sW7nstvXf5` |
| Tut-Tut | tut-tut | 4 | free | intimidation | emanation 30 | `Compendium.pf2e.feats-srd.Item.0ptK0blZehF3ABha` |
| Flash Your Badge | flash-your-badge | 10 | action | intimidation | cone 30 | `Compendium.pf2e.feats-srd.Item.qbFRPTHP96Q9kGpk` |
| Talmandor's Shout | talmandors-shout | 12 | action | intimidation | emanation 60 | `Compendium.pf2e.feats-srd.Item.j305O6rhKvx4sT38` |
| Terrifying Croak | terrifying-croak | 1 | action | intimidation | radius 30 | `Compendium.pf2e.feats-srd.Item.T8tNZANOWUZiXuzO` |
| Sudden Terror | sudden-terror | 1 | action | intimidation | radius 30 | `Compendium.pf2e.feats-srd.Item.tXn6fJO3Q2dAvCZC` |
| Terrifying Invocation | terrifying-invocation | 4 | action | intimidation | radius 30 | `Compendium.pf2e.feats-srd.Item.HZE37GeNGeBeutZk` |
| Do You Know Who I Am? | do-you-know-who-i-am | 12 | action | intimidation | radius 30 | `Compendium.pf2e.feats-srd.Item.1Z4ps6u7RtA57ksK` |
| Watch Your Back | watch-your-back | 6 | action | intimidation | radius 30 | `Compendium.pf2e.feats-srd.Item.zZCyJhsaugHB6mZW` |
| Edict of Mortality | edict-of-mortality | 8 | action | intimidation | emanation 60 | `Compendium.pf2e.feats-srd.Item.pYYSLNUWGMYxYNkG` |
| Unfaltering Ranks | unfaltering-ranks | 17 | action | intimidation | emanation 60 | `Compendium.pf2e.feats-srd.Item.UseAF1tBCb9O2eO7` |
| Divine Disharmony | divine-disharmony | 1 | action | deception\|intimidation | radius 60 | `Compendium.pf2e.feats-srd.Item.fUR72e3t7p2IcqqG` |
| Feign Innocence | feign-innocence | 12 | action | deception | radius 60 | `Compendium.pf2e.feats-srd.Item.UhyoBNQbGP6lKjwE` |
| Fabricate Truth | fabricate-truth | 4 | action | deception | radius 30 | `Compendium.pf2e.feats-srd.Item.p2McwseYbPZrL5G3` |
| Perplex | perplex | 14 | action | diplomacy | radius 30 | `Compendium.pf2e.feats-srd.Item.ctl5zNJC3APlHg9o` |
| Guiding Words | guiding-words | 18 | action | diplomacy | radius 30 | `Compendium.pf2e.feats-srd.Item.LmsjuqB3rrZTqqa6` |
| No Cause for Alarm | no-cause-for-alarm | 1 | action | diplomacy | emanation 10 | `Compendium.pf2e.feats-srd.Item.6ON8DjFXSMITZleX` |
| Seasoned Command | seasoned-command | 7 | action | diplomacy\|intimidation | radius 30 | `Compendium.pf2e.feats-srd.Item.c2hPWQ4zdc4CnrnZ` |
| Commitment to Equality | commitment-to-equality | 4 | action | diplomacy | radius 30 | `Compendium.pf2e.feats-srd.Item.TMwqXqqggiblvEGZ` |
| Goblin Song | goblin-song | 1 | action | performance | radius 30 | `Compendium.pf2e.feats-srd.Item.QZb0Utg0WFPf2Qg0` |
| Catchy Tune | catchy-tune | 5 | action | performance | emanation 30 | `Compendium.pf2e.feats-srd.Item.ACXWB7a38ETc32Qj` |
| Alluring Performance | alluring-performance | 9 | action | performance | emanation 15 | `Compendium.pf2e.feats-srd.Item.VtFuhfIIw8OoLF6v` |
| Primadonna | primadonna | 12 | action | performance | emanation 30 | `Compendium.pf2e.feats-srd.Item.pBP8KL1yPU3W1Kmh` |
| Flourishing Finish | flourishing-finish | 12 | action | performance | emanation 30 | `Compendium.pf2e.feats-srd.Item.isdTXU8bV7ZVOAuQ` |
| Dance of the Jester | dance-of-the-jester | 13 | action | performance | radius 30 | `Compendium.pf2e.feats-srd.Item.ycmxU7gySnfsO1Se` |
| Dance of the Tiger | dance-of-the-tiger | 9 | action | performance | adjacent | `Compendium.pf2e.feats-srd.Item.3xKOqBaPApgsnRtB` |
| Leading Dance | leading-dance | 4 | action | performance | adjacent | `Compendium.pf2e.feats-srd.Item.ZHPSASbvbbshq1zG` |
| Gunpowder Gauntlet | gunpowder-gauntlet | 4 | action | performance | weapon-range-increment | `Compendium.pf2e.feats-srd.Item.FbzbZc4LGUTcz9tA` |
| Disturbing Knowledge | disturbing-knowledge | 7 | action | occultism | radius 30 | `Compendium.pf2e.feats-srd.Item.hkSuxXOc9qBleJbd` |
| Battle Prayer | battle-prayer | 7 | action | religion | radius 30 | `Compendium.pf2e.feats-srd.Item.nBlzWZnmYuFHrMyV` |
| Banish Falsehoods of Flesh | banish-falsehoods-of-flesh | 14 | action | religion | radius 30 | `Compendium.pf2e.feats-srd.Item.Rp8h8cmFIsfDlw7q` |
| Improvise Strategy | improvise-strategy | 7 | action | warfare-lore | radius 30 | `Compendium.pf2e.feats-srd.Item.XbMfMJq2sCQHdo1w` |
| Unfazed Assessment | unfazed-assessment | 8 | action | perception | radius 30 | `Compendium.pf2e.feats-srd.Item.ZyQYP7i26DWhMNux` |
| Sense Alignment | sense-alignment | 4 | action | perception | radius 30 | `Compendium.pf2e.feats-srd.Item.iyXw5PnevT2jT8kU` |
| Battlefront Sabotage | battlefront-sabotage | 10 | action | thievery | reach | `Compendium.pf2e.feats-srd.Item.FtnFytJxa2ix1r5z` |
| Tamper | tamper | 1 | action | crafting | reach | `Compendium.pf2e.feats-srd.Item.SheifYobjKqyK3Fv` |
| Helpful Tinkering | helpful-tinkering | 10 | action | crafting | reach | `Compendium.pf2e.feats-srd.Item.qUSWPWxYF8gfhfHM` |
| Sabotage | sabotage | 4 | action | thievery | reach | `Compendium.pf2e.feats-srd.Item.vDeG0N4kzTBDTC2b` |
| Surgical Shock | surgical-shock | 12 | action | medicine | reach | `Compendium.pf2e.feats-srd.Item.zzjfENthtRBAjqjQ` |
| Treat Condition | treat-condition | 4 | action | medicine | adjacent | `Compendium.pf2e.feats-srd.Item.rfnEcjxIFqwlJwJT` |
| Catfolk Dance | catfolk-dance | 1 | action | acrobatics | adjacent | `Compendium.pf2e.feats-srd.Item.Iqv8qj7ym63YjexN` |
| Log Roll | log-roll | 4 | action | acrobatics | adjacent | `Compendium.pf2e.feats-srd.Item.SjJ8BOy5sc8p2H5E` |
| Tumbling Strike | tumbling-strike | 8 | action | acrobatics | adjacent | `Compendium.pf2e.feats-srd.Item.jfsmtOx4QgXB19BL` |
| Freeze It! | freeze-it | 9 | action | athletics | adjacent | `Compendium.pf2e.feats-srd.Item.LhpE0NsfNwYP6MOz` |
| Wing Buffet | wing-buffet | 9 | action | athletics | adjacent | `Compendium.pf2e.feats-srd.Item.tPi6FAnHYe6ijuyk` |
| Bestial Snarling | bestial-snarling | 2 | action | nature\|performance | adjacent | `Compendium.pf2e.feats-srd.Item.nCmsylaV144Pr4TZ` |
| Daring Act | daring-act | 6 | action | acrobatics\|athletics | reach | `Compendium.pf2e.feats-srd.Item.cny7ouhsoiNsWJ7X` |
| Lassoing Lash | lassoing-lash | 4 | action | athletics | reach | `Compendium.pf2e.feats-srd.Item.9O7DLcXVXpwLVXI6` |
| Denounce Tyranny | denounce-tyranny | 6 | action | diplomacy | radius 30 | `Compendium.pf2e.feats-srd.Item.ISjnymvdFOPED9um` |
| Pistolero's Challenge | pistoleros-challenge | 6 | action | deception\|intimidation | radius 30 | `Compendium.pf2e.feats-srd.Item.yOyMlFGAgLfRas8m` |
| Stages of Fate | stages-of-fate | 8 | action | religion | radius 30 | `Compendium.pf2e.feats-srd.Item.zJsu5JQGGOpyT6Xk` |
| Encouraging Words | encouraging-words | 2 | action | diplomacy | radius 30 | `Compendium.pf2e.feats-srd.Item.dUnT3HWMFD3d2eBJ` |
| Declare Anathema | declare-anathema | 16 | action | religion | radius 30 | `Compendium.pf2e.feats-srd.Item.7P5aKtFoPVJJPPEV` |
| Flower Street Infamy | flower-street-infamy | 11 | action | deception | radius 30 | `Compendium.pf2e.feats-srd.Item.rgmX9TTthBYo508T` |

## 4. Spell range modifiers (spellshape & others) (35)

| Name | slug | lvl | affects | change | mode | detection / runtime | uuid |
|---|---|---|---|---|---|---|---|
| Reach Spell | reach-spell | 1 |  | +30 ft range; touch → 30 ft | toggle (spellshape) | RollOption 'spellshape' suboption 'reach-spell' (placement: spellcasting) → roll option 'spellshape:reach-spell' — NOT reflected: SpellPF2e#range parses system.range.value only; rule only adds description text | `Compendium.pf2e.feats-srd.Item.BWomK7EVY0WXxWgh` |
| Grasping Spirits Spell | grasping-spirits-spell | 2 |  | +30 ft range (single-target spells); touch → 30 ft | toggle (spellshape) | roll option 'spellshape:grasping-spirits-spell' — NOT reflected | `Compendium.pf2e.feats-srd.Item.qcILhNRHqIbW3xRN` |
| Knowledge of Shapes *(not range)* | knowledge-of-shapes | 4 |  | Reach Spell / Widen Spell as free action (no change itself) | free | rules: ItemAlteration,RollOption | `Compendium.pf2e.feats-srd.Item.zSWTX520paO6Zv1i` |
| Touch Focus | touch-focus | 16 |  | range → touch (+2 attack) | toggle | RollOption 'touch-focus' (attack-roll domain) — NOT reflected | `Compendium.pf2e.feats-srd.Item.w1GFspPIQ9f5MbFL` |
| Familiar Conduit | familiar-conduit | 4 |  | spell origin = familiar (range measured from familiar) | spellshape action | NOT reflected (origin change) | `Compendium.pf2e.feats-srd.Item.IYt6pMqiTocTrixA` |
| Natural Conduit | natural-conduit | 4 |  | spell origin = animal within 60 ft | spellshape action | NOT reflected | `Compendium.pf2e.feats-srd.Item.nLlbcEZ5w4bsgMye` |
| Reach of the Dead | reach-of-the-dead | 1 |  | spell origin = thrall within 60 ft | spellshape free | NOT reflected | `Compendium.pf2e.feats-srd.Item.Vc3TsH5y2vsCawLy` |
| Widen Spell *(not range)* | widen-spell | 1 |  | area +5 (burst ≥10) / +5 or +10 (cone/line) — AREA not range | toggle (spellshape) | spellshape:widen-spell — REFLECTED in SpellPF2e#area via ItemAlteration area-size when option active | `Compendium.pf2e.feats-srd.Item.FoWO4RnHRwfEIC7Q` |
| Spiritual Expansion Spell *(not range)* | spiritual-expansion-spell | 2 |  | same as Widen Spell (area) | toggle (spellshape) | REFLECTED (area-size) | `Compendium.pf2e.feats-srd.Item.ZH4gpcvVTAD157fn` |
| Overwhelming Harm *(not range)* | overwhelming-harm | 4 |  | 3-action harm area 60 (area) | passive | REFLECTED (area-size) | `Compendium.pf2e.feats-srd.Item.n0k48pnJWIl9kMem` |
| Split Shot *(not range)* | split-shot | 4 |  | second target within range (no range change) | spellshape | rules: ItemAlteration,RollOption | `Compendium.pf2e.feats-srd.Item.DS0XlHfi3ztb3ET7` |
| Witch's Charge | witchs-charge | 6 |  | touch spells on your charge from 30 ft | passive | feat slug — NOT reflected | `Compendium.pf2e.feats-srd.Item.52QyoGaysrfBOy5H` |
| Seven-Part Link | seven-part-link | 16 |  | linked ally touch spells reach linked allies within 30 ft | passive | NOT reflected | `Compendium.pf2e.feats-srd.Item.UgZDirfFb4CFhuWh` |
| Midnight Illusionist Dedication | midnight-illusionist-dedication | 2 |  | reach 10 ft for touch spells | passive | NOT reflected | `Compendium.pf2e.feats-srd.Item.aObP7lhSmskzLhr6` |
| Snaptongue Tripkee | snaptongue-tripkee |  |  | deliver touch spells with tongue (tongue reach, 10 ft?) | passive | NOT reflected | `Compendium.pf2e.heritages.Item.2kSzKDtwbcILZTIe` |
| Spellstrike | spellstrike | 1 |  | spell delivered via weapon Strike: range = weapon reach | action | NOT reflected | `Compendium.pf2e.classfeatures.Item.KVj5ofUwu3VJSrVw` |
| Starlit Span | starlit-span | 1 |  | Spellstrike with ranged weapon: range = first range increment (overrides spell range) | passive | NOT reflected | `Compendium.pf2e.classfeatures.Item.Pew7duAozEeAemif` |
| Volatile Spark | volatile-spark | 1 |  | Spellstrike with firearm: first range increment | passive | NOT reflected | `Compendium.pf2e.classfeatures.Item.aRDNtB0mh6MMRSKf` |
| Lunging Spellstrike | lunging-spellstrike | 10 |  | staff reach +5 × spell rank for the Spellstrike | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.5tlTRfyPXkGS9Coq` |
| Meteoric Spellstrike | meteoric-spellstrike | 10 |  | ranged Spellstrike within first range increment + line | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.stwRJTOKUru9AmQC` |
| The Distant Grasp | the-distant-grasp | 1 |  | Telekinetic Projectile range 60 ft (psi cantrip) | passive | NOT reflected (ItemAlteration description/other-tags only) | `Compendium.pf2e.classfeatures.Item.1rlBo3LcwIuPDCvz` |
| The Oscillating Wave | the-oscillating-wave | 1 |  | Ignition ranged 60 ft; melee reach +5 | passive | NOT reflected (description); amp area REFLECTED | `Compendium.pf2e.classfeatures.Item.5tSR0WzMPFn5s3Xs` |
| The Silent Whisper | the-silent-whisper | 1 |  | Daze range 120 ft | passive | NOT reflected | `Compendium.pf2e.classfeatures.Item.rdWWlqvxXgfWDaSO` |
| The Infinite Eye | the-infinite-eye | 1 |  | Guidance range 120 ft | passive | NOT reflected | `Compendium.pf2e.classfeatures.Item.rvpTsj9epRuNH3uB` |
| The Tangible Dream | the-tangible-dream | 1 |  | Figment range 60 ft | passive | NOT reflected | `Compendium.pf2e.classfeatures.Item.8dAm3ULUqaK4N5a7` |
| Confounding Image | confounding-image | 6 |  | Mirror Image variant: range 30 ft | option | NOT reflected | `Compendium.pf2e.feats-srd.Item.V3lFDAQr3PfnAxMC` |
| Larcenous Hand | larcenous-hand | 8 |  | Telekinetic Hand variant: range 20 ft | option | NOT reflected | `Compendium.pf2e.feats-srd.Item.dCoX0TfsasMfwYnz` |
| Adept Benefit (Wand) | adept-benefit-wand | 7 |  | Fling Magic range 120 ft (thaumaturge implement) | passive | check (ItemAlteration present) | `Compendium.pf2e.classfeatures.Item.pax1pnWW5XFYO0Eg` |
| Paragon Benefit (Wand) | paragon-benefit-wand | 17 |  | Fling Magic range 180 ft | passive | check | `Compendium.pf2e.classfeatures.Item.jVW6185zu3VlWHot` |
| Consume Energy | consume-energy | 2 |  | next dragon ability: +30 ft range (or +10 area) | reaction | rules: GrantItem | `Compendium.pf2e.feats-srd.Item.9Jbl71C5C6MnOqxV` |
| Propulsive Mutation | propulsive-mutation | 6 |  | Spit Ambient Magic range 60 ft | passive | slug only | `Compendium.pf2e.feats-srd.Item.u9n11htt3dtT6CfW` |
| Wand of Reaching (1st-Rank) | wand-of-reaching-1st-rank | 4 |  | cast spell with +30 ft (touch → 30) — all ranks 1-9 same | item activation | slug only | `Compendium.pf2e.equipment-srd.Item.cyw2OgL4XJ9HOu0b` |
| Star Chart Tattoo | star-chart-tattoo | 10 |  | +30 ft for spells affecting only marked creature | item | rules: FlatModifier | `Compendium.pf2e.equipment-srd.Item.FNNfdpu1SfZtLohQ` |
| Compass of Transpositional Awareness | compass-of-transpositional-awareness | 10 |  | teleportation spells +30 ft for 1 min | item activation | slug only | `Compendium.pf2e.equipment-srd.Item.geSsIAYv85MZtppg` |
| Wand of Widening (1st-Rank Spell) *(not range)* | wand-of-widening-1st-rank-spell | 4 |  | Widen (area) — all ranks | item | REFLECTED (area-size) | `Compendium.pf2e.equipment-srd.Item.Zw3BKaJYxxxzNZ0f` |

## 5. Weapon range-increment / max-range modifiers (27)

| Name | slug | lvl | affects | change | mode | detection / runtime | uuid |
|---|---|---|---|---|---|---|---|
| Far Shot | far-shot | 4 |  | ranged weapons' range increment ×2 | passive | REFLECTED: AdjustStrike range-increment multiply 2 → WeaponPF2e#range after actor prep | `Compendium.pf2e.feats-srd.Item.r6dvGxru3FWNLVE2` |
| Far Lobber | far-lobber | 1 |  | alchemical bombs increment 30 | passive | REFLECTED (AdjustStrike upgrade 30) | `Compendium.pf2e.feats-srd.Item.BJHsCiBLdjgJo6zM` |
| Uncanny Bombs | uncanny-bombs | 12 |  | alchemical bombs increment 60 | passive | REFLECTED (AdjustStrike upgrade 60) | `Compendium.pf2e.feats-srd.Item.9Ht1eyBHsB1swpeE` |
| Strong Arm | strong-arm | 2 |  | thrown weapons +10 ft increment | passive | REFLECTED (AdjustStrike add 10, item:thrown) | `Compendium.pf2e.feats-srd.Item.OiY0L3WvjwlQQ4iG` |
| Crossbow Crack Shot | crossbow-crack-shot | 1 |  | +10 ft increment on next Strike after reloading (crossbow) | toggle | RollOption 'crossbow-crack-shot' — REFLECTED when toggle on | `Compendium.pf2e.feats-srd.Item.s6h0xkdKf3gecLk6` |
| Hurl at the Horizon | hurl-at-the-horizon | 2 |  | exemplar thrown ikon range increase | passive | REFLECTED (AdjustStrike) | `Compendium.pf2e.feats-srd.Item.VTmRh5FJTxo4btKO` |
| Favorable Winds | favorable-winds | 5 |  | +10 ft increment for Strike if increment ≤10 | action→effect | REFLECTED via feat-effects 'Effect: Favorable Winds' AdjustStrike | `Compendium.pf2e.feats-srd.Item.OK8Fm7EG8wjoYZBX` |
| Axe Thrower | axe-thrower | 6 |  | one-handed axes gain thrown 10; thrown axes +10 | passive | NOT reflected (no rules) | `Compendium.pf2e.feats-srd.Item.pewPAMlURmTqBqJx` |
| Galloping Launch | galloping-launch | 4 |  | +15/+20 ft increment for one thrown Strike | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.asELpoofuVihcqJ1` |
| Scatter Blast | scatter-blast | 6 |  | firearm +20 ft increment and scatter +20 for one Strike | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.L9sRaFl0tHT5AFIQ` |
| Throw and Catch | throw-and-catch | 18 |  | thrown 40 / +40 ft increment (mythic) | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.nbwHIS38AgSDquNu` |
| Lunging Stance | lunging-stance | 12 |  | reactive Strike vs creature within Lunge reach (+5) | stance | NOT reflected | `Compendium.pf2e.feats-srd.Item.ZghzLmYgeE19GqjP` |
| Point Blank Stance *(not range)* | point-blank-stance | 1 |  | ignore volley penalty (or +2 dmg in 1st increment) — no range change | stance | Stance effect RollOption 'self:ignore-volley-penalty' — volley handled by predicate lte target:distance; range-finder should hide/clear the volley band while stance active | `Compendium.pf2e.feats-srd.Item.Yl2wYv24v5kw95aS` |
| Far Throw *(not range)* | far-throw | 6 |  | -1 instead of -2 per extra increment (thrown) — penalty, not range | passive | rules: AdjustModifier | `Compendium.pf2e.feats-srd.Item.VYilg64xX9XpHeJr` |
| Advanced Rangefinder | advanced-rangefinder | 7 |  | innovation weapon +20 ft increment | passive | REFLECTED (ItemAlteration range-increment add 20) | `Compendium.pf2e.classfeatures.Item.P1GbGEePC8zDi8K4` |
| Omnirange Stabilizers | omnirange-stabilizers | 15 |  | remove volley or +50 ft increment | passive | REFLECTED (ItemAlteration/AdjustStrike) | `Compendium.pf2e.classfeatures.Item.GoMoEtTu9uP7nxkg` |
| Breakthrough Innovation | breakthrough-innovation | 7 |  | turret projectile launcher increment 60 | choice | check | `Compendium.pf2e.classfeatures.Item.78HIjRbGoONMpF31` |
| Weapon Infusion | weapon-infusion | 1 |  | kineticist blast: ranged 100 (volley 30) / 50 propulsive / 20 thrown; melee: reach trait | toggle | RollOption weapon-infusion:* → flags.system.kineticist.elementalBlast.infusion — REFLECTED in elemental blast config (not a WeaponPF2e) | `Compendium.pf2e.feats-srd.Item.Gvx8Mdg5mxUtTD5g` |
| Bomb Launcher | bomb-launcher | 1 |  | bombs increment 60 when launched | toggle(item) | REFLECTED (AdjustStrike predicate bomb-launcher) | `Compendium.pf2e.equipment-srd.Item.ApMC9PSOnj7cPAGL` |
| Featherlight Fletching | featherlight-fletching | 4 |  | chosen ranged weapon increment ×2 for 1 min | item→effect | REFLECTED via equipment-effects ItemAlteration multiply 2 | `Compendium.pf2e.equipment-srd.Item.FkZxKNSw75YWoA32` |
| Magnifying Scope | magnifying-scope | 3 |  | Zoom In: +5 ft increment until next turn (Greater/Major higher) | item activation | NOT reflected (no range rule) | `Compendium.pf2e.equipment-srd.Item.uTELMvkoRORmr5pm` |
| Impossible | impossible | 20 |  | ranged/thrown weapon increment doubled (rune) | passive(rune) | check | `Compendium.pf2e.equipment-srd.Item.uU4VC8OlhDHslT4i` |
| Harpoon Bolt | harpoon-bolt | 4 |  | -10 ft weapon range when fired | ammo | NOT reflected | `Compendium.pf2e.equipment-srd.Item.ZZaEVS1Vw2a8cqWS` |
| Hunter's Dawn | hunters-dawn | 23 |  | darts/javelins fired: range doubled | item | NOT reflected | `Compendium.pf2e.equipment-srd.Item.2jtZPnHF1M8vKWry` |
| Effect: Impossible Shot | effect-impossible-shot | 1 |  | range increment ×2 | effect | REFLECTED (AdjustStrike) | `Compendium.pf2e.other-effects.Item.HgWSyf7jULisWIlG` |
| Effect: Aquatic Combat | effect-aquatic-combat | 1 |  | ranged increment ×0.5 underwater | effect | REFLECTED (AdjustStrike) | `Compendium.pf2e.other-effects.Item.TPbr1kErAAJKBi3V` |
| Effect: Drop of Convergent Waters | effect-drop-of-convergent-waters | 2 |  | ranged increment ×2 | effect | REFLECTED | `Compendium.pf2e.equipment-effects.Item.YjcV6eW4u9OpSNC2` |

## 6. Reach modifiers (42)

| Name | slug | lvl | affects | change | mode | detection / runtime | uuid |
|---|---|---|---|---|---|---|---|
| Lunge | lunge | 2 |  | +5 reach for one Strike / maneuver | toggle | REFLECTED (reach.base +5) for base/'reach'-trait weapons; NOT for reach-N trait weapons (getReach returns N) | `Compendium.pf2e.feats-srd.Item.rTkr1EqpAN6YtnAh` |
| Extensible Weapon | extensible-weapon | 15 |  | innovation weapon gains reach; reach.base +5 | passive | REFLECTED | `Compendium.pf2e.classfeatures.Item.YQs4G9YK3VskY2F6` |
| Compliant Gold | compliant-gold | 12 |  | ikon gains reach; extra +5 with toggle | passive/toggle | REFLECTED | `Compendium.pf2e.feats-srd.Item.HMbpWNqksPhaxDHM` |
| Jotun's Heart | jotuns-heart | 17 |  | Huge (reach 10) +5 toggle | passive/toggle | REFLECTED (CreatureSize + ActiveEffectLike) | `Compendium.pf2e.feats-srd.Item.dnqTx5rziTrcgS3B` |
| Giant's Stature | giants-stature | 6 |  | Large, reach +5 while raging | action→effect | REFLECTED via 'Effect: Giant's Stature' (CreatureSize/ActiveEffectLike) | `Compendium.pf2e.feats-srd.Item.W21jKAcG0GtEtBiK` |
| Titan's Stature | titans-stature | 12 |  | Huge, reach +10 | action→effect | REFLECTED via 'Effect: Titan's Stature' | `Compendium.pf2e.feats-srd.Item.nI67dTzKYg5kKMsd` |
| Skeletal Extension | skeletal-extension | 10 |  | reach +10 until end of turn | free→effect | REFLECTED via 'Effect: Skeletal Extension' | `Compendium.pf2e.feats-srd.Item.KMbCpuGO6dvdSaBD` |
| Greater Transformation | greater-transformation | 9 |  | oni form reach +5 | passive | REFLECTED via Effect: Oni Form predicate | `Compendium.pf2e.feats-srd.Item.FBT84wCK2Dv3GRVO` |
| Dire Growth | dire-growth | 10 |  | Large, reach 10 (animal shape) | toggle | REFLECTED (CreatureSize) | `Compendium.pf2e.feats-srd.Item.IlygXZqCaeB9X30e` |
| Ceremony of Growth | ceremony-of-growth | 13 |  | Large reach 10 | toggle | REFLECTED | `Compendium.pf2e.feats-srd.Item.JAl4t2KINE8nI8KY` |
| Bound in Ice | bound-in-ice | 16 |  | Large, reach 10 | passive | REFLECTED | `Compendium.pf2e.feats-srd.Item.MGtlUc6cy4nCM4Lk` |
| Enlarged Chassis | enlarged-chassis | 13 |  | Large reach 10 | passive | REFLECTED | `Compendium.pf2e.feats-srd.Item.WWCZef1PBliiot9Q` |
| Dire Form | dire-form | 13 |  | Large reach 10 (hybrid) | toggle | REFLECTED | `Compendium.pf2e.feats-srd.Item.X5NRdQ1W0Y5t6MFi` |
| Scion Transformation | scion-transformation | 17 |  | Large reach 10 | passive | REFLECTED | `Compendium.pf2e.feats-srd.Item.wFtJlamwRc6rSQmj` |
| Strength of Eight Legions | strength-of-eight-legions | 17 |  | Large reach 10 | toggle | REFLECTED | `Compendium.pf2e.feats-srd.Item.yQ3YBBgkMwK0wn5b` |
| Towering Presence | towering-presence | 5 |  | Large, reach +5 (+10 if Tiny) | action | check (no rules on feat) | `Compendium.pf2e.feats-srd.Item.t3Eky3ijnAJTiCV5` |
| Assume Earth's Mantle | assume-earths-mantle | 14 |  | Large, reach +5/+10 | impulse→stance effect | REFLECTED via Stance: Assume Earth's Mantle | `Compendium.pf2e.feats-srd.Item.vV0nW9OIJ0VdeVjy` |
| Grasping Reach | grasping-reach | 1 |  | two-hand weapon gains reach (trait) | stance/toggle | REFLECTED (ItemAlteration traits +reach) | `Compendium.pf2e.feats-srd.Item.weYZzyMmlCIC2TZt` |
| Stretching Reach | stretching-reach | 5 |  | two-hand weapon gains reach (stance) | stance | check | `Compendium.pf2e.feats-srd.Item.1yXmi6vKae6J1A0L` |
| Jotun's Battle Stance | jotuns-battle-stance | 5 |  | two-hand weapon without reach gains reach 10 | stance | check | `Compendium.pf2e.feats-srd.Item.ein1K7P51cs3Qusw` |
| Looming Gait | looming-gait | 5 |  | Strike gains reach 10 | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.DfsVIWqZWzSiXShK` |
| Well-Armed | well-armed | 5 |  | +5 reach for a one-handed weapon in that arm | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.OjUfwxMcM91CHLHP` |
| Giant's Lunge | giants-lunge | 14 |  | all melee gain reach 10 until next turn | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.MFqFvuiYDAoADcft` |
| Mutate Weapon | mutate-weapon | 5 |  | attack gains reach 10 until end of turn | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.SWNmYaj0OSPhhIqO` |
| Bone Spikes | bone-spikes | 2 |  | bone spikes reach 10 until end of turn | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.cy9jqlHz75GTjg7l` |
| The Tyrant Falls! | the-tyrant-falls | 20 |  | weapon gains reach / +5 | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.H63SJLkenhLDkVnN` |
| Hulking Size | hulking-size | 8 |  | eidolon Large, reach 10 | passive | check | `Compendium.pf2e.feats-srd.Item.H6qletvAJUCC1aIa` |
| Towering Size | towering-size | 12 |  | eidolon Huge, reach 15 | passive | check | `Compendium.pf2e.feats-srd.Item.ixIKF2LMmbFthI8Z` |
| Lunging Spellstrike | lunging-spellstrike | 10 |  | staff reach +5×rank | action | NOT reflected | `Compendium.pf2e.feats-srd.Item.5tlTRfyPXkGS9Coq` |
| Nimble Reprisal *(not range)* | nimble-reprisal | 1 |  | Step to bring enemy within reach (not reach change) | passive | rules: ItemAlteration | `Compendium.pf2e.feats-srd.Item.iTdbkP07UFMOo1rI` |
| Snap Shot | snap-shot | 6 |  | ranged weapon treated as reach 5 for reactions | passive | NOT reflected | `Compendium.pf2e.feats-srd.Item.0UdHPOv3DX8TY9yb` |
| Bendy-Arm Mutagen (Lesser) | bendy-arm-mutagen-lesser | 1 |  | reach +5 (moderate +5, greater +10, major +15) | consumable→effect | REFLECTED via equipment-effects ActiveEffectLike reach.base | `Compendium.pf2e.equipment-srd.Item.9F3d43xMDCJNIkDo` |
| Tasset of Flexibility | tasset-of-flexibility | 4 |  | Lunge-like +5 for one Strike | item activation | NOT reflected | `Compendium.pf2e.equipment-srd.Item.sOaRakKoNQWTAc1e` |
| Extending | extending | 9 |  | Strike with reach 60 ft (greater 120) | rune activation | NOT reflected | `Compendium.pf2e.equipment-srd.Item.bJORQsO9E1JCJh6i` |
| Soulpiercer | soulpiercer | 12 |  | reach 15 until end of next turn | item activation | NOT reflected | `Compendium.pf2e.equipment-srd.Item.wIAmDPFsRIjKQl1A` |
| Morphing Weapon | morphing-weapon | 7 |  | +5 reach option on Strike | item | NOT reflected | `Compendium.pf2e.equipment-srd.Item.WJTtO3mI3BlYyBMg` |
| Flurrying | flurrying | 7 |  | echo Strike reach 30 | rune activation | NOT reflected | `Compendium.pf2e.equipment-srd.Item.GNX0BNOoCSOYPedi` |
| Spell Effect: Enlarge | spell-effect-enlarge | 2 |  | Large reach 10 / Huge 15 | spell effect | REFLECTED (CreatureSize reach) | `Compendium.pf2e.spell-effects.Item.sPCWrhUHqlbGhYSD` |
| Spell Effect: Shrink | spell-effect-shrink | 2 |  | Tiny reach 0 | spell effect | REFLECTED | `Compendium.pf2e.spell-effects.Item.LXf1Cqi1zyo4DaLv` |
| Spell Effect: Untamed Shift | spell-effect-untamed-shift | 1 |  | long vines reach 10 | spell effect | REFLECTED | `Compendium.pf2e.spell-effects.Item.rTVZ0zwiKeslRw6p` |
| Effect: Giant's Stature | effect-giants-stature | 6 |  | reach +5 (Large) — note: uses reach.value/manipulate paths too | effect | REFLECTED | `Compendium.pf2e.feat-effects.Item.6VrKQ0PhRXuteusQ` |
| Effect: Instinct Crown | effect-instinct-crown | 10 |  | Large reach +5/+10 | effect | REFLECTED | `Compendium.pf2e.equipment-effects.Item.1eoxVAx1z9AoNKTt` |

Also: ~45 battle-form spell effects (Animal/Dinosaur/Dragon/Demon/... Form) set strikes with reach-N traits via BattleForm rules — REFLECTED through actor strikes (getReach with weapon). Weapon traits `reach`, `reach-N`, `trip/shove/disarm/grapple/reposition`, `ranged-trip`, `thrown-N`, `volley-N` are on the item.

## 7. DOM / hooks

### pf2eHudSkills
- **hooks**: renderSkillsSidebarPF2eHUD, renderSidebarPF2eHUD
- **appClass**: SkillsSidebarPF2eHUD extends SidebarPF2eHUD extends foundry.applications.api.ApplicationV2
- **rootId**: pf2e-hud-sidebar
- **rootDataset**: data-type='skills', data-hud='<token|persistent>'
- **row**: .statistic-wrapper > .item.statistic[data-item-uuid][data-statistic]
- **rowKeyOn**: a[data-action='roll-statistic-action'][data-key] (only when proficient & no variants); variants: .variants > .variant[data-key][data-variant]
- **hostSuggestion**: .item.statistic > .controls (prepend button)
- **identify**: map data-item-uuid → action slug (keys differ: 'bonMot', 'treatWounds'); Natural Medicine row uses feat uuid WC4xLBGmBsdOdHWu under data-statistic='nature'
- **actor**: app.actor

### pf2eHudActions
- **hooks**: renderActionsSidebarPF2eHUD
- **row**: .item.action[data-item-id] (owned action/feat items; virtual ones carry data-item-uuid)
- **identify**: app.actor.items.get(itemId)?.slug

### pf2eCharacterSheet
- **hooks**: renderCharacterSheetPF2e
- **appClass**: CharacterSheetPF2e (AppV1, foundry.appv1.sheets.ActorSheet)
- **note**: Sheet does NOT list generic skill actions (Demoralize etc.) unless the actor owns an action item. Encounter/Exploration/Downtime lists: ol.actions-list > li.action.item[data-item-id][data-uuid]; host: .button-group or h4.name. Proficiencies tab: li[data-statistic=<skill>] (skills only, no actions).
