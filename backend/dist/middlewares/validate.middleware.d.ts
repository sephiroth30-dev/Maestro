import type { FastifyRequest, FastifyReply } from 'fastify';
import { z, type ZodSchema } from 'zod';
type RequestPart = 'body' | 'params' | 'query';
/**
 * Creates a Fastify preHandler that validates a specific part of the request
 * against a Zod schema. On failure it sends a 400 with field-level details.
 */
export declare function validateRequest<T>(schema: ZodSchema<T>, part?: RequestPart): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
/**
 * Parses and validates a Zod schema, throwing a structured 400 error on
 * failure. Useful inside route handlers when you need the typed result.
 */
export declare function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown, reply: FastifyReply): T | null;
export { z };
//# sourceMappingURL=validate.middleware.d.ts.map