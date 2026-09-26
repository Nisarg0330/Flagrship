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

describe('a client cannot pick its own rate limit bucket', () => {
  // Render appends to X-Forwarded-For rather than replacing it, so the header
  // arrives as "<whatever the client sent>, <real client>". Trusting every hop
  // made Fastify read the left-most entry, and rotating one header gave an
  // attacker a fresh bucket per request. TRUST_PROXY is a hop count so the
  // address the proxy observed is the one that counts.
  const REAL = '198.51.100.7';
  let proxied: FastifyInstance;

  beforeAll(async () => {
    const previousTrust = process.env.TRUST_PROXY;
    const previousLimit = process.env.RATE_LIMIT_PER_MINUTE;
    process.env.TRUST_PROXY = '1';
    process.env.RATE_LIMIT_PER_MINUTE = String(LIMIT);
    proxied = await buildServer();
    await proxied.ready();
    if (previousTrust === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousTrust;
    if (previousLimit === undefined) delete process.env.RATE_LIMIT_PER_MINUTE;
    else process.env.RATE_LIMIT_PER_MINUTE = previousLimit;
  });

  afterAll(async () => {
    await proxied.close();
  });

  const remainingFor = async (forwardedFor: string) => {
    const res = await proxied.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-forwarded-for': forwardedFor },
    });
    return Number(res.headers['x-ratelimit-remaining']);
  };

  it('spends one bucket however the client spoofs the header', async () => {
    const first = await remainingFor(`203.0.113.1, ${REAL}`);
    const second = await remainingFor(`203.0.113.2, ${REAL}`);
    const third = await remainingFor(`203.0.113.3, ${REAL}`);

    // Rotating the spoofed entry must not buy a fresh allowance.
    expect(second).toBe(first - 1);
    expect(third).toBe(first - 2);
  });

  it('still separates two genuinely different clients', async () => {
    const other = await remainingFor('203.0.113.1, 198.51.100.8');
    expect(other).toBe(LIMIT - 1);
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
