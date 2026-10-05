// Display names: aliases from the config, phone-number masking.

const PHONE_RE = /^\+?\d[\d\s\-().]{6,}\d$/;

export const isPhone = (s) => PHONE_RE.test(String(s).trim());
const digits = (s) => String(s).replace(/\D/g, '');

/** "+39 333 555 0142" → "+39 ··· 0142". Anything that is not a phone number is returned unchanged. */
export function maskPhone(author) {
  const s = String(author).trim();
  if (!isPhone(s)) return s;
  const cc = s.startsWith('+') ? (s.match(/^\+\d{1,3}/) || [''])[0] : '';
  return `${cc ? cc + ' ' : ''}··· ${digits(s).slice(-4)}`;
}

/**
 * Build a function that maps the author as written in the chat to the name to show.
 *
 * Alias keys can be written as they appear in the chat ("Ale", "Tu") or as a phone
 * number in any format: "+39 333 123 4567", "3331234567" and "+39 ··· 4567" all
 * match the same contact. Name keys are case-insensitive.
 */
export function createNameResolver(aliases = {}, { maskPhones = true } = {}) {
  const byName = new Map();
  const byPhone = []; // [digits, name]
  const byMasked = new Map();
  for (const [key, name] of Object.entries(aliases)) {
    if (!name) continue;
    const k = String(key).trim();
    if (/···/.test(k)) byMasked.set(k.replace(/\s+/g, ' '), name);
    else if (isPhone(k)) byPhone.push([digits(k), name]);
    else byName.set(k.toLowerCase(), name);
  }
  return function resolve(author) {
    if (author == null) return author;
    const a = String(author).trim();
    if (isPhone(a)) {
      const d = digits(a);
      // Match on the national part: the config may omit the country code.
      for (const [pd, name] of byPhone) {
        const n = Math.min(pd.length, d.length, 9);
        if (n >= 6 && pd.slice(-n) === d.slice(-n)) return name;
      }
      const masked = maskPhone(a);
      if (byMasked.has(masked)) return byMasked.get(masked);
      return maskPhones ? masked : a;
    }
    return byMasked.get(a.replace(/\s+/g, ' ')) ?? byName.get(a.toLowerCase()) ?? a;
  };
}
