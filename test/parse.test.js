import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseChat, extractNumbers } from '../src/core/parse.js';
import { tsToISO } from '../src/core/dates.js';

const fixture = (name) => readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8');

test('iOS export: 12h clock, month/day order, system messages', () => {
  const { messages, dateOrder } = parseChat(fixture('chat-esempio.txt'));
  assert.equal(dateOrder, 'mdy');
  const first = messages[0];
  assert.equal(first.author, null, 'creation of the group is a system message');
  assert.match(first.text, /ha creato il gruppo/);
  const beer = messages.find((m) => m.text === '<immagine omessa> 1');
  assert.equal(beer.author, '+39 333 555 0142');
  assert.equal(beer.hasPhoto, true);
  assert.equal(tsToISO(beer.ts), '2026-08-01T17:46:43');
});

test('12 AM is midnight and 12 PM is noon', () => {
  const { messages } = parseChat('[9/25/26, 12:05:07 AM] A: x\n[9/25/26, 12:24:04 PM] A: y');
  assert.equal(tsToISO(messages[0].ts), '2026-09-25T00:05:07');
  assert.equal(tsToISO(messages[1].ts), '2026-09-25T12:24:04');
});

test('multi-line messages continue the previous one', () => {
  const { messages } = parseChat(fixture('chat-esempio.txt'));
  const rules = messages.find((m) => /obiettivo di questo gruppo/.test(m.text));
  assert.equal(rules.author, null);
  assert.match(rules.text, /SOLO FOTO\nSOLO BIRRA\nPENA BAN/);
});

test('Android export: 24h clock, day/month order, caption on the next line', () => {
  const { messages, dateOrder } = parseChat(fixture('chat-android.txt'));
  assert.equal(dateOrder, 'dmy');
  const caption = messages.find((m) => m.author === 'Sara Galli' && m.hasPhoto);
  assert.equal(tsToISO(caption.ts), '2026-10-03T18:40:00');
  assert.equal(caption.text, 'IMG-20261003-WA0007.jpg (file allegato)\n348');
});

test('ambiguous dates follow the forced order', () => {
  const text = '[9/5/26, 9:00:00 PM] A: x';
  assert.equal(tsToISO(parseChat(text).messages[0].ts), '2026-05-09T21:00:00');
  assert.equal(tsToISO(parseChat(text, { dateOrder: 'mdy' }).messages[0].ts), '2026-09-05T21:00:00');
});

test('invisible direction marks are ignored', () => {
  const { messages } = parseChat('‎[9/4/26, 7:28:59 PM] Marco: ‎<immagine omessa> 1');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].author, 'Marco');
  assert.equal(messages[0].hasPhoto, true);
});

test('deleted messages are flagged', () => {
  const { messages } = parseChat('[9/12/26, 6:21:26 PM] Tu: Hai eliminato questo messaggio.\n[9/19/26, 8:19:04 PM] Giulia: Questo messaggio è stato eliminato.');
  assert.deepEqual(messages.map((m) => m.deleted), [true, true]);
});

test('extractNumbers', () => {
  const cases = [
    ['<immagine omessa> 12', { lo: 12, hi: 12 }],
    ['<immagine omessa> 100 🍾🎊🎉', { lo: 100, hi: 100 }],
    ['<immagine omessa> 28, 29, 30', { lo: 28, hi: 30 }],
    ['41-42', { lo: 41, hi: 42 }],
    ['#57', { lo: 57, hi: 57 }],
    ['birra 9', { lo: 9, hi: 9 }],
    ['IMG-20261003-WA0007.jpg (file allegato)\n348', { lo: 348, hi: 348 }],
    ['5, 9', { lo: 5, hi: 5 }],
    ['a che ora?', null],
    ['18:30', null],
    ['2.5', null],
  ];
  for (const [text, expected] of cases) assert.deepEqual(extractNumbers(text), expected, text);
});

test('strict mode rejects extra words', () => {
  assert.deepEqual(extractNumbers('3 birre stasera'), { lo: 3, hi: 3 });
  assert.equal(extractNumbers('3 birre stasera', { strict: true }), null);
  assert.deepEqual(extractNumbers('3 🍺', { strict: true }), { lo: 3, hi: 3 });
});
