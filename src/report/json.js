// Readable JSON: day numbers become ISO dates, timestamps become ISO date-times.
import { dayToISO, tsToISO } from '../core/dates.js';
import { WEEKDAYS_LONG } from '../core/format.js';

export function toReport(result, source = null) {
  const { stats: s, counted, options, dateOrder } = result;
  const { aliases, ...opts } = options;
  const base = {
    generatedAt: new Date().toISOString(),
    source,
    options: opts,
    dateOrder,
  };
  if (!s) return { ...base, total: 0, error: 'Nessuna birra numerata riconosciuta.' };
  return {
    ...base,
    goal: s.goal,
    total: s.total,
    remaining: s.remaining,
    progress: s.progress,
    beersBeforeExport: s.baseline,
    period: { from: dayToISO(s.firstDay), to: dayToISO(s.refDay), days: s.nDays, activeDays: s.activeDays, lastMessageAt: tsToISO(s.lastMessageTs) },
    pace: s.rates.map((r) => ({ period: r.label, days: r.days, beers: r.beers, perDay: round(r.rate, 2), daysLeft: r.daysLeft, eta: r.etaDay === null ? null : dayToISO(r.etaDay) })),
    last7Days: s.last7,
    previous7Days: s.prev7,
    daily: s.daily.map((beers, i) => ({ date: dayToISO(s.firstDay + i), beers, cumulative: s.cumulative[i], movingAvg7: round(s.movingAvg7[i], 2) })),
    weekly: s.weekly.map((w) => ({ weekStart: dayToISO(w.start), beers: w.beers, partial: w.partial })),
    weekdays: s.weekday.map((w, i) => ({ weekday: WEEKDAYS_LONG[i], avg: round(w.avg, 2), beers: w.beers, days: w.days })),
    hours: s.hours.map((beers, hour) => ({ hour, beers })),
    leaderboard: s.leaderboard.map((p) => ({ name: p.name, beers: p.beers, share: round(p.share, 4), activeDays: p.activeDays, first: tsToISO(p.firstTs), last: tsToISO(p.lastTs) })),
    unattributed: s.unattributed,
    records: {
      bestDay: { date: dayToISO(s.records.bestDay.day), beers: s.records.bestDay.beers },
      bestWeek: { weekStart: dayToISO(s.records.bestWeek.start), beers: s.records.bestWeek.beers },
      longestStreak: { days: s.records.longestStreak.days, until: dayToISO(s.records.longestStreak.endDay) },
      longestDrought: { days: s.records.longestDrought.days, until: dayToISO(s.records.longestDrought.endDay) },
      currentStreak: s.records.currentStreak,
      currentDrought: s.records.currentDrought,
    },
    milestones: s.milestones.map((m) => (m.reached
      ? { n: m.n, reached: true, date: dayToISO(m.day), by: m.author, daysTaken: m.daysTaken }
      : { n: m.n, reached: false, eta: m.etaDay === null ? null : dayToISO(m.etaDay) })),
    corrections: counted.anomalies.map((a) => ({ type: a.type, note: a.note, at: tsToISO(a.message.ts), author: a.message.author, text: a.message.text })),
  };
}

/** CSV with one row per beer. */
export function toCsv(result) {
  const q = (v) => (/[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const rows = [['numero', 'data', 'ora', 'autore', 'tipo']];
  for (const b of result.counted.beers) {
    const iso = tsToISO(b.ts);
    rows.push([b.n, iso.slice(0, 10), iso.slice(11, 16), b.author ?? '', b.kind]);
  }
  return rows.map((r) => r.map(q).join(',')).join('\n') + '\n';
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
