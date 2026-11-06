import {describe, it, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createTestContext} from '../../../global.js';

const {rpc, request} = await createTestContext();
async function info(route, status = 200) {
  const response = await request(`/v1/monerod/info/${route}`);
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  return response.body;
}
const peer = (height, incoming = false, type = 1) => ({
  height, incoming, address_type: type, address: '127.0.0.1:18080',
});

// The old /addresses and /blockcount routes and application JWT middleware were
// absent before the migration. Their obsolete expectations are not carried over.
describe('v1/monerod/info endpoint', () => {
  beforeEach(() => rpc.reset());
  describe('/connections GET', () => {
    it('counts incoming/outgoing and clearnet/Tor/I2P connections', async () => {
      rpc.peers = [peer(100, false), peer(100, false, 3), peer(100, true, 4)];
      assert.deepEqual(await info('connections'), {
        total: 3, inbound: 1, outbound: 2, clearnet: 1, tor: 1, i2p: 1,
      });
    });
    it('returns zero counts without peers', async () => {
      assert.deepEqual(await info('connections'), {
        total: 0, inbound: 0, outbound: 0, clearnet: 0, tor: 0, i2p: 0,
      });
    });
    it('recognizes the real daemon wire values I2P=3 and Tor=4 even without a hostname', async () => {
      rpc.peers = [peer(100, false, 3)];
      assert.deepEqual(await info('connections'), {total: 1, inbound: 0, outbound: 1, clearnet: 0, tor: 0, i2p: 1});
      rpc.peers = [peer(100, true, 4)];
      assert.deepEqual(await info('connections'), {total: 1, inbound: 1, outbound: 0, clearnet: 0, tor: 1, i2p: 0});
    });
    it('returns a JSON error on daemon peer failure', async () => {
      rpc.failures.add('get_connections');
      assert.equal(await info('connections', 500), 'Unable to obtain getPeerInfo from Daemon');
    });
  });
  describe('/status GET', () => {
    it('reports operational when the daemon responds', async () => {
      assert.deepEqual(await info('status'), {operational: true});
    });
    it('reports unavailable rather than returning 500 on daemon failure', async () => {
      rpc.failures.add('get_version');
      assert.deepEqual(await info('status'), {operational: false});
    });
  });
  describe('/sync GET', () => {
    it('returns local chain information without peers', async () => {
      const sync = await info('sync');
      assert.equal(sync.currentBlock, 515055);
      assert.equal(sync.headerCount, 515055);
      assert.equal(sync.chain, 'mainnet');
      assert.equal(sync.percent, 1);
      assert.equal(Object.hasOwn(sync, 'status'), false);
    });
    it('retains local information when a peer has no usable height', async () => {
      rpc.peers = [peer(-1)];
      const sync = await info('sync');
      assert.equal(sync.currentBlock, 515055);
      assert.equal(sync.headerCount, 515055);
      assert.equal(sync.percent, 1);
    });
    it('uses the highest peer header when peers are ahead of the local target', async () => {
      Object.assign(rpc.info, {height: 515035, target_height: 515045, synchronized: false});
      rpc.peers = [peer(-1), peer(515055), peer(515050)];
      const sync = await info('sync');
      assert.equal(sync.currentBlock, 515035);
      assert.equal(sync.headerCount, 515055);
      assert.ok(sync.percent > 0 && sync.percent < 1);
    });
    it('keeps the daemon target when peers are behind it', async () => {
      Object.assign(rpc.info, {height: 515035, target_height: 515055, synchronized: false});
      rpc.peers = [peer(-1), peer(515035)];
      const sync = await info('sync');
      assert.equal(sync.currentBlock, 515035);
      assert.equal(sync.headerCount, 515055);
      assert.ok(sync.percent > 0 && sync.percent < 1);
    });
    it('returns a JSON error when peer retrieval fails', async () => {
      rpc.failures.add('get_connections');
      assert.equal(await info('sync', 500), 'Unable to obtain getPeerInfo from Daemon');
    });
    it('returns a JSON error when blockchain retrieval fails', async () => {
      rpc.failures.add('get_info');
      assert.equal(await info('sync', 500), 'Unable to obtain getBlockChainInfo from Daemon');
    });
  });
  describe('/version GET', () => {
    it('formats the daemon version without release text', async () => {
      rpc.info.version = 'v0.18.5.4-release';
      assert.deepEqual(await info('version'), {version: '0.18.5.4'});
    });
    it('returns a JSON error when version retrieval fails', async () => {
      rpc.failures.add('get_info');
      assert.equal(await info('version', 500), 'Unable to obtain getVersion from Daemon');
    });
  });
});
