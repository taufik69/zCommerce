/**
 * Convert form-data bracketed keys into nested objects/arrays.
 *
 * Multer (multipart/form-data) does NOT auto-expand `key[idx]` syntax —
 * it leaves them as literal flat keys. This helper recursively reconstructs
 * the intended structure.
 *
 * Examples:
 *   { 'metaKeywords[0]': 'a', 'metaKeywords[1]': 'b' }
 *     → { metaKeywords: ['a', 'b'] }
 *
 *   { 'dimensions[width]': '12', 'dimensions[height]': '23' }
 *     → { dimensions: { width: '12', height: '23' } }
 *
 *   { 'seo[ogImage][url]': 'https://...' }
 *     → { seo: { ogImage: { url: 'https://...' } } }
 *
 * Numeric path segments produce arrays; string segments produce objects.
 */
const expandBracketKeys = (body = {}) => {
  const result = {};

  for (const [key, value] of Object.entries(body)) {
    if (!key.includes("[")) {
      result[key] = value;
      continue;
    }

    // Split "foo[bar][0]" → ["foo", "bar", "0"]
    const parts = [];
    const re = /([^\[\]]+)/g;
    let m;
    while ((m = re.exec(key)) !== null) parts.push(m[1]);

    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      const nextIsNum = /^\d+$/.test(parts[i + 1]);
      if (cur[k] === undefined || cur[k] === null) {
        cur[k] = nextIsNum ? [] : {};
      }
      cur = cur[k];
    }

    const lastKey = parts[parts.length - 1];
    if (Array.isArray(cur) && /^\d+$/.test(lastKey)) {
      cur[Number(lastKey)] = value;
    } else {
      cur[lastKey] = value;
    }
  }

  return result;
};

module.exports = { expandBracketKeys };
