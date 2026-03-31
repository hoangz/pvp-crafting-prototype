// Free Craft mode: AI-powered combining via ZingPlay proxy (OpenAI-compatible)
// Generates a full recipe tree at game start, then allows live AI combos during play

const FreeCraft = {
  _ENDPOINT: 'https://chat.zingplay.com/api/v1/chat/completions',
  _KEY:      'sk-6508afc771c0423592cda880e50d6d7d',
  _MODEL:    'local-model',

  // Current session's generated tree
  tree: null,

  // Per-session cache for live combos: "A|B" → { name, emoji }
  liveCache: {},

  // Strip <think>...</think> tags from model output
  _stripThink(text) {
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  },

  // Parse JSON from possibly messy model output
  _parseJSON(raw) {
    const clean = this._stripThink(raw)
      .replace(/<[^>]+>/g, '')   // strip any remaining XML-like tags
      .trim();
    const match = clean.match(/\{[\s\S]*\}/s) || clean.match(/\[[\s\S]*\]/s);
    if (!match) throw new Error('No JSON found in response');
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      // Try fixing common issues: trailing commas, unquoted keys
      const fixed = match[0]
        .replace(/,\s*([}\]])/g, '$1')          // trailing commas
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":'); // unquoted keys
      return JSON.parse(fixed);
    }
  },

  // ── Generate full recipe tree via parallel small API calls per tier ──
  async generateTree() {
    this.tree = { items: {}, recipes: [], targets: [] };
    this.liveCache = {};

    // T1: 6 base+base combos (all in parallel)
    const t1Pairs = [
      ['Human','Fire'], ['Human','Magic'], ['Human','Beast'],
      ['Fire','Magic'], ['Fire','Beast'], ['Magic','Beast'],
    ];
    const t1 = await Promise.all(t1Pairs.map(([a,b]) => this._safeCombine(a, b)));
    t1Pairs.forEach(([a,b], i) => { if (t1[i]) this._registerOne(a, b, t1[i], 1); });
    const t1Names = t1.map(r => r.name);

    // T2: pick 4 random base+T1 combos (parallel)
    const t2Candidates = [];
    for (const base of BASE_ITEMS)
      for (const t1n of t1Names) t2Candidates.push([base, t1n]);
    const t2Pairs = t2Candidates.sort(() => Math.random() - 0.5).slice(0, 4);
    const t2 = await Promise.all(t2Pairs.map(([a,b]) => this._safeCombine(a, b)));
    t2Pairs.forEach(([a,b], i) => { if (t2[i]) this._registerOne(a, b, t2[i], 2); });
    const t2Names = t2.map(r => r.name);

    // T3: pick 2 random T1+T2 combos (parallel) — these become targets
    const t3Candidates = [];
    for (const t1n of t1Names)
      for (const t2n of t2Names) t3Candidates.push([t1n, t2n]);
    const t3Pairs = t3Candidates.sort(() => Math.random() - 0.5).slice(0, 2);
    const t3 = await Promise.all(t3Pairs.map(([a,b]) => this._safeCombine(a, b)));
    t3Pairs.forEach(([a,b], i) => { if (t3[i]) this._registerOne(a, b, t3[i], 3); });
    this.tree.targets = t3.filter(Boolean).map(r => r.name);

    if (this.tree.targets.length === 0) throw new Error('No targets generated');
    return this.tree;
  },

  // Wrap single combo call — returns null on failure instead of throwing
  async _safeCombine(a, b) {
    try {
      return await this._callSingleCombo(a, b);
    } catch (e) {
      console.warn(`Failed combo ${a}+${b}: ${e.message}`);
      return null;
    }
  },

  // Register a single recipe into engine + tree
  _registerOne(a, b, result, tier) {
    const name  = result.name;
    const emoji = [...(result.emoji || '✨')].length > 2 ? [...result.emoji][0] : (result.emoji || '✨');
    if (!ITEMS[name]) ITEMS[name] = { tier, emoji };
    this.tree.items[name] = { tier, emoji };
    this.tree.recipes.push({ a, b, result: name, emoji, tier });
    const key = a <= b ? `${a}|${b}` : `${b}|${a}`;
    engine.recipeMap.set(key, name);
  },

  // Fuzzy match: fix AI typos like "Treent" → "Treant"
  _fuzzyMatch(name, validNames) {
    if (validNames.has(name)) return name;
    for (const v of validNames) {
      if (v.toLowerCase() === name.toLowerCase()) return v;
    }
    for (const v of validNames) {
      if (this._editDist(name.toLowerCase(), v.toLowerCase()) <= 2) return v;
    }
    return null;
  },

  _editDist(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => {
      const row = new Array(n + 1);
      row[0] = i;
      return row;
    });
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
        );
    return dp[m][n];
  },

  // ── Live combine during gameplay (fallback for combos not in tree) ──
  async combine(itemA, itemB) {
    const existing = engine.combine(itemA, itemB);
    if (existing) return { name: existing, emoji: ITEMS[existing]?.emoji || '✨', isNew: false };

    const cacheKey = [itemA, itemB].sort().join('|');
    if (this.liveCache[cacheKey]) return { ...this.liveCache[cacheKey], isNew: false };

    const result = await this._callSingleCombo(itemA, itemB);
    this.liveCache[cacheKey] = result;

    if (!ITEMS[result.name]) ITEMS[result.name] = { tier: 1, emoji: result.emoji };
    const key = itemA <= itemB ? `${itemA}|${itemB}` : `${itemB}|${itemA}`;
    engine.recipeMap.set(key, result.name);

    return { ...result, isNew: true };
  },

  async _callSingleCombo(itemA, itemB) {
    const resp = await fetch(this._ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this._KEY}`,
      },
      body: JSON.stringify({
        model: this._MODEL,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Crafting game. Combine "${itemA}" + "${itemB}". Reply ONLY JSON: {"name":"Result","emoji":"🔥"}. 1-3 word name, single emoji.`,
        }],
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'API error');

    const text = data.choices?.[0]?.message?.content || '';
    return this._parseJSON(text);
  },
};
