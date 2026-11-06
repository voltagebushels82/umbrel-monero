import express from 'express';
import * as systemLogic from '../../../logic/system.js';
import * as diskLogic from '../../../logic/disk.js';
import * as monerodLogic from '../../../logic/monerod.js';
import * as safeHandler from '../../../utils/safeHandler.js';

import { isValidAddress } from '../../../build/services/monerod.js';
const router = express.Router();
router.post('/validate-address', safeHandler.safeHandler(async (req, res) => {
  const {address, network} = req.body || {};
  const valid = typeof address === 'string' && address.length <= 106 && await isValidAddress(address, network);
  res.json({valid});
}));

router.get('/monero-p2p-connection-details', safeHandler.safeHandler(async (req, res) => {
  const connectionDetails = systemLogic.getMoneroP2PConnectionDetails();

  return res.json(connectionDetails);
}));

router.get('/monero-rpc-connection-details', safeHandler.safeHandler(async (req, res) => {
  const connectionDetails = systemLogic.getMoneroRPCConnectionDetails();

  return res.json(connectionDetails);
}));

router.get('/monero-config', safeHandler.safeHandler(async (req, res) => {
  const moneroConfig = await diskLogic.getJsonStore();
  return res.json(moneroConfig);
}));

// Serialize the entire save/restart/rollback transaction, not just individual file writes.
let pendingUpdate = Promise.resolve();
function updateConfiguration(apply) {
  const operation = pendingUpdate.then(async () => {
    const previous = await diskLogic.getJsonStore();
    try {
      await apply();
      if ((await monerodLogic.getStatus()).operational) await monerodLogic.stop();
    } catch (error) {
      await diskLogic.applyCustomMoneroConfig(previous, true);
      throw error;
    }
  });
  pendingUpdate = operation.catch(() => {});
  return operation;
}
router.post('/update-monero-config', safeHandler.safeHandler(async (req, res) => {
  await updateConfiguration(() => diskLogic.applyCustomMoneroConfig(req.body?.moneroConfig, true));
  res.json({success: true});
}));
router.post('/restore-default-monero-config', safeHandler.safeHandler(async (req, res) => {
  await updateConfiguration(() => diskLogic.applyDefaultMoneroConfig());
  res.json({success: true});
}));
export default router;
