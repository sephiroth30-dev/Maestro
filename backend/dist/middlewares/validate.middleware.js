"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.z = void 0;
exports.validateRequest = validateRequest;
exports.parseOrThrow = parseOrThrow;
const zod_1 = require("zod");
Object.defineProperty(exports, "z", { enumerable: true, get: function () { return zod_1.z; } });
/**
 * Creates a Fastify preHandler that validates a specific part of the request
 * against a Zod schema. On failure it sends a 400 with field-level details.
 */
function validateRequest(schema, part = 'body') {
    return async function (request, reply) {
        const data = request[part];
        const result = schema.safeParse(data);
        if (!result.success) {
            const issues = result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            }));
            await reply.status(400).send({
                error: 'Validation Error',
                message: 'Request validation failed',
                statusCode: 400,
                details: issues,
            });
        }
    };
}
/**
 * Parses and validates a Zod schema, throwing a structured 400 error on
 * failure. Useful inside route handlers when you need the typed result.
 */
function parseOrThrow(schema, data, reply) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
        }));
        void reply.status(400).send({
            error: 'Validation Error',
            message: 'Request validation failed',
            statusCode: 400,
            details: issues,
        });
        return null;
    }
    return result.data;
}
//# sourceMappingURL=validate.middleware.js.map