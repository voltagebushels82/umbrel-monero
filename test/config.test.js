import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir = await mkdtemp(path.join(os.tmpdir(), 'monero-config-test-'));
Object.assign(process.env, {JSON_STORE_FILE: path.join(dir, 'settings.json'), MONERO_CONF_FILE: path.join(dir, 'monero.conf'), TOR_PROXY_IP: '127.0.0.1', TOR_PROXY_PORT: '9050', MONERO_P2P_HIDDEN_SERVICE: 'a'.repeat(56) + '.onion'});
const {normalizeSettings, settingsToMultilineConfString: config, applyCustomMoneroConfig, getJsonStore} = await import('../logic/disk.js');
after(() => rm(dir, {recursive: true, force: true}));

test('testnet and persisted legacy test setting select the daemon network', () => {
  for (const network of ['test', 'testnet']) assert.match(config({network}), /^testnet=1$/m);
  assert.match(config({network: 'stagenet'}), /^stagenet=1$/m);
  assert.doesNotMatch(config({network: 'mainnet'}), /^(testnet|stagenet)=/m);
});
test('incoming Tor binds to an IP with a defined, distinct onion port', () => {
  const output = config({incomingConnections: true});
  assert.match(output, /^anonymous-inbound=a{56}\.onion:18083,0\.0\.0\.0:18083,64$/m);
  assert.doesNotMatch(output, /undefined|monerod:/);
});
test('disabled incoming connections prevent inbound peers and UPnP', () => {
  const output = config({incomingConnections: false});
  assert.match(output, /^in-peers=0$/m);
  assert.match(output, /^igd=disabled$/m);
  assert.doesNotMatch(output, /^anonymous-inbound=/m);
});
test('Tor-only proxies all outbound peers and disables clearnet listeners and DNS', () => {
  const output = config({torOnly: true, incomingConnections: true});
  for (const line of ['proxy=127.0.0.1:9050', 'p2p-bind-ip=127.0.0.1', 'in-peers=0', 'igd=disabled', 'disable-dns-checkpoints=1', 'enable-dns-blocklist=0', 'check-updates=disabled']) assert.ok(output.split('\n').includes(line), line);
  assert.doesNotMatch(output, /^public-node=1$/m);
  assert.throws(() => config({torOnly: true, tor: false}), /Tor-only/);
});
test('ZMQ RPC and P2Pool publishing are distinct from Tor', () => {
  assert.match(config({zmq: true}), /^zmq-pub=tcp:\/\/0\.0\.0\.0:18084$/m);
  assert.match(config({zmq: true}), /^zmq-rpc-bind-port=18082$/m);
  assert.match(config({zmq: false}), /^no-zmq=1$/m);
});
test('invalid settings and injected config lines are rejected', () => {
  for (const input of [{network: 'invalid'}, {mining: 'true'}, {mining: true, minercpuTarget: 101}, {dbSyncMode: 'fast\nfoo=1'}, {moneroAddress: 'address\nstart-mining=other'}]) assert.throws(() => normalizeSettings(input));
});
test('partial updates retain stored values and config/settings agree after concurrent writes', async () => {
  await applyCustomMoneroConfig({network: 'testnet'});
  await applyCustomMoneroConfig({prune: true});
  assert.equal((await getJsonStore()).network, 'testnet');
  await Promise.all([applyCustomMoneroConfig({network: 'mainnet'}), applyCustomMoneroConfig({network: 'stagenet'})]);
  const settings = await getJsonStore();
  assert.equal(await readFile(process.env.MONERO_CONF_FILE, 'utf8'), config(settings));
});
test('startup repairs malformed inbound ports and legacy testnet without resetting settings', async () => {
  const {repairLegacyConfig} = await import('../logic/disk.js');
  await writeFile(process.env.JSON_STORE_FILE, JSON.stringify({network: 'test', incomingConnections: true}));
  await writeFile(process.env.MONERO_CONF_FILE, 'anonymous-inbound=bad:undefined,monerod:undefined,64');
  assert.equal(await repairLegacyConfig(), true);
  const saved = await readFile(process.env.MONERO_CONF_FILE, 'utf8');
  assert.match(saved, /^testnet=1$/m);
  assert.doesNotMatch(saved, /undefined|monerod:/);
  assert.equal(await repairLegacyConfig(), false);
});
test('corrupt settings are surfaced rather than silently replaced', async () => {
  await writeFile(process.env.JSON_STORE_FILE, '{bad');
  await assert.rejects(getJsonStore);
});
test('failed config writes reject', async () => {
  const {writePlainTextFile} = await import('../services/disk.js');
  await assert.rejects(writePlainTextFile('/dev/null/config', 'data'));
});
