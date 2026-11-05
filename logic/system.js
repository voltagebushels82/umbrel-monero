import * as constants from '../utils/const.js';
// import * as NodeError from '../models/errors.js';

export function getMoneroP2PConnectionDetails() {
  const torAddress = constants.MONERO_P2P_HIDDEN_SERVICE;
  const port = constants.MONERO_P2P_PORT;
  // const restrictedPort = constants.MONERO_RESTRICTED_RPC_PORT;
  const onionPort = constants.MONERO_ONION_P2P_PORT;
  const torConnectionString = `${torAddress}:${onionPort}`;
  const localAddress = constants.DEVICE_DOMAIN_NAME;
  const localConnectionString = `${localAddress}:${port}`;

  return {
    torAddress,
    port,
    onionPort,
    torConnectionString,
    localAddress,
    localConnectionString,
  };
}

export function getMoneroRPCConnectionDetails() {
  const hiddenService = constants.MONERO_RPC_HIDDEN_SERVICE;
  const label = 'My Umbrel';
  const rpcuser = constants.MONERO_RPC_USER;
  const rpcpassword = constants.MONERO_RPC_PASSWORD;
  const torAddress = hiddenService;
  const port = constants.MONERO_RPC_PORT;
  const separateCredentials = Boolean(process.env.MONERO_RESTRICTED_RPC_PASSWORD);
  const restrictedPort = separateCredentials ? (process.env.MONERO_RESTRICTED_GATEWAY_PORT || '18090') : constants.MONERO_RESTRICTED_RPC_PORT;
  const restrictedRpcuser = separateCredentials ? (process.env.MONERO_RESTRICTED_RPC_USER || 'monero') : rpcuser;
  const restrictedRpcpassword = separateCredentials ? process.env.MONERO_RESTRICTED_RPC_PASSWORD : rpcpassword;
  const torConnectionString = `xmrrpc://${encodeURIComponent(rpcuser || "")}:${encodeURIComponent(rpcpassword || "")}@${torAddress}:${port}?label=${encodeURIComponent(label)}`;
  const localAddress = constants.DEVICE_DOMAIN_NAME;
  const localConnectionString = `xmrrpc://${encodeURIComponent(rpcuser || "")}:${encodeURIComponent(rpcpassword || "")}@${localAddress}:${port}?label=${encodeURIComponent(label)}`;
  const restrictedConnectionString = `xmrrpc://${encodeURIComponent(restrictedRpcuser || "")}:${encodeURIComponent(restrictedRpcpassword || "")}@${localAddress}:${restrictedPort}?label=${encodeURIComponent(label)}`;

  return {
    rpcuser,
    rpcpassword,
    restrictedRpcuser,
    restrictedRpcpassword,
    torAddress,
    port,
    restrictedPort,
    zmqPort: constants.MONERO_ZMQ_PORT,
    zmqPubPort: constants.MONERO_ZMQ_PUB_PORT,
    torConnectionString,
    localAddress,
    localConnectionString,
    restrictedConnectionString,
  };
}