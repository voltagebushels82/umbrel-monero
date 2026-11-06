import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import auth from 'http-auth';
import DigestClient from 'digest-fetch';
import {createRestrictedRpcGateway, startRestrictedRpcGateway} from '../services/restrictedRpc.js';
const realm = 'upstream';
const hash = createHash('md5').update('admin:upstream:private-secret').digest('hex');
const digest = auth.digest({realm, file: () => `admin:${realm}:${hash}`});
let upstreamCalls = 0;
const upstreamRequests = [];
const upstreamHandler = digest.check(async (req, res) => {
  upstreamCalls++;
  if (req.url === '/stop_daemon') {res.writeHead(403).end('restricted');return;}
  const chunks = [];for await (const chunk of req) chunks.push(chunk);
  res.setHeader('content-type', 'application/octet-stream');
  res.end(Buffer.concat(chunks));
});
const upstream = http.createServer((req, res) => {
  upstreamRequests.push({url: req.url, socket: req.socket});
  upstreamHandler(req, res);
});
upstream.listen(0, '127.0.0.1');await once(upstream, 'listening');
const gateway = createRestrictedRpcGateway({username: 'wallet', password: 'wallet-secret', upstream: `http://127.0.0.1:${upstream.address().port}`, upstreamUsername: 'admin', upstreamPassword: 'private-secret'});
gateway.listen(0, '127.0.0.1');await once(gateway, 'listening');
const base = `http://127.0.0.1:${gateway.address().port}`;
after(async () => {gateway.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r => gateway.close(r)), new Promise(r => upstream.close(r))]);});
test('gateway requires separate restricted credentials', async () => {
  assert.equal((await fetch(base + '/get_info')).status, 401);
  const wrong = new DigestClient('admin', 'private-secret');
  assert.equal((await wrong.fetch(base + '/get_info')).status, 401);
  assert.equal(upstreamCalls, 0);
});
test('gateway authenticates upstream separately and preserves binary wallet requests', async () => {
  const client = new DigestClient('wallet', 'wallet-secret');
  const payload = Buffer.from([0, 255, 10, 0, 128]);
  const response = await client.fetch(base + '/getblocks.bin', {method: 'POST', body: payload});
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), payload);
  const handshake = upstreamRequests.filter(request => request.url === "/getblocks.bin");
  assert.equal(handshake.length, 2);
  assert.equal(handshake[0].socket, handshake[1].socket, "digest challenge and retry must use the same TCP connection");
});
test('gateway preserves upstream restricted-method rejection', async () => {
  const client = new DigestClient('wallet', 'wallet-secret');
  assert.equal((await client.fetch(base + '/stop_daemon', {method: 'POST', body: '{}'})).status, 403);
});
test('gateway cannot be configured to the administrative upstream port', () => {
  assert.throws(() => startRestrictedRpcGateway({MONERO_RESTRICTED_RPC_PASSWORD: 'secret', MONERO_RESTRICTED_RPC_PORT: '18081'}), /separate/);
  assert.equal(startRestrictedRpcGateway({}), undefined);
});
