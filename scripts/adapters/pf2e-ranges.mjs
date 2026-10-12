/**
 * PF2e/SF2e ranges the system doesn't carry. Data only — curated from docs/research/pf2e-range-catalog.json (pf2e 8.6.0).
 * Rules: { kind: 'radius', feet, label? } | { kind: 'emanation', feet } | { kind: 'adjacent' } | { kind: 'touch' } | { kind: 'reach' }
 *        | { kind: 'maneuver', trait, rangedTrait? } (best reach of equipped weapons with `trait`, else base reach)
 *        | { kind: 'weapon', use: 'increment'|'max', group?, hands? } (a wielded ranged weapon's first increment / max range)
 */

/** Base skill actions anyone can take (pf2e-hud skills sidebar, Token HUD "Skill actions"). */
export const SKILL_ACTIONS = {
  demoralize: { name: 'Demoralize', uuid: 'Compendium.pf2e.actionspf2e.Item.2u915NdUyQan6uKF', range: { kind: 'radius', feet: 30 } },
  feint: { name: 'Feint', uuid: 'Compendium.pf2e.actionspf2e.Item.QNAVeNKtHA0EUw4X', range: { kind: 'reach' } },
  shove: { name: 'Shove', uuid: 'Compendium.pf2e.actionspf2e.Item.7blmbDrQFNfdT731', range: { kind: 'maneuver', trait: 'shove' } },
  trip: { name: 'Trip', uuid: 'Compendium.pf2e.actionspf2e.Item.ge56Lu1xXVFYUnLP', range: { kind: 'maneuver', trait: 'trip', rangedTrait: 'ranged-trip' } },
  disarm: { name: 'Disarm', uuid: 'Compendium.pf2e.actionspf2e.Item.Dt6B1slsBy8ipJu9', range: { kind: 'maneuver', trait: 'disarm' } },
  grapple: { name: 'Grapple', uuid: 'Compendium.pf2e.actionspf2e.Item.PMbdMWc2QroouFGD', range: { kind: 'maneuver', trait: 'grapple' } },
  reposition: { name: 'Reposition', uuid: 'Compendium.pf2e.actionspf2e.Item.lOE4yjUnETTdaf2T', range: { kind: 'maneuver', trait: 'reposition' } },
  'administer-first-aid': { name: 'Administer First Aid', uuid: 'Compendium.pf2e.actionspf2e.Item.MHLuKy4nQO2Z4Am1', range: { kind: 'adjacent' } },
  // pf2e-hud lists Natural Medicine (feat uuid) under the same treatWounds key.
  'treat-wounds': { name: 'Treat Wounds', uuid: 'Compendium.pf2e.actionspf2e.Item.1kGNdIIhuglAjIp9', aliases: ['Compendium.pf2e.feats-srd.Item.WC4xLBGmBsdOdHWu'], range: { kind: 'adjacent' } },
  'treat-poison': { name: 'Treat Poison', uuid: 'Compendium.pf2e.actionspf2e.Item.KjoCEEmPGTeFE4hh', range: { kind: 'adjacent' } },
  'treat-disease': { name: 'Treat Disease', uuid: 'Compendium.pf2e.actionspf2e.Item.TC7OcDa7JlWbqMaN', range: { kind: 'adjacent' } },
  steal: { name: 'Steal', uuid: 'Compendium.pf2e.actionspf2e.Item.RDXXE7wMrSPCLv5k', range: { kind: 'adjacent' } },
  'palm-an-object': { name: 'Palm an Object', uuid: 'Compendium.pf2e.actionspf2e.Item.ijZ0DDFpMkWqaShd', range: { kind: 'adjacent' } }
};

