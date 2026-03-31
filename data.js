// Game data: items, recipes, targets, PvE stages, solutions
// 5 thematic groups: Fantasy · Tech · Combat · Society · Science/Media
// Each match provides 4 starting items; 1-2 are distractors

const BASE_ITEMS = ['Human', 'Fire', 'Magic', 'Beast']; // used only by Free Craft mode

// ── Item definitions ──────────────────────────────────────────────────────────
const ITEMS = {
  // Tier 0: raw starting materials
  'Human':    { tier: 0, emoji: '👤' },
  'Magic':    { tier: 0, emoji: '✨' },
  'Fire':     { tier: 0, emoji: '🔥' },
  'Beast':    { tier: 0, emoji: '🐾' },
  'Machine':  { tier: 0, emoji: '⚙️' },
  'Energy':   { tier: 0, emoji: '⚡' },
  'Data':     { tier: 0, emoji: '💾' },
  'Tool':     { tier: 0, emoji: '🔧' },
  'Material': { tier: 0, emoji: '🪨' },
  'Land':     { tier: 0, emoji: '🌍' },
  'Weapon':   { tier: 0, emoji: '⚔️' },
  'Training': { tier: 0, emoji: '🏋️' },
  'Armor':    { tier: 0, emoji: '🛡️' },
  'Engine':   { tier: 0, emoji: '🔩' },
  'Metal':    { tier: 0, emoji: '⛏️' },
  'Wheel':    { tier: 0, emoji: '🛞' },
  'Food':     { tier: 0, emoji: '🍖' },
  'Game':     { tier: 0, emoji: '🎮' },
  'Camera':   { tier: 0, emoji: '📷' },
  'Funny':    { tier: 0, emoji: '😂' },
  'Space':    { tier: 0, emoji: '🌌' },
  'Gravity':  { tier: 0, emoji: '🌀' },
  'Water':    { tier: 0, emoji: '💧' },
  'Cold':     { tier: 0, emoji: '❄️' },
  'Air':      { tier: 0, emoji: '🌬️' },
  'Network':  { tier: 0, emoji: '📡' },
  'Darkness': { tier: 0, emoji: '🌑' },
  'Atom':     { tier: 0, emoji: '⚛️' },
  'Matter':   { tier: 0, emoji: '🔮' },
  'Life':     { tier: 0, emoji: '🌱' },
  'Internet': { tier: 0, emoji: '🌐' }, // also craftable; can appear as starting item

  // Tier 1: directly crafted from two raw materials
  'Wizard':      { tier: 1, emoji: '🧙' },
  'Robot':       { tier: 1, emoji: '🤖' },
  'Worker':      { tier: 1, emoji: '👷' },
  'Ice':         { tier: 1, emoji: '🧊' },
  'Soldier':     { tier: 1, emoji: '🪖' },
  'Vehicle':     { tier: 1, emoji: '🚗' },
  'Cooked Food': { tier: 1, emoji: '🍳' },
  'Gamer':       { tier: 1, emoji: '🕹️' },
  'Monster':     { tier: 1, emoji: '👾' },
  'Computer':    { tier: 1, emoji: '💻' },
  'Family':      { tier: 1, emoji: '👨‍👩‍👦' },
  'Planet':      { tier: 1, emoji: '🪐' },
  'Meme':        { tier: 1, emoji: '😆' },
  'Server':      { tier: 1, emoji: '🖥️' },
  'Builder':     { tier: 1, emoji: '🏗️' },
  'Vampire':     { tier: 1, emoji: '🧛' },
  'Warrior':     { tier: 1, emoji: '🗡️' },
  'Plasma':      { tier: 1, emoji: '☄️' },
  'Building':    { tier: 1, emoji: '🏢' },

  // Tier 2: require an intermediate step
  'Dragon':       { tier: 2, emoji: '🐉' },
  'AI':           { tier: 2, emoji: '🧠' },
  'Settlement':   { tier: 2, emoji: '🏘️' },
  'Viral Meme':   { tier: 2, emoji: '📱' },
  'Tank':         { tier: 2, emoji: '🚛' },
  'Knight':       { tier: 2, emoji: '⚜️' },
  'Civilization': { tier: 2, emoji: '🏛️' },
  'Streamer':     { tier: 2, emoji: '📹' },

  // Tier 3: require 2+ intermediate steps
  'City': { tier: 3, emoji: '🏙️' },
};

