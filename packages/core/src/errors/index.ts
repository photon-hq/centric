/**
 * Unified Error System
 * Consistent error handling across all packages
 */

export type ErrorCode =
  | 'CONFIG_ERROR'
  | 'PRODUCT_ERROR'
  | 'AI_ERROR'
  | 'VECTOR_STORE_ERROR'
  | 'MCP_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'UNKNOWN_ERROR'

export interface ErrorContext {
  [key: string]: any
}

export class AgentError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly context?: ErrorContext,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'AgentError'
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack
    }
  }
}

// Convenience error constructors
export const ConfigError = (message: string, context?: ErrorContext, cause?: Error) =>
  new AgentError('CONFIG_ERROR', message, context, cause)

export const ProductError = (message: string, context?: ErrorContext, cause?: Error) =>
  new AgentError('PRODUCT_ERROR', message, context, cause)

export const AIError = (message: string, context?: ErrorContext, cause?: Error) =>
  new AgentError('AI_ERROR', message, context, cause)

export const VectorStoreError = (message: string, context?: ErrorContext, cause?: Error) =>
  new AgentError('VECTOR_STORE_ERROR', message, context, cause)

export const MCPError = (message: string, context?: ErrorContext, cause?: Error) =>
  new AgentError('MCP_ERROR', message, context, cause)

export const ValidationError = (message: string, context?: ErrorContext, cause?: Error) =>
  new AgentError('VALIDATION_ERROR', message, context, cause)

export const NotFoundError = (message: string, context?: ErrorContext, cause?: Error) =>
  new AgentError('NOT_FOUND', message, context, cause)

export const UnauthorizedError = (message: string, context?: ErrorContext, cause?: Error) =>
  new AgentError('UNAUTHORIZED', message, context, cause)

export const UnknownError = (message: string, context?: ErrorContext, cause?: Error) =>
  new AgentError('UNKNOWN_ERROR', message, context, cause)

/**
 * Helper to safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

/**
 * Helper to check if error is an AgentError
 */
export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError
}
