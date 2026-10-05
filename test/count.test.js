import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseChat } from '../src/core/parse.js';
import { countBeers } from '../src/core/count.js';

const fixture = (name) => readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8');
const count = (text, opts) => countBeers(parseChat(text).messages, opts);

// Builds an iOS-style chat from [minute, author, text] rows on 21 Sep 2026 (an unambiguous date).
const chat = (rows) => rows.map(([min, who, text]) => {
  const h = 18 + Math.floor(min / 60), m = min % 60;
  return `[9/21/26, ${h - 12}:${String(m).padStart(2, '0')}:00 PM] ${who}: ${text}`;
}).join('\n');

test('example chat: every beer numbered once, in order', () => {
  const r = count(fixture('chat-esempio.txt'));
  assert.equal(r.total, 295);
  assert.equal(r.baseline, 0);
  assert.deepEqual(r.beers.map((b) => b.n), Array.from({ length: 295 }, (_, i) => i + 1));
  assert.deepEqual(r.anomalies.map((a) => a.type), ['multipla', 'corretto', 'corretto']);
});

test('chatter with numbers does not count', () => {
  const r = count(fixture('chat-esempio.txt'));
  assert.ok(!r.beers.some((b) => /stasera/.test(b.message.text)));
});

test('same number posted twice within minutes counts as two beers', () => {
  const r = count(chat([
    [0, 'A', '<immagine omessa> 1'], [5, 'B', '<immagine omessa> 2'], [6, 'C', '<immagine omessa> 2'], [30, 'A', '<immagine omessa> 4'],
  ]));
  assert.equal(r.total, 4);
  assert.deepEqual(r.beers.map((b) => [b.n, b.author]), [[1, 'A'], [2, 'B'], [3, 'C'], [4, 'A']]);
});

test('a duplicate at the end of the chat still counts', () => {
  const r = count(chat([[0, 'A', '<immagine omessa> 1'], [5, 'B', '<immagine omessa> 2'], [6, 'C', '<immagine omessa> 2']]));
  assert.equal(r.total, 3);
});

test('a late repeated number is ignored', () => {
  const r = count(chat([[0, 'A', '<immagine omessa> 1'], [5, 'B', '<immagine omessa> 2'], [90, 'C', '<immagine omessa> 2']]));
  assert.equal(r.total, 2);
  assert.equal(r.anomalies.at(-1).type, 'ignorato');
});

test('a typo is replaced by the number the sequence expects', () => {
  const r = count(chat([
    [0, 'A', '<immagine omessa> 1'], [5, 'B', '<immagine omessa> 2'], [9, 'C', '<immagine omessa> 30'], [12, 'A', '<immagine omessa> 4'],
  ]));
  assert.equal(r.total, 4);
  assert.equal(r.beers[2].author, 'C');
  assert.equal(r.beers[2].kind, 'corretto');
});

test('a gap with no candidate is counted without author', () => {
  const r = count(chat([[0, 'A', '<immagine omessa> 1'], [5, 'B', '<immagine omessa> 2'], [9, 'C', '<immagine omessa> 4']]));
  assert.equal(r.total, 4);
  assert.equal(r.beers[2].author, null);
  assert.equal(r.anomalies[0].type, 'buco');
});

test('numbers without a photo need --no-photo', () => {
  const text = chat([[0, 'A', '1'], [5, 'B', '2'], [9, 'C', '3']]);
  assert.equal(count(text).total, 0);
  assert.equal(count(text, { requirePhoto: false }).total, 3);
});

test('photo and number in two messages from the same person', () => {
  const r = count(chat([[0, 'A', '<immagine omessa>'], [1, 'A', '1'], [5, 'B', '<immagine omessa> 2'], [8, 'C', '<immagine omessa> 3']]));
  assert.equal(r.total, 3);
});

test('export starting mid-game reports the earlier beers as baseline', () => {
  const r = count(fixture('chat-android.txt'));
  assert.equal(r.baseline, 347);
  assert.equal(r.total, 353);
  assert.equal(r.beers.length, 6);
});

test('a stray small number before the game starts is skipped', () => {
  const r = count(chat([[0, 'A', '<immagine omessa> 3 ahah'], [10, 'B', '<immagine omessa> 1'], [12, 'C', '<immagine omessa> 2'], [15, 'A', '<immagine omessa> 3'], [20, 'B', '<immagine omessa> 4']]));
  assert.equal(r.total, 4);
  assert.equal(r.baseline, 0);
});