// ── Recipes: [ingredientA, ingredientB, result] ───────────────────────────────
// Commutative: A+B = B+A (engine handles sorting)
// First recipe per pair wins; alternates provide multiple valid paths
const RECIPES = [
  // Fantasy
  ['Human',   'Magic',    'Wizard'],
  ['Magic',   'Beast',    'Monster'],
  ['Human',   'Darkness', 'Vampire'],
  ['Monster', 'Fire',     'Dragon'],    // T2

  // Tech
  ['Machine', 'Energy',   'Robot'],
  ['Machine', 'Data',     'Computer'],
  ['Machine', 'Network',  'Server'],
  ['Computer','Human',    'AI'],        // T2
  ['Server',  'Data',     'Internet'],  // T2

  // Combat & Vehicles
  ['Human',   'Weapon',   'Soldier'],
  ['Human',   'Training', 'Warrior'],
  ['Warrior', 'Armor',    'Knight'],    // T2
  ['Engine',  'Metal',    'Vehicle'],
  ['Engine',  'Wheel',    'Vehicle'],   // alternate
  ['Vehicle', 'Weapon',   'Tank'],      // T2

  // Society
  ['Human',   'Tool',     'Worker'],
  ['Human',   'Material', 'Builder'],
  ['Human',   'Human',    'Family'],
  ['Material','Land',     'Building'],
  ['Worker',  'Land',     'Building'],  // alternate
  ['Family',  'Land',     'Settlement'],   // T2
  ['Settlement','Material','City'],        // T3

  // Media & Internet
  ['Human',   'Game',     'Gamer'],
  ['Human',   'Funny',    'Meme'],
  ['Human',   'Camera',   'Streamer'],  // direct alternate
  ['Gamer',   'Internet', 'Streamer'],  // T2 primary
  ['Meme',    'Internet', 'Viral Meme'],// T2

  // Science
  ['Space',   'Gravity',  'Planet'],
  ['Planet',  'Life',     'Civilization'], // T2
  ['Atom',    'Energy',   'Plasma'],

  // Misc
  ['Water',   'Cold',     'Ice'],
  ['Human',   'Food',     'Cooked Food'],
];

