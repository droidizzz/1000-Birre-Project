// One call from export text to statistics.
import { parseChat } from './parse.js';
import { countBeers } from './count.js';
import { computeStats } from './stats.js';
import { createNameResolver } from './names.js';
import { normalizeOptions } from './options.js';

/**
 * Analyse an already parsed message list. Authors are resolved to display names
 * (aliases, masked phone numbers) before counting, so the same person written in
 * two ways is merged into one entry.
 */
export function analyzeMessages(messages, options = {}, meta = {}) {
  const opts = normalizeOptions(options);
  const resolve = createNameResolver(opts.aliases, { maskPhones: opts.maskPhones });
  const resolved = messages.map((m) => (m.author ? { ...m, rawAuthor: m.rawAuthor ?? m.author, author: resolve(m.author) } : m));
  const counted = countBeers(resolved, opts);
  const stats = computeStats(resolved, counted, opts);
  return { options: opts, messages: resolved, counted, stats, ...meta };
}

/** Analyse the text of a WhatsApp export. */
export function analyzeChat(text, options = {}) {
  const { messages, dateOrder } = parseChat(text, { dateOrder: options.dateOrder });
  return analyzeMessages(messages, options, { dateOrder });
}
