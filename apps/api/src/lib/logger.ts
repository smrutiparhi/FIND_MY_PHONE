import pino from 'pino';
import { env } from '../config/env';

/**
 * Central logger for the whole API. Redact paths cover today's known
 * sensitive fields (auth headers, cookies); Part 20 (Security hardening)
 * extends this list as IMEI, precise-location, and financial fields land.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
    ],
    remove: true,
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        }
      : undefined,
});
