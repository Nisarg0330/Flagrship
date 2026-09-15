import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db';

/**
 * The SDK sync endpoint. Returns the compiled config for every active flag in
 * the environment the API key is scoped to.
 *
 * This endpoint never accepts a user identifier. Bucketing happens inside the
 * SDK, and the API never sees end-user IDs (PRD §11.1, TRD §11.1). That promise
 * is enforced by this route having no parameters at all - not by validation.
 */
export async function evaluateRoutes(app: FastifyInstance) {
  app.get('/evaluate', async (req, reply) => {
    const { orgId, envId, envSlug } = req.auth;

    const configs = await prisma.flagConfig.findMany({
      where: { envId, flag: { orgId, archivedAt: null } },
      select: {
        enabled: true,
        rolloutPercentage: true,
        targetingRules: true,
        flag: { select: { key: true } },
      },
      // A stable order is what makes the ETag stable. Two identical configs in a
      // different order would hash differently and defeat the 304 path.
      orderBy: { flag: { key: 'asc' } },
    });

    const body = JSON.stringify({
      environment: envSlug,
      flags: configs.map((c) => ({
        key: c.flag.key,
        enabled: c.enabled,
        rolloutPercentage: c.rolloutPercentage,
        targetingRules: c.targetingRules,
      })),
    });

    // Strong ETag over the exact bytes we would send. Truncated: 27 base64url
    // chars is 162 bits, more than enough to never collide on one org's flags.
    const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`;

    reply.header('etag', etag);
    // "no-cache" means "revalidate every time", not "never cache" - it is what
    // makes the client send If-None-Match on every poll. "private" because the
    // payload is per-key.
    reply.header('cache-control', 'private, no-cache');

    if (req.headers['if-none-match'] === etag) {
      return reply.code(304).send();
    }

    return reply.type('application/json; charset=utf-8').send(body);
  });
}
