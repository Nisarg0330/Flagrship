import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './lib/db';
import { ApiError } from './lib/errors';
import { authenticate } from './middleware/auth';
import { flagRoutes } from './routes/flags';
import { keyRoutes } from './routes/keys';

export function buildServer(): FastifyInstance {
  const app = Fastify({
    // Pino ships inside Fastify - there is no separate logger to configure.
    logger: process.env.NODE_ENV === 'test' ? false : true,
    // TRD §11.2 wants a UUIDv4 per request, echoed in every error body so a user
    // can quote it. Fastify's default is a per-process counter, which collides
    // across instances.
    genReqId: () => randomUUID(),
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ApiError) {
      return reply.code(err.status).send({
        error: {
          code: err.code,
          message: err.message,
          ...(err.field ? { field: err.field } : {}),
          request_id: req.id,
        },
      });
    }

    // Fastify raises its own 4xx for malformed JSON, oversized payloads and the
    // like. Those messages are safe to pass through; anything 5xx is not.
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, 'unhandled error');

    return reply.code(status).send({
      error: {
        code: status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR',
        message: status >= 500 ? 'Something went wrong on our end.' : err.message,
        request_id: req.id,
      },
    });
  });

  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `No route for ${req.method} ${req.url}.`,
        request_id: req.id,
      },
    }),
  );

  app.register(cors, { origin: false });

  // Public: the load balancer health check cannot carry an API key.
  app.get('/health', async () => {
    // A real query against a real table, so a broken connection or a missing
    // migration both surface here. Not $queryRaw - the codebase has no raw SQL.
    await prisma.organization.count();
    return { status: 'ok', uptime: process.uptime() };
  });

  // Everything under /api/v1 is authenticated. Registering the hook inside this
  // plugin scope is what keeps /health public - Fastify encapsulation, not an
  // exclusion list that someone forgets to update.
  app.register(
    async (api) => {
      api.addHook('onRequest', authenticate);
      await api.register(flagRoutes);
      await api.register(keyRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}

async function start() {
  const app = buildServer();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      app.log.info(`${signal} received, shutting down`);
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error({ err }, 'failed to start');
    process.exit(1);
  }
}

if (require.main === module) void start();
