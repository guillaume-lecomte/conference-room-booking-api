import pino from 'pino';
import { config } from '../../config';

/**
 * Structured Logger using Pino
 * Provides JSON logging for production and pretty printing for development
 */
export const logger = pino({
  level: config.logging.level,
  transport: config.env === 'development' 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    env: config.env,
  },
});

export type Logger = typeof logger;
