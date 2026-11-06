#!/usr/bin/env node
import {loadAnonymityAddresses} from '../services/anonymity.js';

// Hidden-service identities must exist before www.js imports configuration constants.
for (let attempt = 0; ; attempt++) {
  try { await loadAnonymityAddresses(); break; }
  catch (error) {
    if (attempt >= 119) throw new Error('Tor/I2P identities were not ready within two minutes', {cause: error});
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
await import('./www.js');
