import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { conflict, notFound, parse } from '../lib/errors';
import { generateApiKey, normalizeScopes, requireScope } from '../middleware/auth';

const createKeyBody = z.object({
  name: z.string().trim().min(1, 'A key name is required.').max(100),
  /** Defaults to the environment the calling key is scoped to. */
  environment: z.string().trim().min(1).max(40).optional(),
  scopes: z
    .array(z.enum(['read', 'write', 'admin']))
    .min(1, 'At least one scope is required.')
    .optional(),
});

/**
 * The prefix is cosmetic but load-bearing in practice: it is what a developer sees
 * in a log or a screenshot, and the TRD's convention lets them tell at a glance
 * whether a leaked key can write, and whether it points at production.
 */
function prefixFor(scopes: string[], envSlug: string) {
  if (scopes.includes('admin')) return 'sk_admin_' as const;
  if (scopes.includes('write')) return envSlug === 'production' ? ('sk_live_' as const) : ('sk_test_' as const);
  return 'sk_read_' as const;
}

export async function keyRoutes(app: FastifyInstance) {
  // Every route here is admin-only: listing keys tells an attacker which
  // environments exist and which keys are still live.
  app.post('/keys', { preHandler: requireScope('admin') }, async (req, reply) => {
    const body = parse(createKeyBody, req.body);
    const { orgId, envId, actorId } = req.auth;

    const env = body.environment
      ? await prisma.environment.findUnique({
          where: { orgId_slug: { orgId, slug: body.environment } },
        })
      : await prisma.environment.findUnique({ where: { id: envId } });

    if (!env) throw notFound(`Environment "${body.environment}" does not exist.`);

    const scopes = normalizeScopes(body.scopes ?? ['read']);
    const { raw, keyPrefix, keyHash } = generateApiKey(prefixFor(scopes, env.slug));

    const key = await prisma.$transaction(async (tx) => {
      const created = await tx.apiKey.create({
        data: {
          orgId,
          envId: env.id,
          name: body.name,
          keyPrefix,
          keyHash,
          scopes,
          createdBy: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId,
          envId: env.id,
          actorId,
          actorType: 'api_key',
          action: 'api_key.created',
          afterState: { keyPrefix, name: created.name, scopes, environment: env.slug },
          metadata: { requestId: req.id, ip: req.ip },
        },
      });

      return created;
    });

    return reply.code(201).send({
      id: key.id,
      name: key.name,
      environment: env.slug,
      scopes: key.scopes,
      keyPrefix: key.keyPrefix,
      createdAt: key.createdAt,
      // Shown exactly once. Only the SHA-256 hash is stored, so this cannot be
      // recovered later - not by support, not by a database dump.
      key: raw,
    });
  });

  app.get('/keys', { preHandler: requireScope('admin') }, async (req) => {
    const keys = await prisma.apiKey.findMany({
      where: { orgId: req.auth.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        env: { select: { slug: true } },
      },
    });

    return {
      keys: keys.map(({ env, ...key }) => ({
        ...key,
        environment: env.slug,
        active: key.revokedAt === null,
      })),
    };
  });

  app.delete('/keys/:id', { preHandler: requireScope('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const { orgId, actorId } = req.auth;

    const key = await prisma.apiKey.findFirst({
      where: { id, orgId },
      select: { id: true, name: true, keyPrefix: true, revokedAt: true, envId: true },
    });

    if (!key) throw notFound('API key not found.');
    if (key.revokedAt) throw conflict(`API key ${key.keyPrefix}… was already revoked.`);

    // Revoked, never deleted. Audit rows reference the user who created the key,
    // and a revoked key is evidence of what happened during an incident.
    await prisma.$transaction([
      prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          orgId,
          envId: key.envId,
          actorId,
          actorType: 'api_key',
          action: 'api_key.revoked',
          beforeState: { keyPrefix: key.keyPrefix, name: key.name, revoked: false },
          afterState: { keyPrefix: key.keyPrefix, name: key.name, revoked: true },
          metadata: { requestId: req.id, ip: req.ip },
        },
      }),
    ]);

    return { id: key.id, keyPrefix: key.keyPrefix, revoked: true };
  });
}
