// Game data: all items, recipes, and targets
// All items trace back to 4 base materials: Human, Fire, Magic, Beast

const BASE_ITEMS = ['Human', 'Fire', 'Magic', 'Beast'];

// Item definitions: emoji + tier
const ITEMS = {
  // --- Base (tier 0) ---
  'Human':   { tier: 0, emoji: '👤' },
  'Fire':    { tier: 0, emoji: '🔥' },
  'Magic':   { tier: 0, emoji: '⚡' },
  'Beast':   { tier: 0, emoji: '🐾' },

  // --- Tier 1: two base materials ---
  'Warrior':   { tier: 1, emoji: '⚔️' },
  'Wizard':    { tier: 1, emoji: '🔮' },
  'Hunter':    { tier: 1, emoji: '🏹' },
  'Hellhound': { tier: 1, emoji: '🐕' },
  'Ember':     { tier: 1, emoji: '✨' },
  'Monster':   { tier: 1, emoji: '👾' },
  'Soldier':   { tier: 1, emoji: '🪖' },
  'Wildfire':  { tier: 1, emoji: '💥' },

  // --- Tier 2: base+tier1 or tier1+tier1 ---
  'Paladin':     { tier: 2, emoji: '🛡️' },
  'Berserker':   { tier: 2, emoji: '💢' },
  'Fire Knight': { tier: 2, emoji: '🔥' },
  'Pyromancer':  { tier: 2, emoji: '🌋' },
  'Druid':       { tier: 2, emoji: '🌿' },
  'Necromancer': { tier: 2, emoji: '💀' },
  'Ranger':      { tier: 2, emoji: '🎯' },
  'Dragon':      { tier: 2, emoji: '🐉' },
  'Demon':       { tier: 2, emoji: '😈' },
  'Vampire':     { tier: 2, emoji: '🧛' },
  'Cerberus':    { tier: 2, emoji: '🐺' },
  'Griffin':     { tier: 2, emoji: '🦅' },

  // --- Tier 3: targets ---
  'Dragon Knight': { tier: 3, emoji: '⚜️' },
  'Archmage':      { tier: 3, emoji: '🌟' },
  'Dark Lord':     { tier: 3, emoji: '👑' },
  'Lich':          { tier: 3, emoji: '☠️' },
  'Beastmaster':   { tier: 3, emoji: '🦁' },
  'Phoenix':       { tier: 3, emoji: '🔥' },
};

// Recipes: [ingredientA, ingredientB, result]
// Commutative: A+B = B+A (handled by engine)
const RECIPES = [
  // ── Tier 1 primaries (8) ──────────────────────────────
  ['Human',  'Fire',   'Warrior'],
  ['Human',  'Magic',  'Wizard'],
  ['Human',  'Beast',  'Hunter'],
  ['Fire',   'Beast',  'Hellhound'],
  ['Fire',   'Magic',  'Ember'],
  ['Magic',  'Beast',  'Monster'],
  ['Human',  'Human',  'Soldier'],
  ['Fire',   'Fire',   'Wildfire'],

  // ── Tier 2 primaries (12) ────────────────────────────
  ['Warrior',   'Magic',     'Paladin'],
  ['Warrior',   'Beast',     'Berserker'],
  ['Warrior',   'Hellhound', 'Fire Knight'],
  ['Wizard',    'Fire',      'Pyromancer'],
  ['Wizard',    'Beast',     'Druid'],
  ['Wizard',    'Monster',   'Necromancer'],
  ['Hunter',    'Ember',     'Ranger'],
  ['Monster',   'Fire',      'Dragon'],
  ['Monster',   'Magic',     'Demon'],
  ['Monster',   'Human',     'Vampire'],
  ['Hellhound', 'Magic',     'Cerberus'],
  ['Ember',     'Beast',     'Griffin'],

  // ── Tier 2 alternates (8) ────────────────────────────
  ['Soldier',   'Magic',     'Paladin'],
  ['Soldier',   'Beast',     'Berserker'],
  ['Hunter',    'Hellhound', 'Ranger'],
  ['Wildfire',  'Beast',     'Dragon'],
  ['Hellhound', 'Wizard',    'Dragon'],
  ['Hunter',    'Monster',   'Vampire'],
  ['Druid',     'Fire',      'Pyromancer'],
  ['Hellhound', 'Ember',     'Cerberus'],

  // ── Tier 3 primaries (6) ─────────────────────────────
  ['Dragon',      'Warrior',    'Dragon Knight'],
  ['Pyromancer',  'Magic',      'Archmage'],
  ['Demon',       'Human',      'Dark Lord'],
  ['Necromancer', 'Dragon',     'Lich'],
  ['Druid',       'Hellhound',  'Beastmaster'],
  ['Ember',       'Wildfire',   'Phoenix'],

  // ── Tier 3 alternates (14) ───────────────────────────
  ['Dragon',    'Human',       'Dragon Knight'],
  ['Paladin',   'Dragon',      'Dragon Knight'],
  ['Dragon',    'Wizard',      'Archmage'],
  ['Griffin',   'Wizard',      'Archmage'],
  ['Pyromancer','Dragon',      'Archmage'],
  ['Vampire',   'Magic',       'Dark Lord'],
  ['Demon',     'Paladin',     'Dark Lord'],
  ['Demon',     'Wizard',      'Lich'],
  ['Vampire',   'Necromancer', 'Lich'],
  ['Berserker', 'Monster',     'Beastmaster'],
  ['Ranger',    'Dragon',      'Beastmaster'],
  ['Cerberus',  'Ember',       'Phoenix'],
  ['Griffin',   'Ember',       'Phoenix'],
  ['Dragon',    'Fire',        'Phoenix'],
];

