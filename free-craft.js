// Free Craft mode: AI-powered combining via Claude API
// Caches results in localStorage so each combo is only called once

const FreeCraft = {
  get apiKey() { return localStorage.getItem('fc_api_key') || ''; },
  set apiKey(v) { localStorage.setItem('fc_api_key', v); },

  // Cache: "ItemA|ItemB" → { name, emoji }
  get cache() { return JSON.parse(localStorage.getItem('fc_cache') || '{}'); },
  saveCache(c) { localStorage.setItem('fc_cache', JSON.stringify(c)); },

  // Combine two items — returns { name, emoji, isNew }
  async combine(itemA, itemB) {
    // Check existing static recipes first (instant)
    const existing = engine.combine(itemA, itemB);
    if (existing) return { name: existing, emoji: ITEMS[existing]?.emoji || '✨', isNew: false };

    // Check local cache
    const cacheKey = [itemA, itemB].sort().join('|');
    const cache = this.cache;
    if (cache[cacheKey]) return { ...cache[cacheKey], isNew: false };

    // Call Claude API
    const result = await this._callAPI(itemA, itemB);
    cache[cacheKey] = result;
    this.saveCache(cache);
    return { ...result, isNew: true };
  },

  async _callAPI(itemA, itemB) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 60,
        messages: [{
          role: 'user',
          content: `Crafting game. Combine "${itemA}" + "${itemB}". Reply ONLY with valid JSON on one line: {"name":"Result Name","emoji":"🔥"}. Name: 1-3 words, creative and logical.`,
        }],
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    // Parse JSON from response text
    const text = data.content[0].text.trim();
    const match = text.match(/\{.*\}/s);
    if (!match) throw new Error('Invalid response from AI');
    return JSON.parse(match[0]);
  },
};
