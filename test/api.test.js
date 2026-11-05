import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir = await mkdtemp(path.join(os.tmpdir(), 'monero-api-test-'));
const rpc = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const request = body ? JSON.parse(body) : {};
    const info = {status: 'OK', height: 100, target_height: 200, mainnet: true, nettype: 'mainnet', difficulty: 12000, database_size: 1000, outgoing_connections_count: 1, version: '0.18.5.1'};
    let response;
    if (req.url === '/mining_status') response = {status: 'OK', active: true, speed: 125, threads_count: 2};
    else if (request.method === 'get_version') response = {jsonrpc: '2.0', id: request.id, result: {status: 'OK', version: 196621, release: true}};
    else if (request.method === 'get_info' || req.url === '/get_info') response = request.method ? {jsonrpc: '2.0', id: request.id, result: info} : info;
    else if (request.method === 'get_connections') response = {jsonrpc: '2.0', id: request.id, result: {status: 'OK', connections: []}};
    else if (req.url === '/get_transaction_pool_stats') response = {status: 'OK', pool_stats: {bytes_total: 0, txs_total: 0}};
    else response = {status: 'OK'};
    res.setHeader('Content-Type', 'application/json');res.end(JSON.stringify(response));
  });
});
rpc.listen(0, '127.0.0.1');await once(rpc, 'listening');
Object.assign(process.env, {MONERO_HOST: '127.0.0.1', MONERO_RPC_PORT: String(rpc.address().port), MONERO_RPC_USER: '', MONERO_RPC_PASSWORD: '', JSON_STORE_FILE: path.join(dir, 'settings.json'), MONERO_CONF_FILE: path.join(dir, 'monero.conf'), TOR_PROXY_IP: '127.0.0.1', TOR_PROXY_PORT: '9050'});
const {default: app} = await import('../app.js');
const server = app.listen(0, '127.0.0.1');await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
after(async () => {server.closeAllConnections();rpc.closeAllConnections();await Promise.all([new Promise(r => server.close(r)), new Promise(r => rpc.close(r))]);await rm(dir, {recursive: true, force: true});});
test('ping and dashboard status are available', async () => {
  assert.equal((await fetch(`${base}/ping`)).status, 200);
  assert.deepEqual(await (await fetch(`${base}/v1/monerod/info/status`)).json(), {operational: true});
});
test('mining reports local hashrate and threads', async () => {
  assert.deepEqual(await (await fetch(`${base}/v1/monerod/info/mining`)).json(), {active: true, speed: 125, threads: 2});
});
test('sync preserves target height even without multiple peers', async () => {
  const sync = await (await fetch(`${base}/v1/monerod/info/sync`)).json();
  assert.equal(sync.currentBlock, 100);assert.equal(sync.headerCount, 200);assert.equal(sync.percent, 0.5);
});
test('invalid address validation is safe', async () => {
  const response = await fetch(`${base}/v1/monerod/system/validate-address`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({address: 'invalid', network: 'mainnet'})});
  assert.deepEqual(await response.json(), {valid: false});
});
test('block route rejects missing/invalid and unbounded queries', async () => {
  for (const url of ['block', 'blocks?from=-1&to=5', 'blocks?from=no&to=5', 'blocks?from=0&to=100000']) assert.equal((await fetch(`${base}/v1/monerod/info/${url}`)).status, 400);
});
