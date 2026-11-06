import {test, expect} from '@playwright/test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import net from 'node:net';

const exec = promisify(execFile);
const system = '/v1/monerod/system';
const info = '/v1/monerod/info';
const project = process.env.E2E_COMPOSE_PROJECT || 'codex-monero-e2e';

async function docker(...args) {
  const command = process.env.E2E_DOCKER_SUDO === '1' ? 'sudo' : 'docker';
  const prefix = command === 'sudo' ? ['-n', '--preserve-env=MONERO_RESTRICTED_RPC_USER,MONERO_RESTRICTED_RPC_PASSWORD', 'docker'] : [];
  return exec(command, [...prefix, ...args], {timeout: 120000});
}
async function native(method, params = {}, restricted = false) {
  const url = restricted ? 'http://127.0.0.1:18090' : 'http://127.0.0.1:18081';
  const credentials = restricted ? 'wallet:local-e2e-wallet-only' : 'monero:monero';
  const {stdout} = await exec('curl', ['--silent', '--show-error', '--max-time', '10', '--digest', '-u', credentials,
    '-H', 'Content-Type: application/json', '--data', JSON.stringify({jsonrpc: '2.0', id: 'e2e', method, params}), `${url}/json_rpc`]);
  return JSON.parse(stdout);
}
async function read(request, path) {
  const response = await request.get(path);
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  return response.json();
}
async function ready(request, network) {
  await expect.poll(async () => {
    try {
      const status = await read(request, `${info}/status`);
      if (!status.operational) return '';
      return (await native('get_info')).result?.nettype;
    } catch { return ''; }
  }, {timeout: 180000, intervals: [1000, 2000, 5000]}).toBe(network);
}
async function settings(page) {
  await page.locator('.dropdown-toggle').first().click();
  await page.getByText('Advanced Settings', {exact: false}).first().click();
  await expect(page.getByRole('heading', {name: 'Advanced Settings'})).toBeVisible();
}
async function save(page) {
  const response = page.waitForResponse(r => r.url().endsWith('/update-monero-config') && r.request().method() === 'POST');
  await page.getByRole('button', {name: 'Save and Restart Monero Node'}).click();
  const result = await response;
  expect(result.status()).toBe(200);
  await page.waitForURL(/restart=1/);
}
async function closeDialog(page) {
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await expect(page.locator('.modal:visible')).toHaveCount(0);
}
async function portOpen(port) {
  return new Promise(resolve => {
    const socket = net.connect({host: '127.0.0.1', port});
    socket.setTimeout(2000);
    socket.once('connect', () => {socket.destroy(); resolve(true);});
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {socket.destroy(); resolve(false);});
  });
}

