/**
 * The checks behind the security review: rate limiting, response headers, and
 * the environment boundary on key creation. The scope and tenancy rules are
 * covered in week3.test.ts; this file covers what that review added.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';
import { prisma } from '../src/lib/db';
import { generateApiKey } from '../src/middleware/auth';

const SLUG = `sec-${Date.now()}`;
const LIMIT = 20;

let app: FastifyInstance;
let orgId: string;
let stagingAdminKey: string;
let productionEnvId: string;

const auth = (key: string) => ({ authorization: `Bearer ${key}` });

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { name: 'Security Org', slug: SLUG, plan: 'FREE' },
  });
  orgId = org.id;

  const user = await prisma.user.create({
    data: { orgId, email: `admin@${SLUG}.test`, name: 'Security Admin', role: 'ADMIN' },
  });

  const staging = await prisma.environment.create({
    data: { orgId, name: 'staging', slug: 'staging', sortOrder: 0 },
  });
  const production = await prisma.environment.create({
    data: { orgId, name: 'production', slug: 'production', sortOrder: 1 },
  });
  productionEnvId = production.id;

  const admin = generateApiKey('sk_admin_');
  stagingAdminKey = admin.raw;
  await prisma.apiKey.create({
    data: {
      orgId,
      envId: staging.id,
      name: 'staging admin',
      keyPrefix: admin.keyPrefix,
      keyHash: admin.keyHash,
      scopes: ['read', 'write', 'admin'],
      createdBy: user.id,
    },
  });

  // The limit is read when the plugin registers, so set it around the build
  // only - other test files in this worker keep the default.
  const previous = process.env.RATE_LIMIT_PER_MINUTE;
  process.env.RATE_LIMIT_PER_MINUTE = String(LIMIT);
  app = await buildServer();
  await app.ready();
  if (previous === undefined) delete process.env.RATE_LIMIT_PER_MINUTE;
  else process.env.RATE_LIMIT_PER_MINUTE = previous;
});

afterAll(async () => {
  await app.close();
  await prisma.auditLog.deleteMany({ where: { orgId } });
  await prisma.apiKey.deleteMany({ where: { orgId } });
  await prisma.environment.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe('key creation stays inside the calling key environment', () => {
  it('ignores an environment named in the body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/keys',
      headers: auth(stagingAdminKey),
      payload: { name: 'tries to reach production', environment: 'production', scopes: ['write'] },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    // A staging admin key must not be a way to mint a production key.
    expect(body.environment).toBe('staging');
    expect(body.keyPrefix.startsWith('sk_test_')).toBe(true);

    const created = await prisma.apiKey.findFirst({
      where: { orgId, keyPrefix: body.keyPrefix },
      select: { envId: true },
    });
    expect(created?.envId).not.toBe(productionEnvId);
  });
});

describe('response headers', () => {
  it('sends the hardening headers on an authenticated route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/flags', headers: auth(stagingAdminKey) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });
});

describe('rate limiting', () => {
  it('answers 429 once a client passes the limit, authenticated or not', async () => {
    // Unauthenticated, so this also proves the limiter runs before the database
    // is touched. `app.inject` reports one IP, which is the bucket.
    let sawLimit = false;
    let body: { error?: { code?: string } } = {};

    for (let i = 0; i < LIMIT + 5; i++) {
      const res = await app.inject({ method: 'GET', url: '/api/v1/flags' });
      if (res.statusCode === 429) {
        sawLimit = true;
        body = res.json();
        break;
      }
      expect(res.statusCode).toBe(401);
    }

    expect(sawLimit).toBe(true);
    expect(body.error?.code).toBe('RATE_LIMITED');
  });
});
