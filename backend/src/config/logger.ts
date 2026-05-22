import winston from 'winston';
import { env } from './env.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const developmentFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, requestId, stack, ...metadata }) => {
    let log = `[${ts as string}] ${level}: ${message as string}`;
    if (requestId) {
      log = `[${ts as string}] [${requestId as string}] ${level}: ${message as string}`;
    }
    if (stack) {
      log += `\n${stack as string}`;
    }
    if (Object.keys(metadata).length > 0) {
      log += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    return log;
  })
);

const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  defaultMeta: { service: 'neurofic-api' },
  transports: [
    new winston.transports.Console({
      silent: env.NODE_ENV === 'test',
    }),
  ],
});

export function createRequestLogger(requestId: string): winston.Logger {
  return logger.child({ requestId });
}
