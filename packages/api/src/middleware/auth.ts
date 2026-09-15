import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { prisma } from '../lib/db';
import { forbidden, unauthorized } from '../lib/errors';

/**
 * Resolved from the API key on every request. An API key is scoped to exactly one
 * environment (TRD §3.2.4), so the environment is never a query parameter — the
 * key *is* the environment.
 */
export interface AuthContext {
  orgId: string;
  envId: string;
  envSlug: string;
  /**
   * The user who created the key. `audit_logs.actor_id` is a required FK to users,
   * so an API-key-driven mutation is attributed to that person with
   * `actor_type: 'api_key'` recording how it was made.
   */
  actorId: string;
  keyPrefix: string;
  scopes: string[];
}

/** SHA-256, no salt: keys are 192 bits of randomBytes, so there is nothing to defend against a rainbow table. */
export const hashApiKey = (raw: string) => createHash('sha256').update(raw).digest('hex');

/** Generates a key. The raw value is returned once and never stored. */
export function generateApiKey(prefix: 'sk_live_' | 'sk_test_' | 'sk_read_' | 'sk_admin_') {
  const raw = prefix + randomBytes(24).toString('base64url');
  return { raw, keyPrefix: raw.slice(0, 12), keyHash: hashApiKey(raw) };
}

const scopeFor = (method: string) => (method === 'GET' || method === 'HEAD' ? 'read' : 'write');

/**
 * Fastify `onRequest` hook. Fastify's hook system is the middleware layer — there is
 * no separate middleware concept to build.
 */
export async function authenticate(req: FastifyRequest): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Missing API key. Send it as: Authorization: Bearer <api-key>.');
  }

  const raw = header.slice('Bearer '.length).trim();
  if (!raw) throw unauthorized('Missing API key. Send it as: Authorization: Bearer <api-key>.');

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(raw) },
    select: {
      id: true,
      orgId: true,
      envId: true,
      scopes: true,
      createdBy: true,
      keyPrefix: true,
      revokedAt: true,
      expiresAt: true,
      env: { select: { slug: true } },
    },
  });

  // Same message for "no such key" and a malformed one — telling an attacker which
  // of their guesses was a real-but-revoked key is free information.
  if (!key) throw unauthorized('API key not recognized.');
  if (key.revokedAt) throw unauthorized('This API key has been revoked.');
  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
    throw unauthorized('This API key has expired.');
  }

  const needed = scopeFor(req.method);
  if (!key.scopes.includes(needed)) {
    throw forbidden(
      `API key ${key.keyPrefix}… has scopes [${key.scopes.join(', ')}] but this endpoint requires "${needed}".`,
    );
  }

  req.auth = {
    orgId: key.orgId,
    envId: key.envId,
    envSlug: key.env.slug,
    actorId: key.createdBy,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
  };

  // ponytail: one extra write per request. Fine at current volume; throttle to
  // once-per-minute-per-key (or move behind the Redis key cache) when /evaluate
  // traffic makes it measurable. Never allowed to fail the request it decorates.
  void prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch((err) => req.log.warn({ err }, 'failed to record api key last_used_at'));
}

/**
 * Route-level authorization, attached as a `preHandler`. The global `authenticate`
 * hook derives the required scope from the HTTP method, which cannot express
 * "this POST needs admin" — so admin-only routes carry this as well.
 *
 *   app.post('/flags/:key/lock', { preHandler: requireScope('admin') }, handler)
 */
export const requireScope = (scope: 'write' | 'admin') =>
  async function enforceScope(req: FastifyRequest): Promise<void> {
    if (!req.auth.scopes.includes(scope)) {
      throw forbidden(
        `API key ${req.auth.keyPrefix}… has scopes [${req.auth.scopes.join(', ')}] but this endpoint requires "${scope}".`,
      );
    }
  };

/**
 * Scopes are hierarchical: admin implies write, write implies read. Normalizing on
 * the way in means every check downstream is a plain `includes()` — no key can be
 * stored as admin-without-read and then fail a GET it should have passed.
 */
export function normalizeScopes(requested: string[]): string[] {
  if (requested.includes('admin')) return ['read', 'write', 'admin'];
  if (requested.includes('write')) return ['read', 'write'];
  return ['read'];
}
