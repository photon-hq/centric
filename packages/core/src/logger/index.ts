/**
 * Structured Logging System
 * Consistent, level-based logging across all packages
 */

import pino, { type Logger as PinoLogger } from 'pino'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LoggerOptions {
  level?: LogLevel
  pretty?: boolean
  name?: string
}

/**
 * Create a logger instance
 */
export function createLogger(options: LoggerOptions = {}): PinoLogger {
  const {
    level = (process.env.LOG_LEVEL as LogLevel) || 'info',
    pretty = process.env.NODE_ENV !== 'production',
    name = 'photon-agent'
  } = options

  return pino({
    name,
    level,
    transport: pretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined,
    formatters: {
      level: (label: string) => ({ level: label })
    }
  })
}

// Default logger instance
export const logger = createLogger()

// Export pino types for convenience
export type Logger = PinoLogger
