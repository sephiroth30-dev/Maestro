import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Global Fastify error handler.
 * - Never exposes stack traces in production.
 * - Normalises all errors to a consistent JSON shape.
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const appError = error as AppError;

  // Determine HTTP status
  const statusCode =
    typeof appError.statusCode === 'number' && appError.statusCode >= 100
      ? appError.statusCode
      : (error.statusCode ?? 500);

  // Log with appropriate level
  if (statusCode >= 500) {
    logger.error('Unhandled server error', {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode,
      error: appError.message,
      // Stack only in non-production logs
      ...(env.NODE_ENV !== 'production' && { stack: appError.stack }),
    });
  } else {
    logger.warn('Client error', {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode,
      error: appError.message,
    });
  }

  // Build safe response — never include stack in production
  const response: {
    error: string;
    message: string;
    statusCode: number;
    requestId: string;
    stack?: string;
  } = {
    error: getErrorTitle(statusCode),
    message: getSafeMessage(appError, statusCode),
    statusCode,
    requestId: request.id,
  };

  if (env.NODE_ENV !== 'production' && appError.stack) {
    response.stack = appError.stack;
  }

  void reply.status(statusCode).send(response);
}

function getErrorTitle(statusCode: number): string {
  const titles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return titles[statusCode] ?? 'Error';
}

function getSafeMessage(error: AppError, statusCode: number): string {
  // For client errors (4xx), expose the actual message
  if (statusCode >= 400 && statusCode < 500) {
    return error.message;
  }

  // For server errors in production, hide internal details
  if (env.NODE_ENV === 'production') {
    return 'An unexpected error occurred. Please try again later.';
  }

  return error.message;
}
