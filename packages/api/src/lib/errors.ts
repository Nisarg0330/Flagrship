import { z } from 'zod';

/**
 * Every error the API returns on purpose. The server's error handler turns these
 * into the TRD §4.4 envelope; anything else that reaches it becomes a 500 with
 * its message swallowed, so throw an ApiError whenever the client should be told
 * what they did wrong.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, field?: string) =>
  new ApiError(400, 'VALIDATION_ERROR', message, field);
export const unauthorized = (message: string) => new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message: string) => new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message: string) => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new ApiError(409, 'CONFLICT', message);

/**
 * Zod's own error shape is not the API's error shape. Parse through here so the
 * first failing field surfaces in `error.field`, which is what the CLI points at.
 */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue.path.join('.');
  throw badRequest(issue.message, path || undefined);
}
