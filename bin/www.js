#!/usr/bin/env node
import { startRestrictedRpcGateway } from '../services/restrictedRpc.js';

/**
 * Module dependencies.
 */

import * as app from '../app.js';
import debug from 'debug';
import http from 'http';

import * as diskLogic from '../logic/disk.js';
import * as diskService from '../services/disk.js';
import * as monerodLogic from '../logic/monerod.js';
import * as constants from '../utils/const.js';

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '8889');
app.default.set('port', port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app.default);
startRestrictedRpcGateway();

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Function to create default monero config files if they do not already exist.
 */

async function createConfFilesAndRestartMonerod() {
  console.log('bitmonero.conf does not exist, creating config files with DEFAULT values!');

  try{
    const wasRunning = (await monerodLogic.getStatus()).operational;
    const config = await diskLogic.getJsonStore();
    await diskLogic.applyCustomMoneroConfig(config, true);
    // A daemon waiting for this new file will start with the right settings.
    // Only restart an existing daemon that was running before the file existed.
    if (wasRunning) await monerodLogic.stop();
  } catch (error) {
    console.log(error);
    return;
  }

  //Verify config file was created successfully and matches the default values
  if (! await diskService.fileExists(constants.MONERO_CONF_FILEPATH)) {
    console.log('Failed to create bitmonero.conf');
    return;
  } else {
    console.log('bitmonero.conf now exists');
  }
  
}

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ?
    'Pipe ' + port :
    'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

async function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ?
    'pipe ' + addr :
    'port ' + addr.port;
  debug('Listening on ' + bind);
  console.log('Listening on ' + bind);


  try {
    if (await diskLogic.repairLegacyConfig()) {
      console.log('Repaired legacy Monero network/bind configuration');
      if ((await monerodLogic.getStatus()).operational) await monerodLogic.stop();
    }
  } catch (error) {
    console.error('Unable to repair legacy configuration:', error.message);
  }

  // if bitmonero.conf does not exist, create default monero config files and restart monerod.
  if (! await diskService.fileExists(constants.MONERO_CONF_FILEPATH)) {
    createConfFilesAndRestartMonerod();
  }
}
