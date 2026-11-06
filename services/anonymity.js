import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

// I2P private-key files begin with the public Destination: 256-byte encryption
// key, 128-byte signing key, and a certificate (type + uint16 length + payload).
export function i2pAddressFromKeys(keys) {
  if (keys.length < 387) throw new Error('Incomplete I2P destination key');
  const destinationLength = 387 + keys.readUInt16BE(385);
  if (keys.length < destinationLength) throw new Error('Incomplete I2P destination certificate');
  const hash = createHash('sha256').update(keys.subarray(0, destinationLength)).digest();
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let value = 0, bits = 0, encoded = '';
  for (const byte of hash) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; encoded += alphabet[(value >>> bits) & 31]; }
  }
  if (bits) encoded += alphabet[(value << (5 - bits)) & 31];
  return `${encoded}.b32.i2p`;
}

export async function loadAnonymityAddresses(env = process.env) {
  if (env.TOR_HIDDEN_SERVICE_DIR) {
    for (const [variable, name] of [['MONERO_P2P_HIDDEN_SERVICE', 'p2p'], ['MONERO_RPC_HIDDEN_SERVICE', 'rpc']]) {
      const hostname = (await readFile(path.join(env.TOR_HIDDEN_SERVICE_DIR, `app-monero-${name}`, 'hostname'), 'utf8')).trim();
      if (!/^[a-z2-7]{56}\.onion$/.test(hostname)) throw new Error('Invalid generated Tor hostname');
      env[variable] = hostname;
    }
  }
  if (env.I2P_P2P_KEY_FILE) env.MONERO_I2P_HIDDEN_SERVICE = i2pAddressFromKeys(await readFile(env.I2P_P2P_KEY_FILE));
}
