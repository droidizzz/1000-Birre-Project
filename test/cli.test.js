import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/mille-birre.js', import.meta.url));
const example = fileURLToPath(new URL('../examples/chat-esempio.txt', import.meta.url));
const config = fileURLToPath(new URL('../config.example.json', import.meta.url));
const run = (...args) => execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });

test('prints a summary', () => {
  const out = run(example);
  assert.match(out, /MILLE BIRRE/);
  assert.match(out, /295 \/ 1\.?000/);
  assert.doesNotMatch(out, /\x1b\[/, 'no colors when the output is not a terminal');
  assert.match(out, /CLASSIFICA/);
});

test('--json with config', () => {
  const report = JSON.parse(run(example, '--json', '--config', config, '--goal', '500'));
  assert.equal(report.total, 295);
  assert.equal(report.goal, 500);
  assert.equal(report.leaderboard.find((p) => p.name === 'Admiring Turing').beers, 41);
  assert.equal(report.options.aliases, undefined, 'aliases are not repeated in the output');
  assert.equal(report.daily.length, 57);
});

test('--html and --csv write files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mille-birre-'));
  run(example, '--html', join(dir, 'r.html'), '--csv', join(dir, 'b.csv'));
  const html = readFileSync(join(dir, 'r.html'), 'utf8');
  assert.match(html, /<title>Mille Birre<\/title>/);
  assert.match(html, /"mode":"report"/);
  assert.doesNotMatch(html, /@@(STYLE|DATA|SCRIPT)@@/);
  assert.doesNotMatch(html, /tenetevi pronti/, 'chatter without numbers stays out of the report');
  const csv = readFileSync(join(dir, 'b.csv'), 'utf8').trim().split('\n');
  assert.equal(csv.length, 296);
  assert.ok(existsSync(join(dir, 'r.html')));
});

test('errors are explained', () => {
  const r = spawnSync(process.execPath, [bin, 'non-esiste.txt'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /non esiste/);
});
