import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { prisma } from './lib/db';
import { ApiError, tooManyRequests } from './lib/errors';
import { authenticate } from './middleware/auth';
import { evaluateRoutes } from './routes/evaluate';
import { flagRoutes } from './routes/flags';
import { keyRoutes } from './routes/keys';

/**
 * Requests per minute per client IP. Generous: an SDK polls twice a minute and a
 * CLI command is one call, so this only bites abuse. It is not the defence
 * against key guessing - a key is 192 bits from randomBytes, so guessing is not
 * a threat any rate limit meaningfully changes. This limit exists to keep one
 * noisy or hostile client from consuming the instance.
 */
const rateLimitPerMinute = () => Number(process.env.RATE_LIMIT_PER_MINUTE ?? 600);

/**
 * How many proxy hops in front of this process, as a count - never `true`.
 *
 * Behind Render's proxy (and an ALB later) every socket comes from the proxy,
 * so with no setting at all `req.ip` is one shared value and the per-IP rate
 * limit buckets every customer together.
 *
 * But `true` means "trust every hop", which makes Fastify take the *left-most*
 * X-Forwarded-For entry - and Render appends to that header rather than
 * replacing it, so the left-most entry is whatever the client sent. That made
 * the rate limit bypassable by rotating one header. A count makes Fastify walk
 * in from the socket instead and land on the address the proxy itself observed,
 * which a client cannot forge.
 *
 * 0 (the default) means no proxy: trust the socket and ignore the header.
 *
 * Expressed as the predicate form rather than a bare count because Fastify's
 * types do not accept a number here, and a number that Fastify does not
 * understand silently falls back to trusting nothing - which looks identical
 * to working until you check which address was actually used.
 */
function trustProxy(): (address: string, hop: number) => boolean {
  const raw = Number(process.env.TRUST_PROXY ?? 0);
  const hops = Number.isInteger(raw) && raw >= 0 ? raw : 0;
  // `hop` counts inward from the socket, so this trusts exactly the first
  // `hops` addresses and stops at the first one a client could have written.
  return (_address, hop) => hop < hops;
}

/**
 * Async because plugins must finish registering before any route is declared:
 * a Fastify hook only applies to routes added after it, and a non-awaited
 * `register` is deferred until `ready()` - by which point every route already
 * exists and the hook silently applies to nothing.
 */
export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    // Pino ships inside Fastify - there is no separate logger to configure.
    logger: process.env.NODE_ENV === 'test' ? false : true,
    // TRD §11.2 wants a UUIDv4 per request, echoed in every error body so a user
    // can quote it. Fastify's default is a per-process counter, which collides
    // across instances.
    genReqId: () => randomUUID(),
    trustProxy: trustProxy(),
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

  // Fastify's default JSON parser rejects an empty body when Content-Type is
  // application/json. Most HTTP clients send that header on every POST whether
  // or not there is a body, so `POST /flags/:key/enable` would 400 for them.
  // Treat empty as "no body" - the routes that need one validate with Zod.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (body === '' || body === undefined) return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      e.statusCode = 400;
      done(e, undefined);
    }
  });

  await app.register(cors, { origin: false });

  // In-memory store, which is per-instance. Correct while there is one instance;
  // ponytail: move to the Redis store when there are two, or a client gets N
  // times the limit.
  await app.register(rateLimit, {
    global: false,
    max: rateLimitPerMinute(),
    timeWindow: '1 minute',
    // Never key on the API key itself: an attacker rotating keys would get a
    // fresh bucket per guess. The IP is the thing that cannot be rotated for free.
    keyGenerator: (req) => req.ip,
    // The plugin *throws* what this returns, so it has to be something the
    // error handler above understands - a bare object arrives with no status
    // and becomes a 500.
    errorResponseBuilder: (_req, ctx) =>
      tooManyRequests(`Too many requests. Try again in ${Math.ceil(ctx.ttl / 1000)}s.`),
  });

  // Applied as a root-level onRequest hook rather than `global: true`, which
  // attaches per route and therefore runs *after* the /api/v1 scope's own
  // `authenticate` hook - an unauthenticated flood would do a database lookup
  // per request before being turned away. Root hooks run first, so this rejects
  // the flood before it reaches the database.
  app.addHook('onRequest', app.rateLimit());

  // Nothing here is meant to be rendered by a browser or cached by anything in
  // between. Cheap to send, and it is what an enterprise review asks for.
  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'no-referrer');
  });

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
      await api.register(evaluateRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}

async function start() {
  const app = await buildServer();
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
