import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getSyncPercentage} from '../build/services/monerod.js';

test('a fresh daemon awaiting peers does not report full synchronization', () => {
  assert.equal(getSyncPercentage(1, 0, false), 0);
  assert.equal(getSyncPercentage(100, 100, false), 0);
});
test('sync progress cannot round up to complete before the daemon is synchronized', () => {
  assert.equal(getSyncPercentage(999999, 1000000, false), 0.9999);
  assert.equal(getSyncPercentage(100, 200, false), 0.5);
});
test('a synchronized daemon reports completion when no target is advertised', () => {
  assert.equal(getSyncPercentage(1000000, 0, true), 1);
});
