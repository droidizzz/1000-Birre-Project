import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNameResolver, maskPhone, isPhone } from '../src/core/names.js';

test('maskPhone keeps the country code and the last 4 digits', () => {
  assert.equal(maskPhone('+39 333 555 0142'), '+39 ··· 0142');
  assert.equal(maskPhone('+41 79 555 01 23'), '+41 ··· 0123');
  assert.equal(maskPhone('Marco Ferri'), 'Marco Ferri');
  assert.equal(isPhone('Tu'), false);
});

test('aliases match names case-insensitively', () => {
  const resolve = createNameResolver({ tu: 'Mario Rossi' });
  assert.equal(resolve('Tu'), 'Mario Rossi');
  assert.equal(resolve('Giulia'), 'Giulia');
});

test('phone aliases match in any format, with or without country code', () => {
  const resolve = createNameResolver({ '3335550142': 'Luca', '+39 347 555 0198': 'Sara', '+41 ··· 0123': 'Nico' });
  assert.equal(resolve('+39 333 555 0142'), 'Luca');
  assert.equal(resolve('+39 347 555 0198'), 'Sara');
  assert.equal(resolve('+41 79 555 01 23'), 'Nico');
});

test('unknown phones are masked unless masking is off', () => {
  assert.equal(createNameResolver({})('+39 320 555 0177'), '+39 ··· 0177');
  assert.equal(createNameResolver({}, { maskPhones: false })('+39 320 555 0177'), '+39 320 555 0177');
});
