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
    const clean = this._stripThink(raw);
    const match = clean.match(/\{[\s\S]*\}/s) || clean.match(/\[[\s\S]*\]/s);
    if (!match) throw new Error('No JSON found in response');
    return JSON.parse(match[0]);
  },

  // ── Generate full recipe tree in ONE API call ──
  async generateTree() {
    this.tree = { items: {}, recipes: [], targets: [] };

    const resp = await fetch(this._ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this._KEY}`,
      },
      body: JSON.stringify({
        model: this._MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Crafting game recipe tree. Base: Human👤, Fire🔥, Magic⚡, Beast🐾.
Generate: 6 T1 (base+base), 4 T2 (base+T1 or T1+T1), 2 T3 (T1+T2 or T2+T2). T3=targets.
Creative theme, different each time. Ingredients must exist in prior tiers.
Reply JSON: {"recipes":[{"a":"Human","b":"Fire","result":"Warrior","emoji":"⚔️","tier":1}],"targets":["T3name1","T3name2"]}`,
        }],
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'API error');

    const text = data.choices?.[0]?.message?.content || '';
    const tree = this._parseJSON(text);

    // Validate & register
    const validNames = new Set(BASE_ITEMS);
    for (const r of tree.recipes) validNames.add(r.result);

    for (const r of tree.recipes) {
      r.a = this._fuzzyMatch(r.a, validNames) || r.a;
      r.b = this._fuzzyMatch(r.b, validNames) || r.b;
      if ([...r.emoji].length > 2) r.emoji = [...r.emoji][0];
      if (!validNames.has(r.a) || !validNames.has(r.b)) continue;

      if (!ITEMS[r.result]) ITEMS[r.result] = { tier: r.tier || 1, emoji: r.emoji };
      this.tree.items[r.result] = { tier: r.tier || 1, emoji: r.emoji };
      this.tree.recipes.push(r);

      const key = r.a <= r.b ? `${r.a}|${r.b}` : `${r.b}|${r.a}`;
      engine.recipeMap.set(key, r.result);
    }

    this.tree.targets = (tree.targets || []).filter(t => validNames.has(t));
    if (this.tree.targets.length === 0) throw new Error('No valid targets generated');
    return this.tree;
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
