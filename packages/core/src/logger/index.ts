/**
 * Structured Logging System
 * Consistent, level-based logging across all packages
 */

import pino, { type Logger as PinoLogger } from 'pino'
import pinoPretty from 'pino-pretty'

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

  const baseOptions = {
    name,
    level,
    formatters: {
      level: (label: string) => ({ level: label })
    }
  }

  if (!pretty) {
    return pino(baseOptions)
  }

  try {
    // Use in-process pretty printing to avoid pino's worker transport crashes
    // in bundled runtimes like Next.js route handlers.
    const prettyStream = pinoPretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    })
    return pino(baseOptions, prettyStream)
  } catch (error) {
    console.warn('[photon-agent] Failed to enable pretty logging, using plain JSON logs:', error)
    return pino(baseOptions)
  }
}

// Default logger instance
export const logger = createLogger()

// Export pino types for convenience
export type Logger = PinoLogger