test('production dashboard renders and real settings survive restarts', async ({page, request}, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'warning' && message.text().includes('[Vue warn]')) errors.push(message.text());});
  await ready(request, 'mainnet');
  await page.goto('/');
  await expect(page.getByText('Running', {exact: true})).toBeVisible();
  await expect(page.locator('[data-testid="mining-status"]')).toContainText('Inactive');
  await expect(page.getByText('Network (mainnet)', {exact: true})).toBeVisible();
  await expect(page.locator('.logo')).toHaveCount(0);
  const daemonInfo = (await native('get_info')).result;
  const sync = await read(request, `${info}/sync`);
  if (!daemonInfo.synchronized) {
    expect(sync.percent).toBeLessThan(1);
    await expect(page.getByText('Synchronizing', {exact: true})).toBeVisible();
  }
  await page.screenshot({path: testInfo.outputPath('dashboard-desktop.png'), fullPage: true, animations: 'disabled'});

  // Seed the backend block cache before changing chains.
  const mainnetGenesis = (await read(request, `${info}/blocks?from=0&to=1`)).blocks[0].hash;
  expect(mainnetGenesis).toBe((await native('on_get_block_hash', [0])).result);
  await page.getByRole('button', {name: 'Connect', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', {name: 'Connect to Monero Node'})).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'OK', exact: true})).toHaveCount(0);
  const connectionDetails = await read(request, `${system}/monero-rpc-connection-details`);
  await expect(dialog.locator('select')).toHaveValue(connectionDetails.torAddress ? 'rpcTor' : 'rpcLocal');
  await dialog.locator('select').selectOption('rpcRestricted');
  await expect(dialog.locator('input').filter({visible: true}).nth(0)).toHaveValue('wallet');
  await expect(dialog.locator('input').filter({visible: true}).nth(1)).toHaveValue('local-e2e-wallet-only');
  await page.screenshot({path: testInfo.outputPath('restricted-connection.png'), fullPage: true, animations: 'disabled'});
  await closeDialog(page);

  await settings(page);
  await expect(page.getByRole('dialog').getByRole('button', {name: 'OK', exact: true})).toHaveCount(0);
  await page.locator('#mining').click();
  await page.locator('#moneroAddress').fill('invalid-address');
  await page.getByRole('button', {name: 'Save and Restart Monero Node'}).click();
  await expect(page.getByText('Please enter a valid Monero address.', {exact: true})).toBeVisible();
  expect((await read(request, `${system}/monero-config`)).mining).toBe(false);
  await page.locator('#mining').click();
  await page.locator('#network').selectOption('testnet');
  await page.locator('#zmq').click();
  await page.locator('#allow-incoming-connections').click();
  await expect(page.locator('#allow-incoming-connections').getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#network').scrollIntoViewIfNeeded();
  await page.screenshot({path: testInfo.outputPath('settings-testnet.png'), fullPage: true, animations: 'disabled'});
  await save(page);
  await ready(request, 'testnet');
  await expect(page.getByText('Running', {exact: true})).toBeVisible();
  await expect(page.getByText('Network (testnet)', {exact: true})).toBeVisible();
  const stored = await read(request, `${system}/monero-config`);
  expect(stored).toMatchObject({network: 'testnet', zmq: true, incomingConnections: true, mining: false});
  const daemonConfig = await docker('exec', `${project}-monerod-1`, 'cat', '/home/monero/.bitmonero/bitmonero.conf');
  expect(daemonConfig.stdout).toMatch(/^testnet=1$/m);
  for (const port of [18082, 18084]) expect(await portOpen(port), `ZMQ port ${port}`).toBe(true);
  const testnetGenesis = (await native('on_get_block_hash', [0])).result;
  expect(testnetGenesis).not.toBe(mainnetGenesis);
  expect((await read(request, `${info}/blocks?from=0&to=1`)).blocks[0].hash).toBe(testnetGenesis);
  expect((await native('get_info', {}, true)).result.nettype).toBe('testnet');

  // Recreate both services while retaining their named volumes.
  await docker('compose', '-p', project, '-f', 'docker-compose.yml', '-f', 'docker-compose-prod.yml', '-f', 'docker-compose.browser.yml', 'up', '-d', '--force-recreate');
  await ready(request, 'testnet');
  await page.goto('/');
  await expect(page.getByText('Running', {exact: true})).toBeVisible();
  await settings(page);
  await expect(page.locator('#network')).toHaveValue('testnet');
  await expect(page.locator('#zmq').getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await closeDialog(page);
  await page.setViewportSize({width: 390, height: 844});
  await expect(page.getByRole('button', {name: 'Connect', exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path: testInfo.outputPath('dashboard-mobile.png'), fullPage: true, animations: 'disabled'});

  // Open and operate the modal on a phone-sized viewport as well.
  await settings(page);
  await page.locator('#network').scrollIntoViewIfNeeded();
  await expect(page.locator('#network')).toHaveValue('testnet');
  await page.screenshot({path: testInfo.outputPath('settings-mobile.png'), fullPage: true, animations: 'disabled'});
  await closeDialog(page);
  await docker('compose', '-p', project, 'stop', 'monerod');
  await expect.poll(async () => (await read(request, `${info}/status`)).operational).toBe(false);
  await expect(page.getByText('Starting', {exact: true})).toBeVisible();
  expect((await request.get('/ping')).ok()).toBe(true);
  await page.screenshot({path: testInfo.outputPath('daemon-unavailable.png'), fullPage: true, animations: 'disabled'});
  await docker('compose', '-p', project, 'start', 'monerod');
  await ready(request, 'testnet');
  await expect(page.getByText('Running', {exact: true})).toBeVisible();
  await settings(page);
  page.once('dialog', dialog => dialog.accept());
  const restored = page.waitForResponse(r => r.url().endsWith('/restore-default-monero-config'));
  await page.getByRole('button', {name: 'Restore Default Settings'}).click();
  expect((await restored).status()).toBe(200);
  await ready(request, 'mainnet');
  expect(await read(request, `${system}/monero-config`)).toMatchObject({network: 'mainnet', zmq: false, incomingConnections: false});
  await expect(page.getByText('Network (mainnet)', {exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});
