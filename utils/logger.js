/* eslint-disable no-shadow, no-unused-vars, max-len, no-console, object-shorthand*/

import 'winston-daily-rotate-file';
import * as constants from './const.js';
import fs from 'fs';
import path from 'path';
import winston, { format } from 'winston';
import { getNamespace } from 'continuation-local-storage';

const {combine, timestamp, printf} = format;


const LOCAL = 'local';
const logDir = './logs';
const ENV = process.env.ENV;

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const appendCorrelationId = format((info, opts) => {
  const apiRequest = getNamespace(constants.REQUEST_CORRELATION_NAMESPACE_KEY);
  if (apiRequest) {
    info.internalCorrelationId = apiRequest.get(constants.REQUEST_CORRELATION_ID_KEY);
  }

  return info;
});

const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '10m',
  maxFiles: '7d',
});

const apiFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, 'api-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '7d',
});

const localLogFormat = printf((info) => {
  let data = '';
  if (info.data) {
    data = JSON.stringify({data: info.data});
  }

  return `${info.timestamp} ${info.level.toUpperCase()}: ${info.internalCorrelationId} [${info._module}] ${info.message} ${data}`;
});

const localLoggerTransports = [
  errorFileTransport,
  apiFileTransport,
];

if (ENV === 'dev') {
  localLoggerTransports.push(new winston.transports.Console());
}

winston.loggers.add(LOCAL, {
  level: 'info',
  format: combine(
      timestamp(),
      appendCorrelationId(),
      localLogFormat
  ),
  transports: localLoggerTransports,
});

const morganConfiguration = {
  stream: {
    write: function(message) {
      info(message, 'umbrel-middleware');
    },
  },
};

const localLogger = winston.loggers.get(LOCAL);

function printToStandardOut(data) {
  if (data) {
    console.log(data);
  }
}

function error(message, _module, data) {
  printToStandardOut(message);
  printToStandardOut(_module);
  printToStandardOut(data);
  localLogger.error(message, {
    _module: _module,
    data: data,
  });
}

function warn(message, _module, data) {
  printToStandardOut(message);
  printToStandardOut(_module);
  printToStandardOut(data);
  localLogger.warn(message, {
    _module: _module,
    data: data,
  });
}

function info(message, _module, data) {
  printToStandardOut(message);
  printToStandardOut(_module);
  printToStandardOut(data);
  localLogger.info(message, {
    _module: _module,
    data: data,
  });
}

function debug(message, _module, data) {
  printToStandardOut(message);
  printToStandardOut(_module);
  printToStandardOut(data);
  localLogger.debug(message, {
    _module: _module,
    data: data,
  });
}

export default {
  error,
  warn,
  info,
  debug,
  morganConfiguration,
};