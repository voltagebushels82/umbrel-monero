/* eslint-disable id-length */
module.exports = {
  REQUEST_CORRELATION_NAMESPACE_KEY: 'umbrel-manager-request',
  REQUEST_CORRELATION_ID_KEY: 'reqId',
  DEVICE_HOSTNAME: process.env.DEVICE_HOSTNAME || 'umbrel.local',
  MONERO_P2P_HIDDEN_SERVICE: process.env.MONERO_P2P_HIDDEN_SERVICE,
  MONERO_RPC_HIDDEN_SERVICE: process.env.MONERO_RPC_HIDDEN_SERVICE,
  MONERO_RPC_USER: process.env.MONERO_RPC_USER || 'monero',
  MONERO_RPC_PASSWORD: process.env.MONERO_RPC_PASSWORD || 'monero',
  DEVICE_DOMAIN_NAME: process.env.DEVICE_DOMAIN_NAME,
  JSON_STORE_FILE: process.env.JSON_STORE_FILE || "/data/MONERO-config.json",
  UMBREL_MONERO_CONF_FILEPATH: process.env.UMBREL_MONERO_CONF_FILE || "/monero/.monero/umbrel-monero.conf",
  MONERO_CONF_FILEPATH: process.env.MONERO_CONF_FILE || "/monero/.monero/monero.conf",
  MONERO_INITIALIZE_WITH_CLEARNET_OVER_TOR: process.env.MONERO_INITIALIZE_WITH_CLEARNET_OVER_TOR === 'true',
  MONERO_P2P_PORT: process.env.MONERO_P2P_PORT || "18080",
  MONERO_RPC_PORT: process.env.MONERO_RPC_PORT || "18081",
  MONERO_DEFAULT_NETWORK: process.env.MONERO_DEFAULT_NETWORK || "mainnet",
  MONEROD_IP: process.env.MONEROD_IP,
  TOR_PROXY_IP: process.env.TOR_PROXY_IP,
  TOR_PROXY_PORT: process.env.TOR_PROXY_PORT,
  TOR_PROXY_CONTROL_PORT: process.env.TOR_PROXY_CONTROL_PORT,
  TOR_PROXY_CONTROL_PASSWORD: process.env.TOR_PROXY_CONTROL_PASSWORD,
  I2P_DAEMON_IP: process.env.I2P_DAEMON_IP,
  I2P_DAEMON_PORT: process.env.I2P_DAEMON_PORT,
  CACHE_LIMIT: process.env.CACHE_LIMIT || 1100
};