// 10 targets: 3 easy / 3 medium / 4 hard
const TARGETS = [
  { name: 'Warrior',       difficulty: 'easy' },
  { name: 'Wizard',        difficulty: 'easy' },
  { name: 'Monster',       difficulty: 'easy' },
  { name: 'Dragon',        difficulty: 'medium' },
  { name: 'Paladin',       difficulty: 'medium' },
  { name: 'Necromancer',   difficulty: 'medium' },
  { name: 'Dragon Knight', difficulty: 'hard' },
  { name: 'Archmage',      difficulty: 'hard' },
  { name: 'Dark Lord',     difficulty: 'hard' },
  { name: 'Phoenix',       difficulty: 'hard' },
];

// Shortest solution path for each target: [ingredientA, ingredientB, result][]
// Shown in the end-game overlay so players learn the recipes
const SOLUTIONS = {
  'Warrior':       [['Human',  'Fire',      'Warrior']],
  'Wizard':        [['Human',  'Magic',     'Wizard']],
  'Monster':       [['Magic',  'Beast',     'Monster']],
  'Dragon':        [['Magic',  'Beast',     'Monster'],   ['Monster',    'Fire',   'Dragon']],
  'Paladin':       [['Human',  'Fire',      'Warrior'],   ['Warrior',    'Magic',  'Paladin']],
  'Necromancer':   [['Human',  'Magic',     'Wizard'],    ['Magic',      'Beast',  'Monster'],  ['Wizard', 'Monster', 'Necromancer']],
  'Dragon Knight': [['Magic',  'Beast',     'Monster'],   ['Monster',    'Fire',   'Dragon'],   ['Human',  'Fire',    'Warrior'],   ['Dragon', 'Warrior', 'Dragon Knight']],
  'Archmage':      [['Human',  'Magic',     'Wizard'],    ['Wizard',     'Fire',   'Pyromancer'], ['Pyromancer', 'Magic', 'Archmage']],
  'Dark Lord':     [['Magic',  'Beast',     'Monster'],   ['Monster',    'Magic',  'Demon'],     ['Demon',  'Human',  'Dark Lord']],
  'Phoenix':       [['Fire',   'Magic',     'Ember'],     ['Fire',       'Fire',   'Wildfire'],  ['Ember',  'Wildfire', 'Phoenix']],
};

// PvE mode: 5 stages with increasing difficulty + time limits (seconds)
// Inventory resets to BASE_ITEMS at each stage start
// baseScore: points for completing the stage; time bonus = floor(timeLeft/timeLimit * baseScore)
const PVE_STAGES = [
  { stage: 1, target: 'Warrior',       timeLimit: 60,  label: 'Stage 1 — Warrior',       baseScore: 100 },
  { stage: 2, target: 'Dragon',        timeLimit: 75,  label: 'Stage 2 — Dragon',         baseScore: 200 },
  { stage: 3, target: 'Paladin',       timeLimit: 60,  label: 'Stage 3 — Paladin',        baseScore: 300 },
  { stage: 4, target: 'Necromancer',   timeLimit: 60,  label: 'Stage 4 — Necromancer',    baseScore: 400 },
  { stage: 5, target: 'Dragon Knight', timeLimit: 90,  label: 'Stage 5 — Dragon Knight',  baseScore: 500 },
];
