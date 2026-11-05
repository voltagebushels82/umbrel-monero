import {test, expect} from '@playwright/test';

test('dashboard, connection details and settings work on Vue 3', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'warning' && message.text().includes('[Vue warn]')) errors.push(message.text()); });
  const settings = {tor: true, torOnly: false, i2p: false, network: 'mainnet', incomingConnections: false, dbSyncMode: 'fast', mining: false, moneroAddress: '', minercpuTarget: 40};
  await page.route('**/ping', route => route.fulfill({json: {version: 'test'}}));
  await page.route('**/v1/**', route => {
    const path = new URL(route.request().url()).pathname.split('/').pop();
    const responses = {
      status: {operational: true}, sync: {percent: 1, currentBlock: 100, headerCount: 100, chain: 'mainnet'},
      stats: {difficulty: 12000, size: 10000, mempool: 0, mempoolTransactions: 0, connections: 1, networkhashps: 100},
      connections: {total: 1, outbound: 1, inbound: 0, clearnet: 1, tor: 0, i2p: 0},
      version: {version: '0.18.5.1'}, blocks: {blocks: []}, mining: {active: true, speed: 125, threads: 2},
      'monero-config': settings,
      'monero-rpc-connection-details': {rpcuser: 'user', rpcpassword: 'pass', port: '18081', restrictedPort: '18089', zmqPort: '18082', zmqPubPort: '18084', localAddress: 'localhost', torAddress: 'test.onion', torConnectionString: 'xmrrpc://test.onion:18081'},
      'monero-p2p-connection-details': {port: '18080', onionPort: '18083', localAddress: 'localhost', torAddress: 'test.onion', torConnectionString: 'test.onion:18083'},
    };
    return route.fulfill({json: responses[path] || []});
  });
  await page.goto('/');
  await expect(page.getByText('Running', {exact: true})).toBeVisible({timeout: 15000});
  await page.getByRole('button', {name: 'Connect', exact: true}).click();
  await expect(page.getByText('Connect to Monero Node', {exact: true})).toBeVisible();
  await expect(page.getByText(/P2Pool ZMQ publish/)).toContainText('18084');
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();
  await page.locator('.dropdown-toggle').first().click();
  await page.getByText('Advanced Settings', {exact: false}).first().click();
  await expect(page.getByRole('heading', {name: 'Advanced Settings'})).toBeVisible();
  const network = page.locator('select').filter({has: page.locator('option[value="testnet"]')});
  await network.selectOption('testnet');
  await expect(network).toHaveValue('testnet');
  await page.locator('#tor-only').click();
  await page.locator('#zmq').click();
  expect(errors).toEqual([]);
});
