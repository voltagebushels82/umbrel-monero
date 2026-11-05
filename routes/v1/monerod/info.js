import express from 'express';
import * as monerod from '../../../logic/monerod.js';
import * as safeHandler from '../../../utils/safeHandler.js';

import { getMiningStatus } from '../../../build/services/monerod.js';
const router = express.Router();
router.get('/mining', safeHandler.safeHandler(async (req, res) => res.json(await getMiningStatus())));

router.get('/connections', safeHandler.safeHandler((req, res) =>
  monerod.getConnectionsCount()
      .then((connections) => res.json(connections)),
));

router.get('/status', safeHandler.safeHandler((req, res) =>
  monerod.getStatus()
      .then((status) => res.json(status)),
));

router.get('/sync', safeHandler.safeHandler((req, res) =>
  monerod.getSyncStatus()
      .then((status) => res.json(status)),
));

router.get('/version', safeHandler.safeHandler((req, res) =>
  monerod.getVersion()
      .then((version) => res.json(version)),
));

router.get('/stats', safeHandler.safeHandler((req, res) =>
  monerod.nodeStatusSummary()
      .then((statussumarry) => res.json(statussumarry)),
));

router.get('/block', safeHandler.safeHandler(async (req, res) => {
  if (typeof req.query.hash === 'string' && /^[a-fA-F0-9]{64}$/.test(req.query.hash)) return res.json(await monerod.getBlock(req.query.hash));
  if (typeof req.query.height === 'string' && /^\d+$/.test(req.query.height) && Number.isSafeInteger(Number(req.query.height))) return res.json(await monerod.getBlockHash(Number(req.query.height)));
  return res.status(400).json('Provide a valid block hash or height');
}));

// /v1/monerod/info/block/<hash>
router.get('/block/:id', safeHandler.safeHandler((req, res) =>
  monerod.getBlock(req.params.id)
      .then((blockhash) => res.json(blockhash)),
));

router.get('/blocks', safeHandler.safeHandler(async (req, res) => {
  const fromHeight = Number(req.query.from);
  const toHeight = Number(req.query.to);

  if (!Number.isSafeInteger(fromHeight) || !Number.isSafeInteger(toHeight) || fromHeight < 0 || toHeight < fromHeight || toHeight - fromHeight > 500) {
    res.status(400).json('Provide nonnegative integer heights spanning at most 500 blocks');
    return;
  }

  return res.json(await monerod.getBlocks(fromHeight, toHeight));
},
));

export default router;