// ── PvP targets — each has a starting inventory (base) + difficulty ───────────
// Same 4 base items can yield DIFFERENT targets depending on correct recipe path
const TARGETS = [
  // Easy: 1-step craft (10 targets)
  { name: 'Wizard',    difficulty: 'easy',   base: ['Human','Magic','Fire','Beast'] },
  { name: 'Robot',     difficulty: 'easy',   base: ['Machine','Energy','Human','Data'] },
  { name: 'Monster',   difficulty: 'easy',   base: ['Beast','Magic','Fire','Human'] },
  { name: 'Meme',      difficulty: 'easy',   base: ['Human','Internet','Funny','Game'] },
  { name: 'Ice',       difficulty: 'easy',   base: ['Water','Cold','Fire','Air'] },
  { name: 'Gamer',     difficulty: 'easy',   base: ['Human','Game','Internet','Camera'] },
  { name: 'Plasma',    difficulty: 'easy',   base: ['Atom','Energy','Matter','Space'] },
  { name: 'Vampire',   difficulty: 'easy',   base: ['Human','Magic','Darkness','Fire'] },
  { name: 'Vehicle',   difficulty: 'easy',   base: ['Engine','Metal','Wheel','Energy'] },
  { name: 'Worker',    difficulty: 'easy',   base: ['Human','Tool','Land','Material'] },

  // Medium: 2-step craft with 1 distractor (7 targets)
  { name: 'Dragon',    difficulty: 'medium', base: ['Human','Magic','Beast','Fire'] },
  { name: 'AI',        difficulty: 'medium', base: ['Machine','Data','Human','Energy'] },
  { name: 'Knight',    difficulty: 'medium', base: ['Human','Weapon','Training','Armor'] },
  { name: 'Internet',  difficulty: 'medium', base: ['Machine','Network','Data','Energy'] },
  { name: 'Streamer',  difficulty: 'medium', base: ['Human','Game','Internet','Funny'] },
  { name: 'Tank',      difficulty: 'medium', base: ['Engine','Metal','Weapon','Wheel'] },
  { name: 'Computer',  difficulty: 'medium', base: ['Machine','Data','Network','Energy'] },

  // Hard: 2-3 steps, tricky distractors (3 targets)
  { name: 'City',         difficulty: 'hard', base: ['Human','Human','Land','Material'] },
  { name: 'Viral Meme',   difficulty: 'hard', base: ['Human','Internet','Funny','Game'] },
  { name: 'Civilization', difficulty: 'hard', base: ['Space','Gravity','Planet','Life'] },
];

// ── PvE: 5 stages, one per tier group ────────────────────────────────────────
const PVE_STAGES = [
  { stage: 1, target: 'Wizard',       base: ['Human','Magic','Fire','Beast'],       timeLimit: 60, label: 'Stage 1 — Wizard',       baseScore: 100 },
  { stage: 2, target: 'Dragon',       base: ['Human','Magic','Beast','Fire'],       timeLimit: 75, label: 'Stage 2 — Dragon',        baseScore: 200 },
  { stage: 3, target: 'Knight',       base: ['Human','Weapon','Training','Armor'],  timeLimit: 60, label: 'Stage 3 — Knight',        baseScore: 300 },
  { stage: 4, target: 'AI',           base: ['Machine','Data','Human','Energy'],    timeLimit: 75, label: 'Stage 4 — AI',            baseScore: 400 },
  { stage: 5, target: 'City',         base: ['Human','Human','Land','Material'],    timeLimit: 90, label: 'Stage 5 — City',          baseScore: 500 },
];

// ── Shortest solution paths — shown in end-game overlay ──────────────────────
const SOLUTIONS = {
  'Wizard':       [['Human','Magic','Wizard']],
  'Robot':        [['Machine','Energy','Robot']],
  'Monster':      [['Magic','Beast','Monster']],
  'Meme':         [['Human','Funny','Meme']],
  'Ice':          [['Water','Cold','Ice']],
  'Dragon':       [['Magic','Beast','Monster'],   ['Monster','Fire','Dragon']],
  'AI':           [['Machine','Data','Computer'], ['Computer','Human','AI']],
  'Knight':       [['Human','Training','Warrior'],['Warrior','Armor','Knight']],
  'Internet':     [['Machine','Network','Server'],['Server','Data','Internet']],
  'Streamer':     [['Human','Game','Gamer'],      ['Gamer','Internet','Streamer']],
  'Tank':         [['Engine','Metal','Vehicle'],  ['Vehicle','Weapon','Tank']],
  'City':         [['Human','Human','Family'],['Family','Land','Settlement'],['Settlement','Material','City']],
  'Viral Meme':   [['Human','Funny','Meme'],      ['Meme','Internet','Viral Meme']],
  'Civilization': [['Planet','Life','Civilization']],
  'Gamer':        [['Human','Game','Gamer']],
  'Plasma':       [['Atom','Energy','Plasma']],
  'Vampire':      [['Human','Darkness','Vampire']],
  'Vehicle':      [['Engine','Metal','Vehicle']],
  'Worker':       [['Human','Tool','Worker']],
  'Computer':     [['Machine','Data','Computer']],
};
