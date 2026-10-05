// Default options and validation. The same object is accepted by the CLI,
// the config file and the web dashboard.

export const DEFAULT_OPTIONS = Object.freeze({
  /** Target number of beers. */
  goal: 1000,
  /** Hour (0–23) at which a "day" starts: a beer at 1am counts for the night before. */
  dayStartHour: 5,
  /** Largest accepted gap between two consecutive progressive numbers; bigger jumps are typos. */
  maxJump: 5,
  /** Only count numbers that come with a photo (caption, or a photo by the same person within 10 minutes). */
  requirePhoto: true,
  /** Reject messages that contain words besides the number. */
  strict: false,
  /** Minutes within which two people posting the same number count as two beers. */
  duplicateWindowMinutes: 10,
  /** Date order in the export: 'auto' (detected), 'dmy' (31/12/26) or 'mdy' (12/31/26). */
  dateOrder: 'auto',
  /** Show phone numbers as "+39 ··· 1234" when no alias is set. */
  maskPhones: true,
  /** Display names: { "<name or phone as in the chat>": "<name to show>" }. */
  aliases: {},
});

const clamp = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

export function normalizeOptions(input = {}) {
  const o = { ...DEFAULT_OPTIONS, ...input };
  return {
    goal: Math.round(clamp(o.goal, 1, 1e7, DEFAULT_OPTIONS.goal)),
    dayStartHour: Math.round(clamp(o.dayStartHour, 0, 23, DEFAULT_OPTIONS.dayStartHour)),
    maxJump: Math.round(clamp(o.maxJump, 1, 100, DEFAULT_OPTIONS.maxJump)),
    requirePhoto: Boolean(o.requirePhoto),
    strict: Boolean(o.strict),
    duplicateWindowMinutes: clamp(o.duplicateWindowMinutes, 0, 1440, DEFAULT_OPTIONS.duplicateWindowMinutes),
    dateOrder: ['dmy', 'mdy'].includes(o.dateOrder) ? o.dateOrder : 'auto',
    maskPhones: Boolean(o.maskPhones),
    aliases: o.aliases && typeof o.aliases === 'object' ? { ...o.aliases } : {},
  };
}
