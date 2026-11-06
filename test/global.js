import {after} from 'node:test';
import {once} from 'node:events';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRpcMock} from './mocks/monerod.js';

// Each test file runs in its own Node process. Exercise Express and the actual
// monero-ts adapter over HTTP instead of patching immutable ESM imports.
export async function createTestContext() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'monero-legacy-test-'));
  const rpc = createRpcMock();
  rpc.server.listen(0, '127.0.0.1');
  await once(rpc.server, 'listening');
  Object.assign(process.env, {
    NODE_ENV: 'test', MONERO_HOST: '127.0.0.1',
    MONERO_RPC_PORT: String(rpc.server.address().port),
    MONERO_RPC_USER: '', MONERO_RPC_PASSWORD: '',
    JSON_STORE_FILE: path.join(directory, 'settings.json'),
    MONERO_CONF_FILE: path.join(directory, 'monero.conf'),
  });
  const {default: app} = await import('../app.js');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  after(async () => {
    server.closeAllConnections();
    rpc.server.closeAllConnections();
    await Promise.all([
      new Promise(resolve => server.close(resolve)),
      new Promise(resolve => rpc.server.close(resolve)),
    ]);
    await rm(directory, {recursive: true, force: true});
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {rpc, request: async route => {
    const response = await fetch(base + route);
    return {status: response.status, headers: response.headers, body: await response.json()};
  }};
}