/** Feat / feature actions that are ranged skill checks: shown when the actor owns them (by slug). */
export const FEAT_ACTIONS = {
  'bon-mot': { name: 'Bon Mot', uuid: 'Compendium.pf2e.feats-srd.Item.0GF2j54roPFIDmXf', range: { kind: 'radius', feet: 30 } },
  'scare-to-death': { name: 'Scare to Death', uuid: 'Compendium.pf2e.feats-srd.Item.mZttsiWl1ql5NvrH', range: { kind: 'radius', feet: 30 } },
  'dirty-trick': { name: 'Dirty Trick', uuid: 'Compendium.pf2e.feats-srd.Item.5eNKs6738aykAhK2', range: { kind: 'reach' } },
  'battle-medicine': { name: 'Battle Medicine', uuid: 'Compendium.pf2e.feats-srd.Item.wYerMk6F1RZb0Fwt', range: { kind: 'adjacent' } },
  'terrifying-howl': { name: 'Terrifying Howl', uuid: 'Compendium.pf2e.feats-srd.Item.HjinlKihkadhkQ4Z', range: { kind: 'emanation', feet: 30 } },
  'dazzling-display': { name: 'Dazzling Display', uuid: 'Compendium.pf2e.feats-srd.Item.lk80TBn933RECRD7', range: { kind: 'emanation', feet: 30 } },
  'deimatic-display': { name: 'Deimatic Display', uuid: 'Compendium.pf2e.feats-srd.Item.UFVw57jWNC4UCfyN', range: { kind: 'emanation', feet: 30 } },
  'terrifying-transformation': { name: 'Terrifying Transformation', uuid: 'Compendium.pf2e.feats-srd.Item.rAUNZfiulXh4zcm6', range: { kind: 'emanation', feet: 30 } },
  'majestic-proclamation': { name: 'Majestic Proclamation', uuid: 'Compendium.pf2e.feats-srd.Item.SWkeel82rdttxUD3', range: { kind: 'emanation', feet: 30 } },
  'brandish-authority': { name: 'Brandish Authority', uuid: 'Compendium.pf2e.feats-srd.Item.nkYBSuqCWcIgqjj0', range: { kind: 'emanation', feet: 30 } },
  'reach-for-the-sky': { name: 'Reach for the Sky', uuid: 'Compendium.pf2e.feats-srd.Item.ssrublnppwFSvVcb', range: { kind: 'emanation', feet: 30 } },
  'threatening-pursuit': { name: 'Threatening Pursuit', uuid: 'Compendium.pf2e.feats-srd.Item.DJn652sW7nstvXf5', range: { kind: 'emanation', feet: 30 } },
  'tut-tut': { name: 'Tut-Tut', uuid: 'Compendium.pf2e.feats-srd.Item.0ptK0blZehF3ABha', range: { kind: 'emanation', feet: 30 } },
  'flash-your-badge': { name: 'Flash Your Badge', uuid: 'Compendium.pf2e.feats-srd.Item.qbFRPTHP96Q9kGpk', range: { kind: 'radius', feet: 30, label: 'Cone 30 ft' } },
  'talmandors-shout': { name: 'Talmandor\'s Shout', uuid: 'Compendium.pf2e.feats-srd.Item.j305O6rhKvx4sT38', range: { kind: 'emanation', feet: 60 } },
  'terrifying-croak': { name: 'Terrifying Croak', uuid: 'Compendium.pf2e.feats-srd.Item.T8tNZANOWUZiXuzO', range: { kind: 'radius', feet: 30 } },
  'sudden-terror': { name: 'Sudden Terror', uuid: 'Compendium.pf2e.feats-srd.Item.tXn6fJO3Q2dAvCZC', range: { kind: 'radius', feet: 30 } },
  'terrifying-invocation': { name: 'Terrifying Invocation', uuid: 'Compendium.pf2e.feats-srd.Item.HZE37GeNGeBeutZk', range: { kind: 'radius', feet: 30 } },
  'do-you-know-who-i-am': { name: 'Do You Know Who I Am?', uuid: 'Compendium.pf2e.feats-srd.Item.1Z4ps6u7RtA57ksK', range: { kind: 'radius', feet: 30 } },
  'watch-your-back': { name: 'Watch Your Back', uuid: 'Compendium.pf2e.feats-srd.Item.zZCyJhsaugHB6mZW', range: { kind: 'radius', feet: 30 } },
  'edict-of-mortality': { name: 'Edict of Mortality', uuid: 'Compendium.pf2e.feats-srd.Item.pYYSLNUWGMYxYNkG', range: { kind: 'emanation', feet: 60 } },
  'unfaltering-ranks': { name: 'Unfaltering Ranks', uuid: 'Compendium.pf2e.feats-srd.Item.UseAF1tBCb9O2eO7', range: { kind: 'emanation', feet: 60 } },
  'divine-disharmony': { name: 'Divine Disharmony', uuid: 'Compendium.pf2e.feats-srd.Item.fUR72e3t7p2IcqqG', range: { kind: 'radius', feet: 60 } },
  'feign-innocence': { name: 'Feign Innocence', uuid: 'Compendium.pf2e.feats-srd.Item.UhyoBNQbGP6lKjwE', range: { kind: 'radius', feet: 60 } },
  'fabricate-truth': { name: 'Fabricate Truth', uuid: 'Compendium.pf2e.feats-srd.Item.p2McwseYbPZrL5G3', range: { kind: 'radius', feet: 30 } },
  perplex: { name: 'Perplex', uuid: 'Compendium.pf2e.feats-srd.Item.ctl5zNJC3APlHg9o', range: { kind: 'radius', feet: 30 } },
  'guiding-words': { name: 'Guiding Words', uuid: 'Compendium.pf2e.feats-srd.Item.LmsjuqB3rrZTqqa6', range: { kind: 'radius', feet: 30 } },
  'no-cause-for-alarm': { name: 'No Cause for Alarm', uuid: 'Compendium.pf2e.feats-srd.Item.6ON8DjFXSMITZleX', range: { kind: 'emanation', feet: 10 } },
  'seasoned-command': { name: 'Seasoned Command', uuid: 'Compendium.pf2e.feats-srd.Item.c2hPWQ4zdc4CnrnZ', range: { kind: 'radius', feet: 30 } },
  'commitment-to-equality': { name: 'Commitment to Equality', uuid: 'Compendium.pf2e.feats-srd.Item.TMwqXqqggiblvEGZ', range: { kind: 'radius', feet: 30 } },
  'goblin-song': { name: 'Goblin Song', uuid: 'Compendium.pf2e.feats-srd.Item.QZb0Utg0WFPf2Qg0', range: { kind: 'radius', feet: 30 } },
  'catchy-tune': { name: 'Catchy Tune', uuid: 'Compendium.pf2e.feats-srd.Item.ACXWB7a38ETc32Qj', range: { kind: 'emanation', feet: 30 } },
  'alluring-performance': { name: 'Alluring Performance', uuid: 'Compendium.pf2e.feats-srd.Item.VtFuhfIIw8OoLF6v', range: { kind: 'emanation', feet: 15 } },
  primadonna: { name: 'Primadonna', uuid: 'Compendium.pf2e.feats-srd.Item.pBP8KL1yPU3W1Kmh', range: { kind: 'emanation', feet: 30 } },
  'flourishing-finish': { name: 'Flourishing Finish', uuid: 'Compendium.pf2e.feats-srd.Item.isdTXU8bV7ZVOAuQ', range: { kind: 'emanation', feet: 30 } },
  'dance-of-the-jester': { name: 'Dance of the Jester', uuid: 'Compendium.pf2e.feats-srd.Item.ycmxU7gySnfsO1Se', range: { kind: 'radius', feet: 30 } },
  'dance-of-the-tiger': { name: 'Dance of the Tiger', uuid: 'Compendium.pf2e.feats-srd.Item.3xKOqBaPApgsnRtB', range: { kind: 'adjacent' } },
  'leading-dance': { name: 'Leading Dance', uuid: 'Compendium.pf2e.feats-srd.Item.ZHPSASbvbbshq1zG', range: { kind: 'adjacent' } },
  'gunpowder-gauntlet': { name: 'Gunpowder Gauntlet', uuid: 'Compendium.pf2e.feats-srd.Item.FbzbZc4LGUTcz9tA', range: { kind: 'weapon', use: 'increment', group: 'firearm' } },
  'disturbing-knowledge': { name: 'Disturbing Knowledge', uuid: 'Compendium.pf2e.feats-srd.Item.hkSuxXOc9qBleJbd', range: { kind: 'radius', feet: 30 } },
  'battle-prayer': { name: 'Battle Prayer', uuid: 'Compendium.pf2e.feats-srd.Item.nBlzWZnmYuFHrMyV', range: { kind: 'radius', feet: 30 } },
  'banish-falsehoods-of-flesh': { name: 'Banish Falsehoods of Flesh', uuid: 'Compendium.pf2e.feats-srd.Item.Rp8h8cmFIsfDlw7q', range: { kind: 'radius', feet: 30 } },
  'improvise-strategy': { name: 'Improvise Strategy', uuid: 'Compendium.pf2e.feats-srd.Item.XbMfMJq2sCQHdo1w', range: { kind: 'radius', feet: 30 } },
  'unfazed-assessment': { name: 'Unfazed Assessment', uuid: 'Compendium.pf2e.feats-srd.Item.ZyQYP7i26DWhMNux', range: { kind: 'radius', feet: 30 } },
  'sense-alignment': { name: 'Sense Alignment', uuid: 'Compendium.pf2e.feats-srd.Item.iyXw5PnevT2jT8kU', range: { kind: 'radius', feet: 30 } },
  'battlefront-sabotage': { name: 'Battlefront Sabotage', uuid: 'Compendium.pf2e.feats-srd.Item.FtnFytJxa2ix1r5z', range: { kind: 'reach' } },
  tamper: { name: 'Tamper', uuid: 'Compendium.pf2e.feats-srd.Item.SheifYobjKqyK3Fv', range: { kind: 'reach' } },
  'helpful-tinkering': { name: 'Helpful Tinkering', uuid: 'Compendium.pf2e.feats-srd.Item.qUSWPWxYF8gfhfHM', range: { kind: 'reach' } },
  sabotage: { name: 'Sabotage', uuid: 'Compendium.pf2e.feats-srd.Item.vDeG0N4kzTBDTC2b', range: { kind: 'reach' } },
  'surgical-shock': { name: 'Surgical Shock', uuid: 'Compendium.pf2e.feats-srd.Item.zzjfENthtRBAjqjQ', range: { kind: 'reach' } },
  'treat-condition': { name: 'Treat Condition', uuid: 'Compendium.pf2e.feats-srd.Item.rfnEcjxIFqwlJwJT', range: { kind: 'adjacent' } },
  'catfolk-dance': { name: 'Catfolk Dance', uuid: 'Compendium.pf2e.feats-srd.Item.Iqv8qj7ym63YjexN', range: { kind: 'adjacent' } },
  'log-roll': { name: 'Log Roll', uuid: 'Compendium.pf2e.feats-srd.Item.SjJ8BOy5sc8p2H5E', range: { kind: 'adjacent' } },
  'tumbling-strike': { name: 'Tumbling Strike', uuid: 'Compendium.pf2e.feats-srd.Item.jfsmtOx4QgXB19BL', range: { kind: 'adjacent' } },
  'freeze-it': { name: 'Freeze It!', uuid: 'Compendium.pf2e.feats-srd.Item.LhpE0NsfNwYP6MOz', range: { kind: 'adjacent' } },
  'wing-buffet': { name: 'Wing Buffet', uuid: 'Compendium.pf2e.feats-srd.Item.tPi6FAnHYe6ijuyk', range: { kind: 'adjacent' } },
  'bestial-snarling': { name: 'Bestial Snarling', uuid: 'Compendium.pf2e.feats-srd.Item.nCmsylaV144Pr4TZ', range: { kind: 'adjacent' } },
  'daring-act': { name: 'Daring Act', uuid: 'Compendium.pf2e.feats-srd.Item.cny7ouhsoiNsWJ7X', range: { kind: 'reach' } },
  'lassoing-lash': { name: 'Lassoing Lash', uuid: 'Compendium.pf2e.feats-srd.Item.9O7DLcXVXpwLVXI6', range: { kind: 'reach' } },
  'denounce-tyranny': { name: 'Denounce Tyranny', uuid: 'Compendium.pf2e.feats-srd.Item.ISjnymvdFOPED9um', range: { kind: 'radius', feet: 30 } },
  'pistoleros-challenge': { name: 'Pistolero\'s Challenge', uuid: 'Compendium.pf2e.feats-srd.Item.yOyMlFGAgLfRas8m', range: { kind: 'radius', feet: 30 } },
  'stages-of-fate': { name: 'Stages of Fate', uuid: 'Compendium.pf2e.feats-srd.Item.zJsu5JQGGOpyT6Xk', range: { kind: 'radius', feet: 30 } },
  'encouraging-words': { name: 'Encouraging Words', uuid: 'Compendium.pf2e.feats-srd.Item.dUnT3HWMFD3d2eBJ', range: { kind: 'radius', feet: 30 } },
  'declare-anathema': { name: 'Declare Anathema', uuid: 'Compendium.pf2e.feats-srd.Item.7P5aKtFoPVJJPPEV', range: { kind: 'radius', feet: 30 } },
  'flower-street-infamy': { name: 'Flower Street Infamy', uuid: 'Compendium.pf2e.feats-srd.Item.rgmX9TTthBYo508T', range: { kind: 'radius', feet: 30 } },
  'youre-next': { name: 'You\'re Next', uuid: 'Compendium.pf2e.feats-srd.Item.gjec0ts3wkFbjvHN', range: { kind: 'radius', feet: 60 } },
  'warning-shot': { name: 'Warning Shot', uuid: 'Compendium.pf2e.feats-srd.Item.XQEoKoFtq8n3wgA3', range: { kind: 'weapon', use: 'max', group: 'firearm' } },
  'talent-envy': { name: 'Talent Envy', uuid: 'Compendium.pf2e.feats-srd.Item.RR6p9r8l1trcByl2', range: { kind: 'radius', feet: 60 } },
  'pistol-twirl': { name: 'Pistol Twirl', uuid: 'Compendium.pf2e.feats-srd.Item.A2EBy2L4acrehiAA', range: { kind: 'weapon', use: 'increment', hands: '1' } },
  'distracting-toss': { name: 'Distracting Toss', uuid: 'Compendium.pf2e.feats-srd.Item.lGuoGim7J8Z97kor', range: { kind: 'radius', feet: 30 } },
  'prayer-attack': { name: 'Prayer Attack', uuid: 'Compendium.pf2e.feats-srd.Item.AtpMrGXaMPJtDIDR', range: { kind: 'radius', feet: 30 } },
  'it-was-me-all-along': { name: 'It Was Me All Along!', uuid: 'Compendium.pf2e.feats-srd.Item.hPfqQpiq6W8RPCxz', range: { kind: 'radius', feet: 30 } },
  'wave-spiral': { name: 'Wave Spiral', uuid: 'Compendium.pf2e.feats-srd.Item.fLlCodqKXyXbZR7C', range: { kind: 'emanation', feet: 10 } },
  'clear-the-way': { name: 'Clear the Way', uuid: 'Compendium.pf2e.feats-srd.Item.goFxIDlbWd8GN0kj', range: { kind: 'adjacent' } },
  'one-for-all': { name: 'One for All', uuid: 'Compendium.pf2e.feats-srd.Item.bCizH4ByTwbLcYA1', range: { kind: 'radius', feet: 30 } },
  'dimensional-pilfer': { name: 'Dimensional Pilfer', uuid: 'Compendium.pf2e.feats-srd.Item.g3J3kSfnlYjq34Md', range: { kind: 'radius', feet: 60 } },
  'thief-of-moonlight': { name: 'Thief of Moonlight', uuid: 'Compendium.pf2e.classfeatures.Item.hNBYP7FbvIBoS9CV', range: { kind: 'radius', feet: 30 } }
};

