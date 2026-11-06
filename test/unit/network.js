import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const moduleUrl = new URL('../../logic/network.js', import.meta.url).href;
const onion = `${'a'.repeat(56)}.onion`;

// Config constants are initialized on import. A fresh process tests each real
// environment configuration without proxyquire or leaking module-cache state.
async function addresses(domain = '', hiddenService = '') {
  const source = `
    import http from 'node:http';
    import https from 'node:https';
    const deny = () => { throw new Error('Address discovery must not contact external services'); };
    http.get = http.request = https.get = https.request = globalThis.fetch = deny;
    const {getMonerodAddresses} = await import(${JSON.stringify(moduleUrl)});
    console.log(JSON.stringify(await getMonerodAddresses()));
  `;
  const {stdout} = await exec(process.execPath, ['--input-type=module', '-e', source], {
    env: {...process.env, DEVICE_DOMAIN_NAME: domain, MONERO_P2P_HIDDEN_SERVICE: hiddenService},
    timeout: 5000,
  });
  return JSON.parse(stdout.trim());
}

describe('networkLogic.getMonerodAddresses', () => {
  it('returns a configured IPv4 address without external lookups', async () => {
    assert.deepEqual(await addresses('10.11.12.13'), ['10.11.12.13']);
  });
  it('returns both the configured local and onion addresses', async () => {
    assert.deepEqual(await addresses('10.11.12.13', onion), ['10.11.12.13', onion]);
  });
  it('preserves a configured IPv6 address without treating its suffix as a port', async () => {
    const ipv6 = '566f:2401:22be:9a6d:23ef:2558:5545:b3fe';
    assert.deepEqual(await addresses(ipv6), [ipv6]);
  });
  it('returns only the onion address when no local domain is configured', async () => {
    assert.deepEqual(await addresses('', onion), [onion]);
  });
  it('returns no addresses when neither is configured', async () => {
    assert.deepEqual(await addresses(), []);
  });
});
