import type { AuthContext } from '../middleware/auth';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the `authenticate` hook. Present on every route under /api/v1. */
    auth: AuthContext;
  }
}
