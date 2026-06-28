/**
 * CivicPulse AI — Structured Logger
 * Simple timestamped console logger with log levels.
 * Never logs sensitive data (credentials, tokens, DB URIs).
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DEBUG';

const getTimestamp = (): string => new Date().toISOString();

const log = (level: LogLevel, module: string, message: string, meta?: Record<string, any>) => {
  const prefix = `[${getTimestamp()}] [${level}] [${module}]`;
  if (meta) {
    console.log(`${prefix} ${message}`, JSON.stringify(meta));
  } else {
    console.log(`${prefix} ${message}`);
  }
};

export const logger = {
  info: (module: string, message: string, meta?: Record<string, any>) =>
    log('INFO', module, message, meta),

  warn: (module: string, message: string, meta?: Record<string, any>) =>
    log('WARN', module, message, meta),

  error: (module: string, message: string, meta?: Record<string, any>) =>
    log('ERROR', module, message, meta),

  success: (module: string, message: string, meta?: Record<string, any>) =>
    log('SUCCESS', module, message, meta),

  debug: (module: string, message: string, meta?: Record<string, any>) => {
    if (process.env.NODE_ENV !== 'production') {
      log('DEBUG', module, message, meta);
    }
  }
};
