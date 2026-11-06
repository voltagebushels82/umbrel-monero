import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir = await mkdtemp(path.join(os.tmpdir(), 'monero-config-test-'));
Object.assign(process.env, {JSON_STORE_FILE: path.join(dir, 'settings.json'), MONERO_CONF_FILE: path.join(dir, 'monero.conf'), TOR_PROXY_IP: '127.0.0.1', TOR_PROXY_PORT: '9050', MONERO_P2P_HIDDEN_SERVICE: 'a'.repeat(56) + '.onion'});
Object.assign(process.env, {I2P_DAEMON_IP: '127.0.0.1', I2P_DAEMON_PORT: '4447', MONERO_I2P_HIDDEN_SERVICE: 'b'.repeat(52) + '.b32.i2p'});
Object.assign(process.env, {MONERO_TOR: 'true', MONERO_I2P: 'false', MONERO_DEFAULT_NETWORK: 'mainnet'});
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
test('clearnet proxy disables direct listeners and DNS', () => {
  const output = config({torOnly: true, incomingConnections: true});
  for (const line of ['proxy=127.0.0.1:9050', 'p2p-bind-ip=127.0.0.1', 'in-peers=0', 'igd=disabled', 'disable-dns-checkpoints=1', 'enable-dns-blocklist=0', 'check-updates=disabled']) assert.ok(output.split('\n').includes(line), line);
  assert.doesNotMatch(output, /^public-node=1$/m);
});
test('clearnet proxy, Tor peers and I2P peers can be configured independently', () => {
  for (const torOnly of [false, true]) {
    for (const tor of [false, true]) {
      for (const i2p of [false, true]) {
        const output = config({torOnly, tor, i2p, incomingConnections: true});
        const lines = output.split('\n');
        assert.equal(lines.includes('proxy=127.0.0.1:9050'), torOnly);
        assert.equal(lines.includes('tx-proxy=tor,127.0.0.1:9050'), tor);
        assert.equal(lines.includes('tx-proxy=i2p,127.0.0.1:4447'), i2p);
        assert.equal(lines.includes('p2p-bind-ip=127.0.0.1'), torOnly);
        assert.equal(lines.includes('igd=disabled'), torOnly);
        assert.equal(/^anonymous-inbound=a{56}\.onion:/m.test(output), tor);
        assert.equal(/^anonymous-inbound=b{52}\.b32\.i2p,/m.test(output), i2p);
      }
    }
  }
});
test('ZMQ RPC and P2Pool publishing are distinct from Tor', () => {
  assert.match(config({zmq: true}), /^zmq-pub=tcp:\/\/0\.0\.0\.0:18084$/m);
  assert.match(config({zmq: true}), /^zmq-rpc-bind-port=18082$/m);
  assert.match(config({zmq: false}), /^no-zmq=1$/m);
});
test('I2P uses SOCKS and forwards its persistent destination to a distinct inbound port', () => {
  const output = config({i2p: true, incomingConnections: true});
  assert.match(output, /^tx-proxy=i2p,127\.0\.0\.1:4447$/m);
  assert.match(output, /^anonymous-inbound=b{52}\.b32\.i2p,0\.0\.0\.0:18087,25$/m);
  assert.doesNotMatch(output, /7656/);
  assert.doesNotMatch(config({i2p: false}), /tx-proxy=i2p|b32\.i2p/);
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
test('combined routing settings persist across partial updates', async () => {
  await applyCustomMoneroConfig({torOnly: true, tor: true, i2p: true});
  await applyCustomMoneroConfig({prune: true});
  const settings = await getJsonStore();
  assert.equal(settings.torOnly, true);
  assert.equal(settings.tor, true);
  assert.equal(settings.i2p, true);
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
