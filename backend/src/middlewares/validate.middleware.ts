import type { FastifyRequest, FastifyReply } from 'fastify';
import { z, type ZodSchema } from 'zod';

type RequestPart = 'body' | 'params' | 'query';

/**
 * Creates a Fastify preHandler that validates a specific part of the request
 * against a Zod schema. On failure it sends a 400 with field-level details.
 */
export function validateRequest<T>(
  schema: ZodSchema<T>,
  part: RequestPart = 'body'
) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const data = request[part as keyof FastifyRequest];
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
export function parseOrThrow<T>(
  schema: ZodSchema<T>,
  data: unknown,
  reply: FastifyReply
): T | null {
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

// Re-export zod for convenience
export { z };
