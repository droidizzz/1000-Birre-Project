import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeChat } from '../src/core/analyze.js';
import { requiredPace } from '../src/core/stats.js';
import { dayToISO, isoToDay } from '../src/core/dates.js';

const example = readFileSync(new URL('../examples/chat-esempio.txt', import.meta.url), 'utf8');

test('totals and period', () => {
  const { stats: s } = analyzeChat(example);
  assert.equal(s.total, 295);
  assert.equal(s.remaining, 705);
  assert.equal(dayToISO(s.firstDay), '2026-08-01');
  assert.equal(dayToISO(s.refDay), '2026-09-26');
  assert.equal(s.nDays, 57);
  assert.equal(s.daily.reduce((a, b) => a + b, 0), 295);
  assert.equal(s.cumulative.at(-1), 295);
});

test('projection: remaining divided by the pace', () => {
  const { stats: s } = analyzeChat(example);
  const all = s.rates[0];
  assert.equal(all.rate, 295 / 57);
  assert.equal(all.daysLeft, Math.ceil(705 / (295 / 57)));
  assert.equal(all.etaDay, s.refDay + all.daysLeft);
});

test('the day starts at 5am by default', () => {
  const text = '[9/21/26, 11:00:00 PM] A: <immagine omessa> 1\n[9/22/26, 2:00:00 AM] B: <immagine omessa> 2\n[9/22/26, 3:00:00 AM] B: <immagine omessa> 3\n[9/22/26, 9:00:00 PM] A: <immagine omessa> 4';
  assert.deepEqual(analyzeChat(text).stats.daily, [3, 1]);
  assert.deepEqual(analyzeChat(text, { dayStartHour: 0 }).stats.daily, [1, 3]);
});

test('weekday averages and weeks add up', () => {
  const { stats: s } = analyzeChat(example);
  assert.equal(s.weekday.reduce((a, w) => a + w.beers, 0), 295);
  assert.equal(s.weekday.reduce((a, w) => a + w.days, 0), 57);
  assert.equal(s.weekly.reduce((a, w) => a + w.beers, 0), 295);
  assert.equal(s.hours.reduce((a, b) => a + b, 0), 295);
});

test('leaderboard merges aliases and adds up', () => {
  const plain = analyzeChat(example).stats;
  const merged = analyzeChat(example, { aliases: { 'Sleepy Volta': 'Jolly Fermi' } }).stats;
  assert.equal(plain.leaderboard.reduce((a, p) => a + p.beers, 0), 295);
  assert.equal(merged.leaderboard[0].name, 'Jolly Fermi');
  assert.equal(merged.leaderboard[0].beers, 69 + 34);
});

test('milestones every 100', () => {
  const { stats: s } = analyzeChat(example);
  const [m100, m200, m300] = s.milestones;
  assert.equal(m100.reached, true);
  assert.equal(m200.reached, true);
  assert.equal(m300.reached, false);
  assert.equal(s.milestones.length, 10);
});

test('required pace for a target date', () => {
  const { stats: s } = analyzeChat(example);
  const p = requiredPace(s, isoToDay('2026-12-31'));
  assert.equal(p.days, isoToDay('2026-12-31') - s.refDay);
  assert.equal(p.perDay, 705 / p.days);
  assert.equal(requiredPace(s, s.refDay).perDay, null);
});

test('goal already reached', () => {
  const { stats: s } = analyzeChat(example, { goal: 200 });
  assert.equal(s.remaining, 0);
  assert.ok(s.rates.every((r) => r.daysLeft === 0));
});

test('no beers gives null stats', () => {
  assert.equal(analyzeChat('[9/1/26, 9:00:00 PM] A: ciao').stats, null);
});
