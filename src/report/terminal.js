// Plain-text report for the terminal.
import { fmtDay, fmtLongDay, fmtInt, fmtDec, fmtDateTime, plural, WEEKDAYS_SHORT } from '../core/format.js';

export function renderTerminal(result, { color = true, width = 72 } = {}) {
  const s = result.stats;
  const c = palette(color);
  if (!s) return c.bad('Nessuna birra numerata riconosciuta. Prova con --no-photo se le foto non sono nell\'export.') + '\n';

  const out = [];
  const head = (t) => out.push('', c.head(t.toUpperCase()));
  const barLen = Math.max(20, width - 30);
  const bar = (v, max, len) => {
    const n = max ? Math.round((v / max) * len) : 0;
    return c.accent('█'.repeat(n)) + c.dim('·'.repeat(Math.max(0, len - n)));
  };
  const pad = (t, n) => String(t).padEnd(n);
  const lpad = (t, n) => String(t).padStart(n);

  // Totale
  out.push(c.head('MILLE BIRRE'));
  out.push(`${bar(s.total, s.goal, barLen)}  ${c.bold(fmtInt(s.total))} / ${fmtInt(s.goal)}  ${c.dim('(' + fmtDec(s.progress * 100) + '%)')}`);
  out.push(c.dim(`Mancano ${fmtInt(s.remaining)} · dal ${fmtDay(s.firstDay)} al ${fmtLongDay(s.refDay)} (${plural(s.nDays, 'giorno', 'giorni')}) · giornata dalle ${String(s.dayStartHour).padStart(2, '0')}:00`));
  if (s.baseline) out.push(c.dim(`L'export parte dalla birra ${s.baseline + 1}: le ${s.baseline} precedenti contano nel totale ma non nelle statistiche.`));

  // Ritmo e proiezioni
  head('Quando arriviamo a ' + fmtInt(s.goal));
  for (const r of s.rates) {
    const eta = s.remaining === 0 ? 'raggiunto' : r.etaDay === null ? 'mai, a questo ritmo' : `${fmtLongDay(r.etaDay)}  ${c.dim('tra ' + plural(r.daysLeft, 'giorno', 'giorni'))}`;
    out.push(`  ${pad(r.label, 18)} ${lpad(fmtDec(r.rate), 5)} al giorno  →  ${c.bold(eta)}`);
  }
  const diff = s.prev7 ? Math.round(((s.last7 - s.prev7) / s.prev7) * 100) : null;
  out.push(c.dim(`  Ultimi 7 giorni: ${s.last7} birre` + (diff === null ? '' : ` (${diff >= 0 ? '+' : ''}${diff}% sui 7 precedenti)`)));

  // Settimane
  head('Settimane');
  const maxW = Math.max(...s.weekly.map((w) => w.beers), 1);
  for (const w of s.weekly) out.push(`  ${pad(fmtDay(w.start), 7)} ${bar(w.beers, maxW, barLen - 10)} ${lpad(w.beers, 4)}${w.partial ? c.dim(' parziale') : ''}`);

  // Giorni della settimana e ore
  head('Media per giorno della settimana');
  const maxD = Math.max(...s.weekday.map((w) => w.avg), 0.0001);
  s.weekday.forEach((w, i) => out.push(`  ${WEEKDAYS_SHORT[i]}  ${bar(w.avg, maxD, barLen - 10)} ${lpad(fmtDec(w.avg), 5)}`));
  head('Fasce orarie');
  const order = Array.from({ length: 24 }, (_, i) => (i + s.dayStartHour) % 24);
  const maxH = Math.max(...s.hours, 1);
  const blocks = ' ▁▂▃▄▅▆▇█';
  out.push('  ' + c.accent(order.map((h) => blocks[Math.round((s.hours[h] / maxH) * 8)]).join(' ')));
  out.push('  ' + c.dim(order.map((h, i) => (i % 3 === 0 ? String(h).padStart(2, '0') : '  ')).join('')));

  // Classifica
  head('Classifica');
  const maxP = s.leaderboard[0]?.beers || 1;
  const nameW = Math.min(24, Math.max(...s.leaderboard.map((p) => p.name.length), 4));
  s.leaderboard.forEach((p, i) => {
    out.push(`  ${lpad(i + 1, 2)}. ${pad(p.name.slice(0, nameW), nameW)} ${lpad(p.beers, 4)} ${c.dim(lpad(Math.round(p.share * 100) + '%', 4))}  ${bar(p.beers, maxP, Math.max(10, barLen - nameW - 8))}`);
  });
  if (s.unattributed) out.push(c.dim(`      ${s.unattributed} birre senza autore`));

  // Record
  head('Record');
  const r = s.records;
  out.push(`  Giorno record      ${c.bold(r.bestDay.beers + ' birre')}  ${c.dim(fmtDay(r.bestDay.day, { weekday: 'long', day: 'numeric', month: 'long' }))}`);
  out.push(`  Settimana record   ${c.bold(r.bestWeek.beers + ' birre')}  ${c.dim(fmtDay(r.bestWeek.start) + ' – ' + fmtDay(r.bestWeek.start + 6))}`);
  out.push(`  Serie più lunga    ${c.bold(plural(r.longestStreak.days, 'giorno', 'giorni'))}  ${c.dim('fino al ' + fmtDay(r.longestStreak.endDay))}`);
  out.push(`  Siccità più lunga  ${c.bold(plural(r.longestDrought.days, 'giorno', 'giorni'))}${r.longestDrought.days ? '  ' + c.dim('fino al ' + fmtDay(r.longestDrought.endDay)) : ''}`);
  out.push(`  Adesso             ${c.bold(r.currentStreak ? plural(r.currentStreak, 'giorno', 'giorni') + ' di fila' : plural(r.currentDrought, 'giorno', 'giorni') + ' senza birre')}`);

  // Traguardi
  head('Traguardi');
  const ms = s.milestones.map((m) => (m.reached
    ? `${c.accent('✓ ' + m.n)} ${fmtDay(m.day)} ${c.dim(m.author ?? '')}`
    : `${c.dim('· ' + m.n)} ${c.dim(m.etaDay === null ? '–' : '~' + fmtDay(m.etaDay, { day: 'numeric', month: 'short', year: '2-digit' }))}`));
  for (let i = 0; i < ms.length; i += 3) out.push('  ' + ms.slice(i, i + 3).join('   '));

  // Correzioni
  const an = result.counted.anomalies;
  head(`Correzioni (${an.length})`);
  if (!an.length) out.push(c.dim('  Nessuna: la numerazione è perfetta.'));
  for (const a of an) out.push(`  ${pad(fmtDateTime(a.message.ts), 14)} ${pad((a.message.author ?? '').slice(0, 18), 18)} ${pad(a.type, 9)} ${c.dim(a.note)}`);

  return out.join('\n') + '\n';
}

function palette(on) {
  const wrap = (a, b) => (t) => (on ? `\x1b[${a}m${t}\x1b[${b}m` : String(t));
  return {
    head: wrap('1;33', '0'),
    accent: wrap('33', '39'),
    bold: wrap('1', '22'),
    dim: wrap('2', '22'),
    bad: wrap('31', '39'),
  };
}