/** Owned feats that change a base action's range (longest wins). `toggle`: only while that roll option is on. */
export const SKILL_MODIFIERS = {
  'legendary-laugh': { actions: ['demoralize'], set: 60 },
  'cunning-trickster-mask': { actions: ['feint'], set: 30 },
  'hydraulic-maneuvers': { actions: ['disarm', 'shove', 'trip'], set: 15, toggle: 'hydraulic-maneuvers' },
  'mages-field-dressing': { actions: ['battle-medicine'], set: 60 },
  'loud-singer': { actions: ['goblin-song'], set: 60 }
};

/**
 * Spell range changes SpellPF2e#range ignores. `perUse`: cast-time choice → Alt+click variant.
 * add: +feet to a ranged spell; touch: touch → that many feet; touchReach: touch reach becomes N;
 * touchOverlay: extra outline around touch spells; set: fixed range for `spells`; toTouch: ranged → touch.
 */
export const SPELL_MODIFIERS = {
  'reach-spell': { label: 'Reach Spell', perUse: true, add: 30, touch: 30 },
  'grasping-spirits-spell': { label: 'Grasping Spirits Spell', perUse: true, add: 30, touch: 30 },
  'wand-of-reaching': { label: 'Wand of Reaching', perUse: true, prefix: true, add: 30, touch: 30 },
  'touch-focus': { label: 'Touch Focus', toggle: 'touch-focus', toTouch: true },
  'midnight-illusionist-dedication': { label: 'Midnight Illusionist', touchReach: 10 },
  'witchs-charge': { label: 'Witch\'s Charge', touchOverlay: 30 },
  'seven-part-link': { label: 'Seven-Part Link', touchOverlay: 30 },
  'the-distant-grasp': { label: 'The Distant Grasp', spells: ['telekinetic-projectile'], set: 60 },
  'the-oscillating-wave': { label: 'The Oscillating Wave', spells: ['ignition'], set: 60 },
  'the-silent-whisper': { label: 'The Silent Whisper', spells: ['daze'], set: 120 },
  'the-infinite-eye': { label: 'The Infinite Eye', spells: ['guidance'], set: 120 },
  'the-tangible-dream': { label: 'The Tangible Dream', spells: ['figment'], set: 60 }
};

