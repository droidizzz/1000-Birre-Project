#!/usr/bin/env node
// Generates examples/chat-esempio.txt: a fictional group chat in the iOS (Italian)
// export format, with the edge cases the counter has to handle. Deterministic.
//
//   node scripts/generate-example.js

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../examples/chat-esempio.txt', import.meta.url));

// Fictional people. Phone numbers use the 555 range.
const PEOPLE = [
  { name: 'Marco Ferri', weight: 5 },
  { name: 'Giulia Conti', weight: 4 },
  { name: '+39 333 555 0142', weight: 4 },
  { name: 'Tu', weight: 3 },
  { name: 'Ale Moretti', weight: 3 },
  { name: '+39 347 555 0198', weight: 2 },
  { name: '+41 79 555 01 23', weight: 1 },
];

let seed = 20260801;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = () => {
  const total = PEOPLE.reduce((s, p) => s + p.weight, 0);
  let r = rand() * total;
  for (const p of PEOPLE) { if ((r -= p.weight) < 0) return p.name; }
  return PEOPLE[0].name;
};

const pad = (n) => String(n).padStart(2, '0');
function stamp(d) {
  const h = d.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `[${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}, ${h12}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${h < 12 ? 'AM' : 'PM'}]`;
}

const lines = [];
const say = (d, who, text) => lines.push(`${stamp(d)} ${who}: ${text}`);
const sys = (d, text) => lines.push(`${stamp(d)} - ${text}`);

const start = Date.UTC(2026, 7, 1); // 1 Aug 2026
lines.push('I messaggi e le chiamate sono crittografati end-to-end. Nessuno al di fuori di questa chat, nemmeno WhatsApp, può leggerne o ascoltarne il contenuto.');
sys(new Date(start - 86400e3 + 20 * 3600e3), 'Marco Ferri ha creato il gruppo.');
sys(new Date(start - 86400e3 + 20 * 3600e3 + 60e3), 'Marco Ferri ha aggiunto Tu.');
say(new Date(start - 86400e3 + 21 * 3600e3), 'Marco Ferri', 'si parte domani, tenetevi pronti');

// Beers per day: weekend-heavy, with a quiet week in the middle.
const BASE = [2, 3, 3, 4, 9, 13, 5]; // Mon..Sun
let n = 0;
const days = 57; // 1 Aug → 26 Sep
for (let day = 0; day < days; day++) {
  const date = start + day * 86400e3;
  const wd = (new Date(date).getUTCDay() + 6) % 7;
  const quiet = day >= 24 && day <= 30;
  let count = Math.round(BASE[wd] * (quiet ? 0.2 : 0.6 + rand() * 0.8));
  if (day === 0) count = 12;
  // Times between 17:00 and 03:00
  const times = Array.from({ length: count }, () => (17 + rand() * 10) * 3600e3).sort((a, b) => a - b);
  for (const t of times) {
    const d = new Date(date + t + Math.floor(rand() * 59) * 1000);
    const who = pick();
    n++;
    if (n === 7) { // rules, posted by the admin as a system announcement
      sys(new Date(d - 60e3), "L'obiettivo di questo gruppo è raggiungere le 1000 birre bevute collettivamente. Invia la foto della birra e in didascalia scrivi il numero successivo.\nSOLO FOTO\nSOLO BIRRA\nPENA BAN");
    }
    if (n === 23) { // photo and number in two messages
      say(d, who, '<immagine omessa>');
      say(new Date(+d + 4000), who, String(n));
      continue;
    }
    if (n === 41) { // three beers in one message
      say(d, who, `<immagine omessa> ${n}, ${n + 1}, ${n + 2}`);
      n += 2;
      continue;
    }
    if (n === 88) { // two people post the same number a few seconds apart
      say(d, who, `<immagine omessa> ${n}`);
      say(new Date(+d + 2000), who === 'Giulia Conti' ? 'Marco Ferri' : 'Giulia Conti', `<immagine omessa> ${n}`);
      n++;
      continue;
    }
    if (n === 123) { // typo
      say(d, who, '<immagine omessa> 1230');
      continue;
    }
    if (n === 150) { // milestone celebration and a deleted message
      say(d, who, `<immagine omessa> ${n} 🍾🎉`);
      lines.push(`${stamp(new Date(+d + 30000))} ${who}: Questo messaggio è stato eliminato.`);
      continue;
    }
    if (n === 200) { // chatter that must not count
      say(new Date(+d - 120000), 'Ale Moretti', 'stasera 2 birre e poi a casa');
    }
    say(d, who, `<immagine omessa> ${n}`);
  }
}

writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`Scritto ${OUT}: ${lines.length} righe, ultima birra ${n}`);
