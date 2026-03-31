// Free Craft mode: AI-powered combining via ZingPlay proxy (OpenAI-compatible)
// No user API key required — uses shared proxy endpoint

const FreeCraft = {
  _ENDPOINT: 'https://chat.zingplay.com/api/v1/chat/completions',
  _KEY:      'sk-6508afc771c0423592cda880e50d6d7d',
  _MODEL:    'gpt-4o-mini',

  // Cache: "ItemA|ItemB" → { name, emoji }
  get cache() { return JSON.parse(localStorage.getItem('fc_cache') || '{}'); },
  saveCache(c) { localStorage.setItem('fc_cache', JSON.stringify(c)); },

  // Combine two items — returns { name, emoji, isNew }
  async combine(itemA, itemB) {
    // Check existing static recipes first (instant, no API call)
    const existing = engine.combine(itemA, itemB);
    if (existing) return { name: existing, emoji: ITEMS[existing]?.emoji || '✨', isNew: false };

    // Check local cache
    const cacheKey = [itemA, itemB].sort().join('|');
    const cache = this.cache;
    if (cache[cacheKey]) return { ...cache[cacheKey], isNew: false };

    // Call proxy API
    const result = await this._callAPI(itemA, itemB);
    cache[cacheKey] = result;
    this.saveCache(cache);
    return { ...result, isNew: true };
  },

  async _callAPI(itemA, itemB) {
    const resp = await fetch(this._ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this._KEY}`,
      },
      body: JSON.stringify({
        model: this._MODEL,
        max_tokens: 60,
        messages: [{
          role: 'user',
          content: `Crafting game. Combine "${itemA}" + "${itemB}". Reply ONLY with valid JSON on one line: {"name":"Result Name","emoji":"🔥"}. Name: 1-3 words, creative and logical.`,
        }],
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'API error');

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from AI');
    const match = text.match(/\{.*\}/s);
    if (!match) throw new Error('Invalid response format');
    return JSON.parse(match[0]);
  },
};