/** Range-increment changes WeaponPF2e#range doesn't reflect. `grant`: gives a thrown increment to matching weapons. */
export const WEAPON_MODIFIERS = {
  'axe-thrower': { label: 'Axe Thrower', when: { group: 'axe', thrown: true }, add: 10, grant: { when: { group: 'axe', hands: '1', melee: true }, thrown: 10 } },
  'harpoon-bolt': { label: 'Harpoon Bolt', source: 'ammo', add: -10 },
  'magnifying-scope': { label: 'Zoom In', source: 'attachment', perUse: true, add: 5 },
  'galloping-launch': { label: 'Galloping Launch', perUse: true, when: { thrown: true }, add: 15 },
  'throw-and-catch': { label: 'Throw and Catch', perUse: true, when: { thrown: true }, add: 40 },
  'scatter-blast': { label: 'Scatter Blast', perUse: true, when: { group: 'firearm' }, add: 20 }
};

/** Reach changes CreaturePF2e#getReach doesn't reflect. Lunge: the system ignores it for reach-N weapons. */
export const REACH_MODIFIERS = {
  lunge: { label: 'Lunge', source: 'toggle', toggle: 'lunge', when: { reachN: true }, add: 5 },
  'looming-gait': { label: 'Looming Gait', perUse: true, set: 10 },
  'well-armed': { label: 'Well-Armed', perUse: true, when: { hands: '1' }, add: 5 },
  'giants-lunge': { label: 'Giant\'s Lunge', perUse: true, set: 10 },
  'mutate-weapon': { label: 'Mutate Weapon', perUse: true, set: 10 },
  extending: { label: 'Extending', source: 'rune', perUse: true, set: 60 },
  greaterExtending: { label: 'Greater Extending', source: 'rune', perUse: true, set: 120 },
  soulpiercer: { label: 'Soulpiercer', source: 'weapon', perUse: true, set: 15 },
  'tasset-of-flexibility': { label: 'Tasset of Flexibility', perUse: true, add: 5 }
};
