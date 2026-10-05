#!/usr/bin/env node
// Command line: reads a WhatsApp export and prints or writes the statistics.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { analyzeChat } from '../src/core/analyze.js';
import { DEFAULT_OPTIONS } from '../src/core/options.js';
import { renderTerminal } from '../src/report/terminal.js';
import { toReport, toCsv } from '../src/report/json.js';
import { buildHtml, reportPayload } from '../src/report/html.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const HELP = `Mille Birre ${pkg.version}: statistiche dall'export di una chat WhatsApp.

Uso:
  mille-birre <chat.txt> [opzioni]

Uscita (si possono combinare; senza nessuna stampa il riepilogo):
      --html <file>         report HTML autonomo, da aprire nel browser o condividere
      --json [file]         statistiche in JSON (senza file: sullo standard output)
      --csv <file>          una riga per birra: numero, data, ora, autore, tipo

Conteggio:
  -g, --goal <n>            obiettivo (default ${DEFAULT_OPTIONS.goal})
  -d, --day-start <ora>     ora in cui inizia la giornata, 0-23 (default ${DEFAULT_OPTIONS.dayStartHour})
  -j, --max-jump <n>        salto massimo tra due numeri prima di considerarlo un refuso (default ${DEFAULT_OPTIONS.maxJump})
      --no-photo            conta anche i numeri scritti senza foto
      --strict              scarta i messaggi con testo oltre al numero
      --date-order <ordine> dmy (31/12/26) o mdy (12/31/26), se il riconoscimento automatico sbaglia
  -c, --config <file>       file JSON con opzioni e nomi (vedi config.example.json)

Nomi:
      --no-mask             mostra i numeri di telefono interi

Altro:
      --no-color            niente colori nel terminale
  -h, --help                questo aiuto
  -v, --version             versione

Esempi:
  mille-birre _chat.txt
  mille-birre _chat.txt --config gruppo.json --html report.html
  mille-birre _chat.txt --json | jq .pace
`;

function fail(msg) {
  process.stderr.write(`mille-birre: ${msg}\n`);
  process.exit(1);
}

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      html: { type: 'string' },
      json: { type: 'boolean' },
      csv: { type: 'string' },
      goal: { type: 'string', short: 'g' },
      'day-start': { type: 'string', short: 'd' },
      'max-jump': { type: 'string', short: 'j' },
      'no-photo': { type: 'boolean' },
      strict: { type: 'boolean' },
      'date-order': { type: 'string' },
      config: { type: 'string', short: 'c' },
      'no-mask': { type: 'boolean' },
      'no-color': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
} catch (e) {
  fail(`${e.message}\nUsa --help per vedere le opzioni.`);
}
const { values: v, positionals } = args;

if (v.help) { process.stdout.write(HELP); process.exit(0); }
if (v.version) { process.stdout.write(pkg.version + '\n'); process.exit(0); }

// --json accepts an optional file name: "--json out.json" leaves it as the second positional.
const [chatPath, jsonPath] = positionals;
if (!chatPath) fail('indica il file dell\'export, per esempio: mille-birre _chat.txt');
if (positionals.length > (v.json ? 2 : 1)) fail(`argomento inatteso: ${positionals[v.json ? 2 : 1]}`);
if (!existsSync(chatPath)) fail(`il file ${chatPath} non esiste`);
if (/\.zip$/i.test(chatPath)) fail('estrai prima il file .txt dallo zip dell\'export');

let config = {};
if (v.config) {
  try { config = JSON.parse(readFileSync(v.config, 'utf8')); }
  catch (e) { fail(`config ${v.config} non valido: ${e.message}`); }
}
if (v['date-order'] !== undefined && !['dmy', 'mdy'].includes(v['date-order'])) fail('--date-order accetta dmy oppure mdy');
const num = (val, name) => {
  if (val === undefined) return undefined;
  const n = Number(val);
  if (!Number.isFinite(n)) fail(`${name} deve essere un numero, non "${val}"`);
  return n;
};
const options = {
  ...config,
  ...(v.goal !== undefined && { goal: num(v.goal, '--goal') }),
  ...(v['day-start'] !== undefined && { dayStartHour: num(v['day-start'], '--day-start') }),
  ...(v['max-jump'] !== undefined && { maxJump: num(v['max-jump'], '--max-jump') }),
  ...(v['no-photo'] && { requirePhoto: false }),
  ...(v.strict && { strict: true }),
  ...(v['date-order'] !== undefined && { dateOrder: v['date-order'] }),
  ...(v['no-mask'] && { maskPhones: false }),
};

const text = readFileSync(chatPath, 'utf8');
const result = analyzeChat(text, options);
if (!result.messages.length) fail(`${chatPath} non sembra un export di WhatsApp: nessun messaggio riconosciuto`);
const source = basename(chatPath);

let wrote = false;
const written = [];
if (v.html) {
  writeFileSync(v.html, buildHtml(reportPayload(result, source)));
  written.push(`report HTML → ${resolve(v.html)}`);
  wrote = true;
}
if (v.csv) {
  writeFileSync(v.csv, toCsv(result));
  written.push(`CSV → ${resolve(v.csv)}`);
  wrote = true;
}
if (v.json) {
  const json = JSON.stringify(toReport(result, source), null, 2) + '\n';
  if (jsonPath) { writeFileSync(jsonPath, json); written.push(`JSON → ${resolve(jsonPath)}`); }
  else process.stdout.write(json);
  wrote = true;
}
if (!wrote) {
  const color = Boolean(!v['no-color'] && process.stdout.isTTY && !process.env.NO_COLOR);
  process.stdout.write(renderTerminal(result, { color, width: Math.min(process.stdout.columns || 80, 100) }));
}
if (written.length) process.stderr.write(written.map((w) => `✓ ${w}`).join('\n') + '\n');
if (!result.stats) process.exitCode = 2;
