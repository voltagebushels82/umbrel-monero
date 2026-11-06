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
      status: {operational: true}, sync: {percent: 1, currentBlock: 200, headerCount: 200, chain: 'mainnet'},
      stats: {difficulty: 12000, size: 10000, mempool: 0, mempoolTransactions: 0, connections: 1, networkhashps: 100},
      connections: {total: 1, outbound: 1, inbound: 0, clearnet: 1, tor: 0, i2p: 0},
      version: {version: '0.18.5.1'}, blocks: {blocks: Array.from({length: 24}, (_, i) => ({hash: i.toString(16).padStart(64, '0'), height: 199 - i, time: 1794000000 - 120 * i, numTransactions: 2}))}, mining: {active: true, speed: 125, threads: 2},
      'monero-config': settings,
      'update-monero-config': {success: true},
      'monero-rpc-connection-details': {rpcuser: 'user', rpcpassword: 'pass', port: '18081', restrictedPort: '18089', zmqPort: '18082', zmqPubPort: '18084', localAddress: 'localhost', torAddress: 'test.onion', torConnectionString: 'xmrrpc://test.onion:18081'},
      'monero-p2p-connection-details': {port: '18080', onionPort: '18083', localAddress: 'localhost', torAddress: 'test.onion', torConnectionString: 'test.onion:18083'},
    };
    return route.fulfill({json: responses[path] || []});
  });
  await page.goto('/');
  await expect(page.getByText('Running', {exact: true})).toBeVisible({timeout: 15000});
  await expect(page.locator('[data-testid="mining-status"]')).toContainText('125 H/s');
  await expect(page.locator('.highcharts-root')).toBeVisible();
  await expect(page.locator('.logo')).toHaveCount(0);
  await expect(page.locator('.card-custom-loading-bar')).toHaveCount(0);
  await expect(page.getByRole('heading', {name: '100.00', exact: true})).toBeVisible();
  await page.screenshot({path: '/tmp/monero-dashboard-review.png', fullPage: true});
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
  await page.locator('#i2p').getByRole('switch').click();
  await page.locator('#tor-only').click();
  await expect(page.locator('#i2p').getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await page.locator('#zmq').click();
  const saved = page.waitForRequest(request => request.url().endsWith('/update-monero-config'));
  await page.getByRole('button', {name: 'Save and Restart Monero Node'}).click();
  const payload = (await saved).postDataJSON().moneroConfig;
  expect(payload.network).toBe('testnet');
  expect(payload.torOnly).toBe(true);
  expect(payload.zmq).toBe(true);
  expect(errors).toEqual([]);
});
