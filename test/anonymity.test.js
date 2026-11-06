import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {i2pAddressFromKeys, loadAnonymityAddresses} from '../services/anonymity.js';

function destination() {
  const bytes = Buffer.alloc(391);
  bytes[384] = 5;
  bytes.writeUInt16BE(4, 385);
  Buffer.from([0, 7, 0, 4]).copy(bytes, 387);
  return bytes;
}
const expected = 'ssgjbjvy6oa55dcjxihpnpg6lgijtg5eouk3bmclb5hqxv7tle6q.b32.i2p';
test('I2P address hashes the complete public destination including its certificate', () => {
  assert.equal(i2pAddressFromKeys(destination()), expected);
});
test('private key material does not affect the public I2P destination address', () => {
  assert.equal(i2pAddressFromKeys(Buffer.concat([destination(), Buffer.alloc(256, 1)])), expected);
  assert.equal(i2pAddressFromKeys(Buffer.concat([destination(), Buffer.alloc(256, 2)])), expected);
});
test('truncated I2P identities and certificates are rejected', () => {
  assert.throws(() => i2pAddressFromKeys(Buffer.alloc(386)), /Incomplete/);
  assert.throws(() => i2pAddressFromKeys(destination().subarray(0, 389)), /certificate/);
});
test('container startup loads persisted identities and rejects placeholder Tor hostnames', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'monero-identities-'));
  try {
    for (const name of ['rpc', 'p2p']) {
      await mkdir(path.join(directory, `app-monero-${name}`));
      await writeFile(path.join(directory, `app-monero-${name}`, 'hostname'), `${name === 'rpc' ? 'a' : 'b'}`.repeat(56) + '.onion\n');
    }
    const keyFile = path.join(directory, 'monero.dat');
    await writeFile(keyFile, destination());
    const env = {TOR_HIDDEN_SERVICE_DIR: directory, I2P_P2P_KEY_FILE: keyFile};
    await loadAnonymityAddresses(env);
    assert.equal(env.MONERO_RPC_HIDDEN_SERVICE, 'a'.repeat(56) + '.onion');
    assert.equal(env.MONERO_P2P_HIDDEN_SERVICE, 'b'.repeat(56) + '.onion');
    assert.equal(env.MONERO_I2P_HIDDEN_SERVICE, expected);
    await writeFile(path.join(directory, 'app-monero-p2p', 'hostname'), 'notyetset.onion');
    await assert.rejects(loadAnonymityAddresses(env), /Invalid generated Tor hostname/);
  } finally {await rm(directory, {recursive: true, force: true});}
});
