// Parser for WhatsApp chat exports (.txt), iOS and Android, Italian and English.
//
// Supported line shapes:
//   [9/4/26, 7:28:59 PM] Marco: <immagine omessa> 1          iOS, 12h clock
//   [04/09/26, 19:28:59] Marco: <immagine omessa> 1          iOS, 24h clock
//   [9/3/26, 7:48:41 PM] - Mario ha creato il gruppo.       iOS system message
//   04/09/26, 19:28 - Marco: IMG-20260904-WA0001.jpg (file allegato)
//   04/09/26, 19:28 - Marco: <Media omessi>                  Android
// Lines that do not start with a timestamp continue the previous message.

const RE_IOS = /^\[(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\]\s*(.*)$/;
const RE_ANDROID = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\s+-\s+(.*)$/;
const RE_AUTHOR = /^([^:]{1,60}?):\s?(.*)$/s;

const RE_PHOTO = /<[^>]*(?:immagine|foto|image|photo|media|allegat|attached|omess|omitted)[^>]*>|\b(?:immagine|foto)\s+omess[ao]\b|\bimage omitted\b|\.(?:jpe?g|png|webp|heic)\b/i;
const RE_MEDIA = /<[^>]*>|\b(?:immagine|foto|video|sticker|gif|media|audio)\s+omess[aoi]\b|\b(?:image|video|sticker|gif|audio) omitted\b|\(file allegato\)|\(file attached\)|\S+\.(?:jpe?g|png|webp|heic|mp4|opus)\b/gi;
const RE_DELETED = /messaggio è stato eliminato|eliminato questo messaggio|message was deleted|deleted this message/i;

/** Remove the invisible direction marks WhatsApp sprinkles in exports and normalise odd spaces. */
export function cleanLine(line) {
  return line
    .replace(/[‎‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/[  ]/g, ' ');
}

/**
 * Parse the export text into messages.
 * @param {{ dateOrder?: 'auto' | 'dmy' | 'mdy' }} opts  force the date order when the export is ambiguous
 * @returns {{ messages: Message[], dateOrder: 'dmy' | 'mdy' }}
 *
 * Message: { index, ts, author, text, hasPhoto, deleted }
 *   ts      naive timestamp in ms (see dates.js)
 *   author  null for system messages
 */
export function parseChat(raw, { dateOrder: forced = 'auto' } = {}) {
  const rows = [];
  let current = null;
  for (const original of String(raw).split(/\r?\n/)) {
    const line = cleanLine(original);
    const m = line.match(RE_IOS) || line.match(RE_ANDROID);
    if (!m) {
      if (current) current.text += '\n' + line;
      continue;
    }
    const [, a, b, y, h, mi, s, ampm, rest] = m;
    let author = null;
    let text = rest;
    if (/^-\s/.test(rest)) {
      text = rest.slice(2); // iOS system message: "[date] - text"
    } else {
      const am = rest.match(RE_AUTHOR);
      if (am) { author = am[1].trim(); text = am[2]; }
    }
    current = { a: +a, b: +b, y: +y, h: +h, mi: +mi, s: +(s || 0), ampm, author, text };
    rows.push(current);
  }

  // Day/month order: a first field above 12 means dd/mm, a second field above 12 means mm/dd.
  let dmy = 0, mdy = 0;
  for (const r of rows) { if (r.a > 12) dmy++; if (r.b > 12) mdy++; }
  const dateOrder = forced === 'dmy' || forced === 'mdy' ? forced : mdy > dmy ? 'mdy' : 'dmy';

  const messages = rows.map((r, index) => {
    const day = dateOrder === 'mdy' ? r.b : r.a;
    const month = dateOrder === 'mdy' ? r.a : r.b;
    const year = r.y < 100 ? 2000 + r.y : r.y;
    let hour = r.h;
    if (r.ampm) {
      const pm = /p/i.test(r.ampm);
      if (hour === 12) hour = pm ? 12 : 0;
      else if (pm) hour += 12;
    }
    const text = r.text.replace(/\n+$/, '');
    return {
      index,
      ts: Date.UTC(year, month - 1, day, hour, r.mi, r.s),
      author: r.author,
      text,
      hasPhoto: RE_PHOTO.test(text),
      deleted: RE_DELETED.test(text),
    };
  });
  return { messages, dateOrder };
}

/**
 * Read the progressive number(s) in a message.
 *   "<immagine omessa> 12"   → { lo: 12, hi: 12 }
 *   "28, 29, 30"             → { lo: 28, hi: 30 }
 *   "41-42"                  → { lo: 41, hi: 42 }
 *   "100 🍾🎉"                → { lo: 100, hi: 100 }
 *   "a che ora?" / "18:30"   → null
 */
export function extractNumbers(text, { strict = false } = {}) {
  const t = String(text).replace(RE_MEDIA, ' ').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(?:[^\p{L}\p{N}]|birra|beer|n°|nr\.?|n\.)*?(\d{1,5}(?:\s*(?:,|e|-|–|\+|\/|&)\s*\d{1,5})*)(?![\d.:])(.*)$/iu);
  if (!m) return null;
  const tail = m[2] || '';
  if (strict && /\p{L}/u.test(tail)) return null;
  if (!strict && tail.replace(/[^\p{L}]/gu, '').length > 40) return null;

  const nums = m[1].match(/\d+/g).map(Number);
  const isRange = nums.length === 2 && /[-–]/.test(m[1]);
  let lo = Math.min(...nums);
  let hi = Math.max(...nums);
  if (!isRange && nums.length > 1) {
    const sorted = [...nums].sort((x, y) => x - y);
    const consecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
    if (!consecutive) lo = hi = nums[0];
  }
  return { lo, hi };
}
