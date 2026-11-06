import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTestContext} from '../global.js';

const {request} = await createTestContext();
const {version} = JSON.parse(await readFile(new URL('../../package.json', import.meta.url)));

describe('ping', () => {
  it('returns JSON containing the application version', async () => {
    const response = await request('/ping');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    assert.equal(response.body.version, `umbrel-middleware-${version}`);
  });
});
