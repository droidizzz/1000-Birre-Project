// From messages to beers.
//
// The progressive number posted in the chat is the source of truth: the total is
// the last valid number. The algorithm walks the candidates in order and keeps a
// running "last" number:
//
//   next number (last + 1)        → one beer
//   small jump (≤ maxJump)        → the gap is filled first with messages that were
//                                   set aside (same number posted twice, typos),
//                                   otherwise the missing beers go to this message
//   range or list ("28, 29, 30")  → one beer per number
//   number already used           → set aside as a possible simultaneous post
//   jump too large                → set aside as a typo
//
// If the export starts mid-game, counting starts at the first number followed by
// a consistent sequence, and the earlier beers are reported as `baseline`.

import { extractNumbers } from './parse.js';

const PHOTO_PAIR_MS = 10 * 60_000;

/**
 * @param {Message[]} messages  output of parseChat (authors already resolved, if wanted)
 * @param {object} opts         see options.js
 * @returns {{ beers: Beer[], anomalies: Anomaly[], baseline: number, total: number, candidates: number }}
 *
 * Beer:    { n, ts, author, kind: 'ok'|'multipla'|'corretto'|'mancante', message }
 * Anomaly: { type: 'multipla'|'corretto'|'buco'|'ignorato', note, message }
 */
export function countBeers(messages, opts = {}) {
  const { maxJump = 5, strict = false, requirePhoto = true, duplicateWindowMinutes = 10 } = opts;

  const candidates = [];
  messages.forEach((m, i) => {
    if (!m.author || m.deleted) return;
    const nums = extractNumbers(m.text, { strict });
    if (!nums) return;
    if (requirePhoto && !m.hasPhoto && !photoNearby(messages, i)) return;
    candidates.push({ ...nums, message: m });
  });

  const empty = { beers: [], anomalies: [], baseline: 0, total: 0, candidates: candidates.length };
  const start = candidates.findIndex((_, i) => startsChain(candidates, i, maxJump));
  if (start < 0) return empty;

  const beers = [];
  const anomalies = [];
  const baseline = candidates[start].lo - 1;
  let last = baseline;
  let lastTs = null;
  let pending = []; // messages set aside since the last accepted number

  const add = (n, message, kind) => beers.push({ n, ts: message.ts, author: kind === 'mancante' ? null : message.author, kind, message });

  for (let i = start; i < candidates.length; i++) {
    const c = candidates[i];
    const m = c.message;
    const fits = c.lo > last && c.lo <= last + maxJump;

    if (fits) {
      if (c.hi - c.lo > maxJump) {
        anomalies.push({ type: 'ignorato', note: `Intervallo ${c.lo}–${c.hi} troppo ampio`, message: m });
        continue;
      }
      for (let n = last + 1; n < c.lo; n++) {
        const p = pending.shift();
        if (p) {
          add(n, p.message, 'corretto');
          anomalies.push({ type: 'corretto', note: `Postato come ${p.posted}, contato come ${n}`, message: p.message });
        } else {
          add(n, m, 'mancante');
          anomalies.push({ type: 'buco', note: `Nessun messaggio con il ${n}: contato comunque, senza autore`, message: m });
        }
      }
      for (const p of pending) anomalies.push({ type: 'ignorato', note: p.reason, message: p.message });
      pending = [];
      for (let n = c.lo; n <= c.hi; n++) add(n, m, c.hi > c.lo ? 'multipla' : 'ok');
      if (c.hi > c.lo) anomalies.push({ type: 'multipla', note: `${c.hi - c.lo + 1} birre in un messaggio (${c.lo}–${c.hi})`, message: m });
      last = c.hi;
      lastTs = m.ts;
    } else {
      const duplicate = c.lo === last && lastTs !== null && m.ts - lastTs <= duplicateWindowMinutes * 60_000;
      const reason = c.lo <= last ? `Numero ${c.lo} già usato (ultimo: ${last})` : `Salto da ${last} a ${c.lo}: troppo grande`;
      pending.push({ message: m, posted: c.lo, duplicate, reason });
    }
  }

  // Leftovers at the end of the chat: only near-simultaneous duplicates count.
  for (const p of pending) {
    if (p.duplicate) {
      last++;
      add(last, p.message, 'corretto');
      anomalies.push({ type: 'corretto', note: `Postato come ${p.posted}, contato come ${last}`, message: p.message });
    } else {
      anomalies.push({ type: 'ignorato', note: p.reason, message: p.message });
    }
  }

  anomalies.sort((a, b) => a.message.ts - b.message.ts);
  return { beers, anomalies, baseline, total: last, candidates: candidates.length };
}

/** A photo sent by the same person within 10 minutes, as a separate message. */
function photoNearby(messages, i) {
  const m = messages[i];
  for (let j = Math.max(0, i - 6); j < Math.min(messages.length, i + 7); j++) {
    const o = messages[j];
    if (j !== i && o.author === m.author && o.hasPhoto && Math.abs(o.ts - m.ts) <= PHOTO_PAIR_MS) return true;
  }
  return false;
}

/**
 * Candidate i starts the game if the next candidates continue it consistently:
 * one follow-up is enough for a game starting at 1, three otherwise.
 */
function startsChain(candidates, i, maxJump) {
  let last = candidates[i].hi;
  let found = 0;
  const need = Math.min(candidates[i].lo === 1 ? 1 : 3, candidates.length - 1 - i);
  for (let j = i + 1; j < candidates.length && j < i + 40 && found < need; j++) {
    if (candidates[j].lo > last && candidates[j].lo <= last + maxJump) { last = candidates[j].hi; found++; }
  }
  return found >= need;
}
