/**
 * Structured frontend logger.
 * - In production only 'warn' and 'error' are emitted.
 * - In development all levels are emitted.
 * - Output is structured JSON written to console.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  timestamp: string
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL: LogLevel = (import.meta as any).env?.PROD ? 'warn' : 'debug'

const CONSOLE_FN: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) return

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context !== undefined && { context }),
  }

  CONSOLE_FN[level](JSON.stringify(entry))
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
}

export default logger
