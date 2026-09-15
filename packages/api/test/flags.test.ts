/**
 * Week 2's runnable check: the full flag lifecycle against a real Postgres, plus
 * the auth and validation paths. Uses Fastify's `inject` - no port, no supertest.
 *
 * Requires `docker compose up -d` and a schema that has been pushed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';
import { prisma } from '../src/lib/db';
import { generateApiKey } from '../src/middleware/auth';

const SLUG = `test-${Date.now()}`;

let app: FastifyInstance;
let orgId: string;
let writeKey: string;
let readKey: string;

const auth = (key: string) => ({ authorization: `Bearer ${key}` });

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { name: 'Test Org', slug: SLUG, plan: 'FREE' },
  });
  orgId = org.id;

  const user = await prisma.user.create({
    data: { orgId, email: `admin@${SLUG}.test`, name: 'Test Admin', role: 'ADMIN' },
  });

  const [production] = await Promise.all(
    ['production', 'staging'].map((slug, i) =>
      prisma.environment.create({
        data: { orgId, name: slug, slug, sortOrder: i },
      }),
    ),
  );

  const write = generateApiKey('sk_test_');
  const read = generateApiKey('sk_read_');
  writeKey = write.raw;
  readKey = read.raw;

  await prisma.apiKey.createMany({
    data: [
      {
        orgId,
        envId: production.id,
        name: 'write',
        keyPrefix: write.keyPrefix,
        keyHash: write.keyHash,
        scopes: ['read', 'write'],
        createdBy: user.id,
      },
      {
        orgId,
        envId: production.id,
        name: 'read',
        keyPrefix: read.keyPrefix,
        keyHash: read.keyHash,
        scopes: ['read'],
        createdBy: user.id,
      },
    ],
  });

  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  // Explicit order: only flag_configs cascade from flags, the rest are Restrict.
  await prisma.auditLog.deleteMany({ where: { orgId } });
  await prisma.flag.deleteMany({ where: { orgId } });
  await prisma.apiKey.deleteMany({ where: { orgId } });
  await prisma.environment.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
  await app.close();
  await prisma.$disconnect();
});

describe('auth', () => {
  it('rejects a request with no API key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/flags' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
    expect(res.json().error.request_id).toBeTruthy();
  });

  it('rejects an unknown API key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/flags',
      headers: auth('sk_test_not-a-real-key'),
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a write from a read-only key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/flags',
      headers: auth(readKey),
      payload: { key: 'should-not-exist', name: 'Nope' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('leaves /health public', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});

describe('flag lifecycle', () => {
  const key = 'new-checkout';

  it('creates a flag with a config in every environment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/flags',
      headers: auth(writeKey),
      payload: { key, name: 'New Checkout', description: 'Rewritten checkout flow' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      key,
      environment: 'production',
      enabled: false,
      rolloutPercentage: 0,
    });

    const configs = await prisma.flagConfig.count({
      where: { flag: { orgId, key } },
    });
    expect(configs).toBe(2); // production + staging
  });

  it('rejects a duplicate key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/flags',
      headers: auth(writeKey),
      payload: { key, name: 'Duplicate' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects an invalid key format and names the field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/flags',
      headers: auth(writeKey),
      payload: { key: 'Not A Valid Key', name: 'Bad' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe('key');
  });

  it('refuses a rollout while the flag is disabled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/flags/${key}/rollout`,
      headers: auth(writeKey),
      payload: { percentage: 25 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/Enable it before/);
  });

  it('enables the flag', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/flags/${key}/enable`,
      headers: auth(writeKey),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().enabled).toBe(true);
  });

  it('sets a rollout percentage', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/flags/${key}/rollout`,
      headers: auth(writeKey),
      payload: { percentage: 25 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rolloutPercentage).toBe(25);
  });

  it('rejects a percentage outside 0-100', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/flags/${key}/rollout`,
      headers: auth(writeKey),
      payload: { percentage: 101 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe('percentage');
  });

  it('preserves the rollout across a disable/enable cycle via the audit trail', async () => {
    const disabled = await app.inject({
      method: 'POST',
      url: `/api/v1/flags/${key}/disable`,
      headers: auth(writeKey),
    });
    expect(disabled.json()).toMatchObject({ enabled: false, rolloutPercentage: 0 });

    // The 25% is gone from the config but recorded in the audit row - this is
    // exactly what week 3's rollback will read back.
    const entry = await prisma.auditLog.findFirst({
      where: { orgId, action: 'flag.disabled' },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry?.beforeState).toMatchObject({ rolloutPercentage: 25, enabled: true });
  });

  it('finds the flag by search', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/flags?search=checkout',
      headers: auth(readKey),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().flags).toHaveLength(1);
  });

  it('404s an unknown flag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/flags/does-not-exist',
      headers: auth(readKey),
    });
    expect(res.statusCode).toBe(404);
  });

  it('records one audit entry per mutation, newest first', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/flags/${key}/history`,
      headers: auth(readKey),
    });

    expect(res.statusCode).toBe(200);
    const actions = res.json().entries.map((e: { action: string }) => e.action);
    expect(actions).toEqual(['flag.disabled', 'flag.rollout', 'flag.enabled', 'flag.created']);

    const [latest] = res.json().entries;
    expect(latest.actor.email).toBe(`admin@${SLUG}.test`);
    expect(latest.actor.via).toBe('api_key');
  });

  it('never writes a mutation without its audit row', async () => {
    // Four mutations happened above: created, enabled, rollout, disabled.
    const audits = await prisma.auditLog.count({ where: { orgId, flag: { key } } });
    expect(audits).toBe(4);
  });
});
