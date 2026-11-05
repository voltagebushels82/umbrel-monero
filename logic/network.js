import * as constants from '../utils/const.js';
export async function getMonerodAddresses() {
  return [constants.DEVICE_DOMAIN_NAME, constants.MONERO_P2P_HIDDEN_SERVICE].filter(Boolean);
}
