// Free Craft mode: AI-powered combining via ZingPlay proxy (OpenAI-compatible)
// Generates a full recipe tree at game start, then allows live AI combos during play

const FreeCraft = {
  _ENDPOINT: 'https://chat.zingplay.com/api/v1/chat/completions',
  _KEY:      'sk-6508afc771c0423592cda880e50d6d7d',
  _MODEL:    'local-model',

  // Current session's generated tree: { items: {}, recipes: [], targets: [] }
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

  // ── Generate full recipe tree at game start ──
  async generateTree() {
    const resp = await fetch(this._ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this._KEY}`,
      },
      body: JSON.stringify({
        model: this._MODEL,
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are a crafting game recipe designer. Generate a creative recipe tree from these 4 base items: Human 👤, Fire 🔥, Magic ⚡, Beast 🐾.

Create EXACTLY this structure:
- 8 Tier 1 items (combine 2 base items)
- 6 Tier 2 items (combine base+T1 or T1+T1)
- 3 Tier 3 items (combine T1+T2 or T2+T2) — these are the final targets

Be creative! Use different themes each time (fantasy, sci-fi, nature, mythology, etc.).
Each item needs a unique name (1-3 words) and a fitting emoji.

Reply ONLY with valid JSON, no other text:
{"recipes":[{"a":"Human","b":"Fire","result":"Warrior","emoji":"⚔️","tier":1},...], "targets":["TargetName1","TargetName2","TargetName3"]}

IMPORTANT: Every recipe's ingredients (a, b) must be items that exist either as base items or as results of lower-tier recipes. Targets must be tier 3 items.`,
        }],
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'API error');

    const text = data.choices?.[0]?.message?.content || '';
    const tree = this._parseJSON(text);

    // Register all generated items and recipes
    this.tree = { items: {}, recipes: [], targets: tree.targets || [] };

    for (const r of tree.recipes) {
      // Register item
      if (!ITEMS[r.result]) {
        ITEMS[r.result] = { tier: r.tier || 1, emoji: r.emoji };
      }
      this.tree.items[r.result] = { tier: r.tier || 1, emoji: r.emoji };

      // Register recipe into engine's lookup
      const key = r.a <= r.b ? `${r.a}|${r.b}` : `${r.b}|${r.a}`;
      engine.recipes.set(key, r.result);
      this.tree.recipes.push(r);
    }

    return this.tree;
  },

  // ── Live combine during gameplay (fallback for combos not in tree) ──
  async combine(itemA, itemB) {
    // Check engine recipes (static + generated tree)
    const existing = engine.combine(itemA, itemB);
    if (existing) return { name: existing, emoji: ITEMS[existing]?.emoji || '✨', isNew: false };

    // Check live cache
    const cacheKey = [itemA, itemB].sort().join('|');
    if (this.liveCache[cacheKey]) return { ...this.liveCache[cacheKey], isNew: false };

    // Call API for unknown combo
    const result = await this._callSingleCombo(itemA, itemB);
    this.liveCache[cacheKey] = result;

    // Register into engine so future lookups are instant
    if (!ITEMS[result.name]) ITEMS[result.name] = { tier: 1, emoji: result.emoji };
    const key = itemA <= itemB ? `${itemA}|${itemB}` : `${itemB}|${itemA}`;
    engine.recipes.set(key, result.name);

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
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Crafting game. Combine "${itemA}" + "${itemB}". Reply ONLY with valid JSON on one line: {"name":"Result Name","emoji":"🔥"}. Name: 1-3 words, creative and logical. Do NOT include any thinking or explanation.`,
        }],
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'API error');

    const text = data.choices?.[0]?.message?.content || '';
    return this._parseJSON(text);
  },
};
