// Dashboard UI. Runs in the same scope as the bundled core (see src/report/html.js),
// so analyzeChat, fmtDay, DEFAULT_OPTIONS… are plain functions here.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad2 = (h) => String(h).padStart(2, '0');

// Per-browser storage. Every access is guarded: private windows and some embeds refuse it.
const store = {
  get(k, d) { try { const v = localStorage.getItem('millebirre:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('millebirre:' + k, JSON.stringify(v)); } catch { /* quota or disabled */ } },
  del(k) { try { localStorage.removeItem('millebirre:' + k); } catch { /* ignore */ } },
};

const DATA = (() => { try { return JSON.parse($('mb-data').textContent); } catch { return {}; } })();
const IS_REPORT = DATA.mode === 'report';

// What is shown at start: a CLI report, else the last file loaded in this browser, else the example.
function defaultInput() {
  if (IS_REPORT) return { kind: 'messages', messages: DATA.messages, dateOrder: DATA.dateOrder, source: { report: true, name: DATA.source, at: DATA.generatedAt } };
  return { kind: 'raw', raw: DATA.raw || '', source: { example: true } };
}
let input = defaultInput();
if (!IS_REPORT) {
  const saved = store.get('chat', null);
  if (saved && saved.raw) input = { kind: 'raw', raw: saved.raw, source: saved.source };
}

// Display names are kept per data source, so names typed for a real chat never leak into the example or a report.
const aliasKey = () => (input.source && input.source.example ? 'aliases:example' : input.source && input.source.report ? 'aliases:report:' + (DATA.source || '') : 'aliases');
let aliases = store.get(aliasKey(), {});
let opts = normalizeOptions({ ...(DATA.options || {}), ...store.get('opts', {}) });

// ---------- controls
$('o-goal').value = opts.goal;
$('o-shift').value = opts.dayStartHour;
$('o-jump').value = opts.maxJump;
$('o-photo').checked = opts.requirePhoto;
$('o-strict').checked = opts.strict;
$('o-mask').checked = opts.maskPhones;
function readOptions() {
  opts = normalizeOptions({
    goal: $('o-goal').value, dayStartHour: $('o-shift').value, maxJump: $('o-jump').value,
    requirePhoto: $('o-photo').checked, strict: $('o-strict').checked, maskPhones: $('o-mask').checked,
  });
  const { aliases: _ignored, ...persist } = opts;
  store.set('opts', persist);
  run();
}
['o-goal', 'o-shift', 'o-jump', 'o-photo', 'o-strict', 'o-mask'].forEach((id) => $(id).addEventListener('change', readOptions));

// ---------- loading a chat
async function loadFile(file) {
  try {
    let text;
    if (/\.zip$/i.test(file.name) || /zip/.test(file.type)) {
      if (typeof JSZip === 'undefined') throw new Error('Per leggere lo zip serve la connessione a internet. In alternativa estrai il file .txt e caricalo.');
      const zip = await JSZip.loadAsync(file);
      const entry = Object.values(zip.files).find((f) => !f.dir && /\.txt$/i.test(f.name));
      if (!entry) throw new Error('Nello zip non c\'è nessun file .txt della chat.');
      text = await entry.async('string');
    } else {
      text = await file.text();
    }
    useText(text, { name: file.name, at: new Date().toISOString() });
  } catch (e) {
    showError(e.message || 'Il file non si riesce a leggere.');
  }
}
function useText(text, source) {
  if (!parseChat(text).messages.length) {
    showError('Non ho trovato messaggi WhatsApp in questo testo. Controlla che sia l\'export della chat.');
    return false;
  }
  input = { kind: 'raw', raw: text, source };
  aliases = store.get(aliasKey(), {});
  if (!IS_REPORT) store.set('chat', { raw: text, source });
  run();
  return true;
}
function showError(msg) { $('source').innerHTML = `<span class="err">${esc(msg)}</span>`; }

$('file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ''; });
$('paste-toggle').addEventListener('click', () => { $('paste-box').hidden = !$('paste-box').hidden; });
$('paste-go').addEventListener('click', () => {
  const t = $('paste-text').value;
  $('paste-err').textContent = '';
  if (!t.trim()) { $('paste-err').textContent = 'Incolla prima il testo della chat.'; return; }
  if (useText(t, { name: 'testo incollato', at: new Date().toISOString() })) { $('paste-box').hidden = true; $('paste-text').value = ''; }
  else $('paste-err').textContent = 'Nessun messaggio riconosciuto nel testo incollato.';
});
document.addEventListener('dragover', (e) => { e.preventDefault(); $('app').classList.add('drop'); });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('app').classList.remove('drop'); });
document.addEventListener('drop', (e) => { e.preventDefault(); $('app').classList.remove('drop'); const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
$('source').addEventListener('click', (e) => {
  if (e.target.id === 'reset-input') { store.del('chat'); input = defaultInput(); aliases = store.get(aliasKey(), {}); run(); }
});

// ---------- charts
const charts = {};
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function alpha(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function chartOptions({ tooltip = {}, legend = { display: false }, scales, ...extra } = {}) {
  const muted = css('--muted');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend,
      tooltip: { backgroundColor: css('--ink'), titleColor: css('--bg'), bodyColor: css('--bg'), padding: 10, cornerRadius: 6, boxWidth: 8, boxHeight: 8, titleFont: { weight: '700' }, ...tooltip },
    },
    scales: scales || {
      x: { grid: { display: false }, border: { color: css('--line') }, ticks: { color: muted, maxRotation: 0, autoSkipPadding: 10, font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: css('--line') }, border: { display: false }, ticks: { color: muted, precision: 0, font: { size: 11 } } },
    },
    ...extra,
  };
}
const barStyle = (color, thickness) => ({ backgroundColor: color, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', maxBarThickness: thickness });
/** First day of each month between two day numbers, thinned to at most 8 ticks. */
function monthTicks(from, to) {
  const out = [];
  const d = new Date(from * DAY_MS);
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  for (;;) {
    if (m > 11) { m = 0; y++; }
    const day = Math.floor(Date.UTC(y, m, 1) / DAY_MS);
    if (day > to) break;
    out.push(day);
    m++;
  }
  const every = Math.ceil(out.length / 8);
  return out.filter((_, i) => i % every === 0);
}
function draw(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), cfg); }

function renderCharts(S) {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = 'Figtree, system-ui, sans-serif';
  Chart.defaults.locale = 'it-IT';
  const accent = css('--accent');
  const scenColor = { all: css('--s-blue'), d30: css('--s-violet'), d7: css('--s-aqua') };

  // Cumulative and projections (linear x axis in day numbers)
  const withEta = S.rates.filter((r) => r.etaDay !== null && S.remaining > 0);
  const xMax = Math.max(S.refDay + 14, ...withEta.map((r) => Math.min(r.etaDay, S.refDay + 730)));
  const projections = withEta.map((r) => {
    const end = Math.min(r.etaDay, xMax);
    return {
      label: `Ritmo ${r.label.toLowerCase()}`,
      data: [{ x: S.refDay, y: S.total }, { x: end, y: Math.min(S.goal, S.total + r.rate * (end - S.refDay)) }],
      borderColor: scenColor[r.key], borderWidth: 2, borderDash: [6, 4], pointRadius: [0, 4],
      pointBackgroundColor: scenColor[r.key], pointBorderColor: css('--surface'), pointBorderWidth: 2,
    };
  });
  const step = S.goal / 5;
  draw('c-proj', {
    type: 'line',
    data: { datasets: [
      { label: 'Birre totali', data: S.cumulative.map((y, i) => ({ x: S.firstDay + i, y })), borderColor: accent, backgroundColor: alpha(accent, 0.14), fill: 'origin', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4 },
      ...projections,
      { label: 'Obiettivo', data: [{ x: S.firstDay, y: S.goal }, { x: xMax, y: S.goal }], borderColor: css('--faint'), borderWidth: 1, borderDash: [2, 3], pointRadius: 0 },
    ] },
    options: chartOptions({
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      legend: { display: true, position: 'bottom', labels: { color: css('--muted'), boxWidth: 14, boxHeight: 2, font: { size: 12 }, filter: (l) => l.text !== 'Obiettivo' } },
      tooltip: { callbacks: { title: (it) => fmtLongDay(it[0].parsed.x), label: (it) => ` ${it.dataset.label}: ${fmtInt(Math.round(it.parsed.y))}` } },
      scales: {
        x: { type: 'linear', min: S.firstDay, max: xMax, grid: { display: false }, border: { color: css('--line') },
          ticks: { color: css('--muted'), maxRotation: 0, autoSkip: false, font: { size: 11 }, callback: (v) => fmtDay(v, { month: 'short', year: '2-digit' }) },
          afterBuildTicks: (axis) => { axis.ticks = monthTicks(S.firstDay, xMax).map((value) => ({ value })); } },
        y: { min: 0, max: Math.ceil((S.goal * 1.04) / 50) * 50, grid: { color: css('--line') }, border: { display: false }, ticks: { color: css('--muted'), stepSize: step, font: { size: 11 }, callback: (v) => (v % step === 0 ? fmtInt(v) : '') } },
      },
    }),
  });

  // Daily with 7-day average
  draw('c-daily', {
    data: { labels: S.daily.map((_, i) => fmtDay(S.firstDay + i)), datasets: [
      { type: 'line', label: 'Media 7 giorni', data: S.movingAvg7, borderColor: css('--ink'), borderWidth: 2, pointRadius: 0, tension: 0.3, order: 0 },
      { type: 'bar', label: 'Birre', data: S.daily, ...barStyle(accent, 22), order: 1 },
    ] },
    options: chartOptions({ tooltip: { callbacks: {
      title: (it) => fmtDay(S.firstDay + it[0].dataIndex, { weekday: 'long', day: 'numeric', month: 'long' }),
      label: (it) => (it.dataset.type === 'line' ? ` Media 7 giorni: ${fmtDec(it.parsed.y)}` : ` Birre: ${it.parsed.y}`),
    } } }),
  });

  // Weekly
  draw('c-weekly', {
    type: 'bar',
    data: { labels: S.weekly.map((w) => fmtDay(w.start)), datasets: [{ label: 'Birre', data: S.weekly.map((w) => w.beers), ...barStyle(accent, 48), backgroundColor: S.weekly.map((w) => (w.partial ? alpha(accent, 0.4) : accent)) }] },
    options: chartOptions({ tooltip: { callbacks: {
      title: (it) => { const w = S.weekly[it[0].dataIndex]; return `${fmtDay(w.start)} – ${fmtDay(w.start + 6)}${w.partial ? ' (parziale)' : ''}`; },
      label: (it) => ` Birre: ${it.parsed.y}`,
    } } }),
  });

  // Weekdays
  draw('c-weekday', {
    type: 'bar',
    data: { labels: WEEKDAYS_SHORT, datasets: [{ label: 'Media', data: S.weekday.map((w) => w.avg), ...barStyle(accent, 40) }] },
    options: chartOptions({ tooltip: { callbacks: { label: (it) => { const w = S.weekday[it.dataIndex]; return ` ${fmtDec(w.avg)} di media (${w.beers} birre in ${w.days} giorni)`; } } } }),
  });

  // Hours, starting from the hour the day starts
  const order = Array.from({ length: 24 }, (_, i) => (i + S.dayStartHour) % 24);
  draw('c-hours', {
    type: 'bar',
    data: { labels: order.map(pad2), datasets: [{ label: 'Birre', data: order.map((h) => S.hours[h]), ...barStyle(accent) }] },
    options: chartOptions({ tooltip: { callbacks: {
      title: (it) => { const h = pad2(order[it[0].dataIndex]); return `${h}:00 – ${h}:59`; },
      label: (it) => ` Birre: ${it.parsed.y}`,
    } } }),
  });
}

// ---------- main render
let current = null;
function run() {
  const o = { ...opts, aliases: { ...(opts.aliases || {}), ...aliases } };
  const result = input.kind === 'raw' ? analyzeChat(input.raw, o) : analyzeMessages(input.messages, o, { dateOrder: input.dateOrder });
  const S = result.stats;
  current = result;
  renderSource(result);
  $('example-banner').hidden = !(input.source && input.source.example);
  if (!S) { showError('Nessuna birra numerata riconosciuta. Prova a disattivare "Conta solo con foto" nelle impostazioni.'); return; }

  renderTotal(S);
  renderKpis(S);
  renderScenarios(S);
  renderLeaderboard(S, result);
  renderRecords(S);
  renderCheck(S, result);
  renderCharts(S);
}

function renderSource(result) {
  const last = result.messages.reduce((m, x) => Math.max(m, x.ts), 0);
  const lastTxt = last ? fmtDateTime(last, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
  const src = input.source || {};
  const label = src.example ? 'Chat di esempio' : src.report ? `Report${src.name ? ' di <b>' + esc(src.name) + '</b>' : ''}` : `File: <b>${esc(src.name)}</b>`;
  const back = src.example ? '' : src.report ? '' : ` · <button type="button" id="reset-input" style="padding:2px 8px;font-size:12px">${IS_REPORT ? 'Torna al report' : 'Torna all\'esempio'}</button>`;
  $('source').innerHTML = `${label} · ultimo messaggio <b>${lastTxt}</b>${back}`;
}

function renderTotal(S) {
  const pct = S.progress * 100;
  $('total').textContent = fmtInt(S.total);
  $('goal-of').textContent = `/ ${fmtInt(S.goal)}`;
  $('remaining').textContent = fmtInt(S.remaining);
  $('goal-h').textContent = fmtInt(S.goal);
  $('fill').style.width = pct + '%';
  $('tube').setAttribute('aria-valuemax', S.goal);
  $('tube').setAttribute('aria-valuenow', S.total);
  $('tube').setAttribute('aria-label', `${S.total} birre su ${S.goal}, ${fmtDec(pct)}%`);
  $('ticks').innerHTML = Array.from({ length: 11 }, (_, i) => `<span class="${i % 2 ? 'odd' : ''}" style="left:${i * 10}%">${fmtInt(Math.round((i * S.goal) / 10))}</span>`).join('');
}

function renderKpis(S) {
  const [all, , d7] = S.rates;
  const diff = S.prev7 ? Math.round(((S.last7 - S.prev7) / S.prev7) * 100) : null;
  const counted = S.total - S.baseline;
  const eta = S.remaining === 0 ? { v: 'Fatto', u: '', s: 'obiettivo raggiunto' }
    : all.etaDay === null ? { v: '–', u: '', s: 'serve almeno una birra' }
    : { v: fmtDay(all.etaDay, { day: 'numeric', month: 'short' }), u: fmtDay(all.etaDay, { year: 'numeric' }), s: `tra ${fmtInt(all.daysLeft)} giorni, al ritmo medio` };
  $('kpis').innerHTML = [
    { e: 'Media giornaliera', v: fmtDec(all.rate), u: 'birre', s: `in ${S.nDays} giorni, dal ${fmtDay(S.firstDay)}` },
    { e: 'Ultimi 7 giorni', v: S.last7, u: 'birre', s: `${fmtDec(d7.rate)} al giorno ` + (diff === null ? '' : `<span class="delta ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)}% sui 7 prima</span>`) },
    { e: 'Giorni con almeno una birra', v: S.activeDays, u: `/ ${S.nDays}`, s: `${fmtDec(S.activeDays ? counted / S.activeDays : 0)} birre a serata, quando si beve` },
    { e: 'Arrivo stimato', ...eta },
  ].map((k) => `<div class="kpi"><div class="eyebrow">${k.e}</div><div class="v num">${k.v} <small>${k.u}</small></div><div class="s">${k.s}</div></div>`).join('');
}

function renderScenarios(S) {
  const colorVar = { all: '--s-blue', d30: '--s-violet', d7: '--s-aqua' };
  $('scen').innerHTML = S.remaining === 0
    ? `<div class="eyebrow">Obiettivo raggiunto</div><p>Il gruppo è arrivato a quota ${fmtInt(S.goal)}.</p>`
    : `<div class="eyebrow">Data di arrivo a ${fmtInt(S.goal)}</div>` + S.rates.map((r) => `
      <div class="scen-row"><span class="swatch" style="background:var(${colorVar[r.key]})"></span>
        <span class="lbl">Ritmo ${r.label.toLowerCase()}</span><span class="eta num">${r.etaDay !== null ? fmtLongDay(r.etaDay) : 'mai, a questo ritmo'}</span>
        <span class="sub num"><span>${fmtDec(r.rate)} birre al giorno</span><span>${r.etaDay !== null ? 'tra ' + fmtInt(r.daysLeft) + ' giorni' : ''}</span></span></div>`).join('');
  const td = $('target-date');
  if (!td.value) td.value = `${new Date(S.refDay * DAY_MS).getUTCFullYear()}-12-31`;
  updateCalc();
  $('day-note').textContent = S.dayStartHour ? `La giornata va dalle ${pad2(S.dayStartHour)}:00 alle ${pad2(S.dayStartHour)}:00 del giorno dopo` : 'Giornata da mezzanotte a mezzanotte';
  const top = S.weekday.map((w, i) => ({ ...w, i })).sort((a, b) => b.avg - a.avg)[0];
  $('wd-note').textContent = `Il giorno più forte è il ${WEEKDAYS_LONG[top.i]}, con ${fmtDec(top.avg)} birre di media.`;
}

function updateCalc() {
  const S = current && current.stats;
  if (!S) return;
  const v = $('target-date').value;
  if (!v) { $('calc-out').textContent = ''; return; }
  const p = requiredPace(S, isoToDay(v));
  if (p.reached) { $('calc-out').textContent = 'Obiettivo già raggiunto.'; return; }
  if (p.perDay === null) { $('calc-out').textContent = 'Scegli una data successiva all\'ultimo messaggio.'; return; }
  const now = S.rates[1].rate;
  const cmp = now > 0 ? Math.round(((p.perDay - now) / now) * 100) : null;
  $('calc-out').innerHTML = `servono <b class="num">${fmtDec(p.perDay)}</b> birre al giorno per ${fmtInt(p.days)} giorni.<br>` +
    (cmp === null ? '' : cmp > 0 ? `Il ${cmp}% in più del ritmo degli ultimi 30 giorni.` : `Il ritmo degli ultimi 30 giorni basta (${fmtDec(now)} al giorno).`);
}
$('target-date').addEventListener('input', updateCalc);

function renderLeaderboard(S, result) {
  const max = S.leaderboard.length ? S.leaderboard[0].beers : 1;
  $('board').innerHTML = S.leaderboard.map((p, i) => `
    <div class="brow"><span class="rk num">${i + 1}</span>
      <span class="nm" title="${esc(p.name)}">${esc(p.name)}<small>${plural(p.activeDays, 'giorno attivo', 'giorni attivi')}</small></span>
      <span><div class="bar" style="width:${(p.beers / max) * 100}%"></div></span>
      <span class="ct num">${p.beers}<small>${Math.round(p.share * 100)}%</small></span></div>`).join('');
  $('board-note').textContent = `${S.leaderboard.length} partecipanti` + (S.unattributed ? ` · ${S.unattributed} birre senza autore` : '');

  // Name editor: one row per author as written in the chat (phones masked when masking is on)
  const drinkers = new Set(S.leaderboard.map((p) => p.name));
  const keys = [...new Set(result.messages.filter((m) => m.author && drinkers.has(m.author)).map((m) => (opts.maskPhones ? maskPhone(m.rawAuthor) : m.rawAuthor)))];
  $('aliases').innerHTML = keys.map((k, i) => `<label for="al-${i}">${esc(k)}<input id="al-${i}" data-k="${esc(k)}" value="${esc(aliases[k] || '')}" placeholder="${esc(k)}"></label>`).join('');
  $('aliases').querySelectorAll('input').forEach((el) => el.addEventListener('change', () => {
    const v = el.value.trim();
    if (v) aliases[el.dataset.k] = v; else delete aliases[el.dataset.k];
    store.set(aliasKey(), aliases);
    run();
  }));
}

function renderRecords(S) {
  const r = S.records;
  const now = r.currentStreak ? [plural(r.currentStreak, 'giorno', 'giorni'), 'di fila, in corso'] : [plural(r.currentDrought, 'giorno', 'giorni'), 'senza birre'];
  $('records').innerHTML = [
    { e: 'Giorno record', v: `${r.bestDay.beers} birre`, s: fmtDay(r.bestDay.day, { weekday: 'long', day: 'numeric', month: 'long' }) },
    { e: 'Settimana record', v: `${r.bestWeek.beers} birre`, s: `${fmtDay(r.bestWeek.start)} – ${fmtDay(r.bestWeek.start + 6)}` },
    { e: 'Serie più lunga', v: plural(r.longestStreak.days, 'giorno', 'giorni'), s: `con almeno una birra, fino al ${fmtDay(r.longestStreak.endDay)}` },
    { e: 'Siccità più lunga', v: plural(r.longestDrought.days, 'giorno', 'giorni'), s: r.longestDrought.days ? `senza birre, fino al ${fmtDay(r.longestDrought.endDay)}` : 'mai un giorno a secco' },
    { e: 'Adesso', v: now[0], s: now[1] },
    { e: 'Giorni attivi', v: `${Math.round((S.activeDays / S.nDays) * 100)}%`, s: `${S.activeDays} giorni su ${S.nDays}` },
  ].map((x) => `<div class="rec"><div class="eyebrow">${x.e}</div><div class="v num">${x.v}</div><div class="s">${x.s}</div></div>`).join('');

  let nextMarked = false;
  $('miles').innerHTML = S.milestones.map((m) => {
    if (m.reached) return `<div class="mile done"><span class="k num">${m.n}</span><span class="d">${fmtDay(m.day)} · ${m.daysTaken} gg</span><span class="d">${esc(m.author || '')}</span></div>`;
    const isNext = !nextMarked;
    nextMarked = true;
    const eta = m.etaDay === null ? '–' : fmtDay(m.etaDay, { day: 'numeric', month: 'short' });
    return `<div class="mile${isNext ? ' next' : ''}"><span class="k num">${m.n}</span><span class="d">${isNext ? 'mancano ' + (m.n - S.total) : 'stima'}</span><span class="d">${isNext ? 'stima ' + eta : eta}</span></div>`;
  }).join('');
}

function renderCheck(S, result) {
  const { counted, messages, dateOrder } = result;
  const system = messages.filter((m) => !m.author).length;
  $('parse-sum').innerHTML = [
    `<span><b>${messages.length}</b> messaggi letti</span>`,
    `<span><b>${system}</b> di sistema</span>`,
    `<span><b>${counted.candidates}</b> con un numero valido</span>`,
    `<span><b>${S.total}</b> birre contate</span>`,
    dateOrder ? `<span>formato data <b>${dateOrder === 'mdy' ? 'mese/giorno' : 'giorno/mese'}</b></span>` : '',
    S.baseline ? `<span><b>${S.baseline}</b> birre precedenti all'export</span>` : '',
  ].join('');
  const an = counted.anomalies;
  $('anom-title').textContent = an.length ? `Correzioni e messaggi scartati (${an.length})` : 'Nessuna correzione: la numerazione è perfetta';
  $('anom').innerHTML = an.map((a) => `<tr>
    <td class="num" style="white-space:nowrap">${fmtDateTime(a.message.ts)}</td>
    <td>${esc(a.message.author)}</td>
    <td class="mono" style="font-size:12px">${esc(a.message.text.slice(0, 80))}</td>
    <td><span class="chip ${a.type}">${a.type}</span></td>
    <td>${esc(a.note)}</td></tr>`).join('');
}

// Redraw the charts when the theme changes, so their colors follow it.
const rerender = () => { if (current && current.stats) renderCharts(current.stats); };
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerender); } catch { /* old browsers */ }
new MutationObserver(rerender).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

run();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(rerender);
