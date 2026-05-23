"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_js_1 = require("../config/logger.js");
const env_js_1 = require("../config/env.js");
/**
 * Global Fastify error handler.
 * - Never exposes stack traces in production.
 * - Normalises all errors to a consistent JSON shape.
 */
function errorHandler(error, request, reply) {
    const appError = error;
    // Determine HTTP status
    const statusCode = typeof appError.statusCode === 'number' && appError.statusCode >= 100
        ? appError.statusCode
        : (error.statusCode ?? 500);
    // Log with appropriate level
    if (statusCode >= 500) {
        logger_js_1.logger.error('Unhandled server error', {
            requestId: request.id,
            method: request.method,
            url: request.url,
            statusCode,
            error: appError.message,
            // Stack only in non-production logs
            ...(env_js_1.env.NODE_ENV !== 'production' && { stack: appError.stack }),
        });
    }
    else {
        logger_js_1.logger.warn('Client error', {
            requestId: request.id,
            method: request.method,
            url: request.url,
            statusCode,
            error: appError.message,
        });
    }
    // Build safe response — never include stack in production
    const response = {
        error: getErrorTitle(statusCode),
        message: getSafeMessage(appError, statusCode),
        statusCode,
        requestId: request.id,
    };
    if (env_js_1.env.NODE_ENV !== 'production' && appError.stack) {
        response.stack = appError.stack;
    }
    void reply.status(statusCode).send(response);
}
function getErrorTitle(statusCode) {
    const titles = {
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
function getSafeMessage(error, statusCode) {
    // For client errors (4xx), expose the actual message
    if (statusCode >= 400 && statusCode < 500) {
        return error.message;
    }
    // For server errors in production, hide internal details
    if (env_js_1.env.NODE_ENV === 'production') {
        return 'An unexpected error occurred. Please try again later.';
    }
    return error.message;
}
//# sourceMappingURL=error.middleware.js.map