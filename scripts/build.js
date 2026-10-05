#!/usr/bin/env node
// Builds the static website: dist/index.html, a single file with the example chat.
//
//   npm run build
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildHtml } from '../src/report/html.js';

const path = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const raw = readFileSync(path('examples/chat-esempio.txt'), 'utf8');

mkdirSync(path('dist'), { recursive: true });
writeFileSync(path('dist/index.html'), buildHtml({ mode: 'example', raw }));
console.log('✓ dist/index.html');
