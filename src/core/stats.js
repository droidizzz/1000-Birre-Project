// Statistics and projections. Everything returned is plain JSON (no Sets or Dates).
import { dayOf, weekdayOf, weekStartOf, hourOf } from './dates.js';

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

/**
 * @param {Message[]} messages      all parsed messages (used to find the date of the export)
 * @param {ReturnType<countBeers>} counted
 * @param {{ goal?: number, dayStartHour?: number }} opts
 * @returns {Stats | null}  null when no beer was recognised
 */
export function computeStats(messages, counted, { goal = 1000, dayStartHour = 5 } = {}) {
  const { beers, baseline, total } = counted;
  if (!beers.length) return null;
  const dayOfTs = (ts) => dayOf(ts, dayStartHour);

  const lastMessageTs = messages.reduce((max, m) => Math.max(max, m.ts), 0);
  const firstDay = dayOfTs(beers[0].ts);
  const refDay = Math.max(dayOfTs(lastMessageTs), dayOfTs(beers[beers.length - 1].ts));
  const nDays = refDay - firstDay + 1;
  const countedBeers = total - baseline;

  // Per day, cumulative, 7-day moving average
  const daily = new Array(nDays).fill(0);
  for (const b of beers) daily[dayOfTs(b.ts) - firstDay]++;
  const cumulative = [];
  let acc = baseline;
  for (const v of daily) cumulative.push((acc += v));
  const movingAvg7 = daily.map((_, i) => sum(daily.slice(Math.max(0, i - 6), i + 1)) / 7);

  // Pace and projections
  const lastN = (k) => sum(daily.slice(Math.max(0, nDays - k)));
  const prevN = (k) => sum(daily.slice(Math.max(0, nDays - 2 * k), Math.max(0, nDays - k)));
  const remaining = Math.max(0, goal - total);
  const rates = [
    { key: 'all', label: "Dall'inizio", days: nDays, beers: countedBeers },
    { key: 'd30', label: 'Ultimi 30 giorni', days: Math.min(30, nDays), beers: lastN(30) },
    { key: 'd7', label: 'Ultimi 7 giorni', days: Math.min(7, nDays), beers: lastN(7) },
  ].map((r) => {
    const rate = r.beers / r.days;
    const daysLeft = remaining === 0 ? 0 : rate > 0 ? Math.ceil(remaining / rate) : null;
    return { ...r, rate, daysLeft, etaDay: daysLeft === null ? null : refDay + daysLeft };
  });

  // Weeks (Monday–Sunday)
  const weekMap = new Map();
  daily.forEach((v, i) => {
    const wk = weekStartOf(firstDay + i);
    weekMap.set(wk, (weekMap.get(wk) || 0) + v);
  });
  const weekly = [...weekMap].map(([start, beers]) => ({ start, beers, partial: start < firstDay || start + 6 > refDay }));

  // Weekday averages and hours of the day
  const weekday = Array.from({ length: 7 }, () => ({ beers: 0, days: 0, avg: 0 }));
  daily.forEach((v, i) => { const w = weekday[weekdayOf(firstDay + i)]; w.beers += v; w.days++; });
  for (const w of weekday) w.avg = w.days ? w.beers / w.days : 0;
  const hours = new Array(24).fill(0);
  for (const b of beers) hours[hourOf(b.ts)]++;

  // Leaderboard
  const people = new Map();
  let unattributed = 0;
  for (const b of beers) {
    if (!b.author) { unattributed++; continue; }
    const p = people.get(b.author) || { name: b.author, beers: 0, days: new Set(), first: b.ts, last: b.ts };
    p.beers++;
    p.days.add(dayOfTs(b.ts));
    p.last = b.ts;
    people.set(b.author, p);
  }
  const leaderboard = [...people.values()]
    .sort((a, b) => b.beers - a.beers || a.first - b.first)
    .map((p) => ({ name: p.name, beers: p.beers, share: p.beers / countedBeers, activeDays: p.days.size, firstTs: p.first, lastTs: p.last }));

  // Records
  let bestDayIdx = 0;
  daily.forEach((v, i) => { if (v > daily[bestDayIdx]) bestDayIdx = i; });
  const bestWeek = weekly.reduce((a, b) => (b.beers > a.beers ? b : a), weekly[0]);
  const longest = (pred) => {
    let run = 0, best = 0, end = 0;
    daily.forEach((v, i) => { run = pred(v) ? run + 1 : 0; if (run > best) { best = run; end = i; } });
    return { days: best, endDay: firstDay + end };
  };
  const trailing = (pred) => { let n = 0; for (let i = nDays - 1; i >= 0 && pred(daily[i]); i--) n++; return n; };

  // Milestones every 100
  const milestones = [];
  let prev = firstDay - 1;
  for (let k = 100; k <= goal; k += 100) {
    const b = beers.find((x) => x.n === k);
    if (b) {
      const day = dayOfTs(b.ts);
      milestones.push({ n: k, reached: true, day, author: b.author, daysTaken: day - prev });
      prev = day;
    } else if (k > total) {
      const r = rates[0].rate;
      milestones.push({ n: k, reached: false, etaDay: r > 0 ? refDay + Math.ceil((k - total) / r) : null });
    }
  }

  return {
    goal, total, baseline, remaining, progress: Math.min(1, total / goal),
    dayStartHour, firstDay, refDay, nDays, lastMessageTs,
    activeDays: daily.filter((v) => v > 0).length,
    daily, cumulative, movingAvg7, weekly, weekday, hours,
    rates, last7: lastN(7), prev7: prevN(7),
    leaderboard, unattributed,
    records: {
      bestDay: { day: firstDay + bestDayIdx, beers: daily[bestDayIdx] },
      bestWeek: { start: bestWeek.start, beers: bestWeek.beers },
      longestStreak: longest((v) => v > 0),
      longestDrought: longest((v) => v === 0),
      currentStreak: trailing((v) => v > 0),
      currentDrought: trailing((v) => v === 0),
    },
    milestones,
  };
}

/** Beers per day needed to reach the goal by `targetDay`. */
export function requiredPace(stats, targetDay) {
  const days = targetDay - stats.refDay;
  if (stats.remaining === 0) return { days, perDay: 0, reached: true };
  if (days <= 0) return { days, perDay: null, reached: false };
  return { days, perDay: stats.remaining / days, reached: false };
}
