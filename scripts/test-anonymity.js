import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const exec = promisify(execFile);
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:8889';
const project = process.env.E2E_COMPOSE_PROJECT || 'codex-monero-anon';
const directory = await mkdtemp(path.join(os.tmpdir(), 'monero-anonymity-'));
const envFile = path.join(directory, 'probe.env');
const compose = ['compose', '--env-file', envFile, '-p', project, '-f', 'docker-compose.yml', '-f', 'docker-compose.browser.yml', '-f', 'test/docker/anonymity.compose.yml'];
const docker = args => process.env.E2E_DOCKER_SUDO === '1'
  ? exec('sudo', ['-n', 'docker', ...args], {timeout: 120000})
  : exec('docker', args, {timeout: 120000});
const curl = async args => JSON.parse((await exec('curl', ['--silent', '--show-error', '--fail', '--max-time', '90', ...args], {timeout: 95000})).stdout);
async function api(route) {
  const response = await fetch(`${base}/v1/monerod/${route}`);
  assert.equal(response.status, 200);
  return response.json();
}
let probesStarted = false;
try {
  const settings = await api('system/monero-config');
  assert.ok(settings.tor && settings.i2p && settings.incomingConnections, 'Enable Tor, I2P and Incoming Connections in the browser first');
  const p2p = await api('system/monero-p2p-connection-details');
  const rpc = await api('system/monero-rpc-connection-details');
  assert.match(p2p.torAddress, /^[a-z2-7]{56}\.onion$/);
  assert.match(p2p.i2pAddress, /^[a-z2-7]{52}\.b32\.i2p$/);
  const exit = await curl(['--socks4a', '127.0.0.1:9050', 'https://check.torproject.org/api/ip']);
  assert.equal(exit.IsTor, true);
  console.log('PASS: SOCKS4a traffic exits through Tor.');
  const onionInfo = await curl(['--socks4a', '127.0.0.1:9050', '--digest', '-u', `${rpc.rpcuser}:${rpc.rpcpassword}`, `http://${rpc.torAddress}:${rpc.port}/get_info`]);
  assert.equal(onionInfo.status, 'OK');
  assert.equal(onionInfo.nettype, settings.network);
  console.log('PASS: generated Tor hidden service forwards authenticated Monero RPC.');
  await writeFile(envFile, `TEST_TOR_P2P=${p2p.torAddress}\nTEST_I2P_P2P=${p2p.i2pAddress}\n`, {mode: 0o600});
  probesStarted = true;
  await docker([...compose, 'up', '-d', 'i2p_client', 'probe']);
  console.log('Waiting for independent Tor/I2P Monero handshakes (up to five minutes)...');
  const verified = new Set();
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline && verified.size < 2) {
    const peers = await curl(['--digest', '-u', 'probe:probe', '-H', 'Content-Type: application/json', '--data', JSON.stringify({jsonrpc: '2.0', id: 'verify', method: 'get_connections'}), 'http://127.0.0.1:18091/json_rpc']);
    for (const peer of peers.result?.connections || []) {
      if (peer.recv_count > 0 && ['normal', 'synchronizing', 'standby'].includes(peer.state) && [3, 4].includes(peer.address_type)) {
        if (!verified.has(peer.address_type)) console.log(`PASS: ${peer.address_type === 3 ? 'I2P' : 'Tor'} Monero P2P handshake completed through its hidden service.`);
        verified.add(peer.address_type);
      }
    }
    if (verified.size < 2) await new Promise(resolve => setTimeout(resolve, 5000));
  }
  assert.deepEqual([...verified].sort(), [3, 4], 'Both networks must complete real handshakes; a listening proxy alone is insufficient');
} finally {
  if (probesStarted) await docker([...compose, 'rm', '-sf', 'probe', 'i2p_client']);
  await rm(directory, {recursive: true, force: true});
}
