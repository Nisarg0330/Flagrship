/**
 * Week 3's runnable check: rollback as an undo stack, lock enforcement, admin
 * scope gating, and API key lifecycle. Same setup shape as flags.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';
import { prisma } from '../src/lib/db';
import { generateApiKey } from '../src/middleware/auth';

const SLUG = `wk3-${Date.now()}`;
const FLAG = 'checkout-v2';

let app: FastifyInstance;
let orgId: string;
let writeKey: string;
let adminKey: string;

const auth = (key: string) => ({ authorization: `Bearer ${key}` });

const post = (url: string, key: string, payload?: unknown) =>
  app.inject({ method: 'POST', url: `/api/v1${url}`, headers: auth(key), payload: payload as object });

const get = (url: string, key: string) =>
  app.inject({ method: 'GET', url: `/api/v1${url}`, headers: auth(key) });

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { name: 'Week3 Org', slug: SLUG, plan: 'FREE' },
  });
  orgId = org.id;

  const user = await prisma.user.create({
    data: { orgId, email: `admin@${SLUG}.test`, name: 'Week3 Admin', role: 'ADMIN' },
  });

  const env = await prisma.environment.create({
    data: { orgId, name: 'production', slug: 'production', sortOrder: 0 },
  });

  const write = generateApiKey('sk_live_');
  const admin = generateApiKey('sk_admin_');
  writeKey = write.raw;
  adminKey = admin.raw;

  await prisma.apiKey.createMany({
    data: [
      {
        orgId,
        envId: env.id,
        name: 'write',
        keyPrefix: write.keyPrefix,
        keyHash: write.keyHash,
        scopes: ['read', 'write'],
        createdBy: user.id,
      },
      {
        orgId,
        envId: env.id,
        name: 'admin',
        keyPrefix: admin.keyPrefix,
        keyHash: admin.keyHash,
        scopes: ['read', 'write', 'admin'],
        createdBy: user.id,
      },
    ],
  });

  app = buildServer();
  await app.ready();

  await post('/flags', writeKey, { key: FLAG, name: 'Checkout v2' });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { orgId } });
  await prisma.flag.deleteMany({ where: { orgId } });
  await prisma.apiKey.deleteMany({ where: { orgId } });
  await prisma.environment.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
  await app.close();
  await prisma.$disconnect();
});

describe('rollback', () => {
  it('refuses when the flag has never been changed', async () => {
    const res = await post(`/flags/${FLAG}/rollback`, writeKey);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/nothing to roll back/);
  });

  it('undoes the most recent change', async () => {
    await post(`/flags/${FLAG}/enable`, writeKey);
    await post(`/flags/${FLAG}/rollout`, writeKey, { percentage: 10 });
    await post(`/flags/${FLAG}/rollout`, writeKey, { percentage: 60 });

    const res = await post(`/flags/${FLAG}/rollback`, writeKey);
    expect(res.statusCode).toBe(200);
    expect(res.json().rolloutPercentage).toBe(10);
  });

  it('is an undo stack - a second rollback undoes the first', async () => {
    const res = await post(`/flags/${FLAG}/rollback`, writeKey);
    expect(res.statusCode).toBe(200);
    // The previous rollback took 60 -> 10, so undoing it restores 60.
    expect(res.json().rolloutPercentage).toBe(60);
  });

  it('undoes a disable, restoring both enabled and the percentage', async () => {
    await post(`/flags/${FLAG}/disable`, writeKey);
    const res = await post(`/flags/${FLAG}/rollback`, writeKey);
    expect(res.json()).toMatchObject({ enabled: true, rolloutPercentage: 60 });
  });

  it('records every rollback in the audit trail', async () => {
    const res = await get(`/flags/${FLAG}/history`, writeKey);
    const rollbacks = res
      .json()
      .entries.filter((e: { action: string }) => e.action === 'flag.rollback');
    expect(rollbacks).toHaveLength(3);
  });
});

describe('lock', () => {
  it('refuses a lock from a write-scoped key', async () => {
    const res = await post(`/flags/${FLAG}/lock`, writeKey, { reason: 'CVE-2026-1234' });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/requires "admin"/);
  });

  it('requires a reason', async () => {
    const res = await post(`/flags/${FLAG}/lock`, adminKey, { reason: '   ' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe('reason');
  });

  it('locks the flag with an admin key', async () => {
    const res = await post(`/flags/${FLAG}/lock`, adminKey, { reason: 'CVE-2026-1234' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ locked: true, lockReason: 'CVE-2026-1234' });
  });

  it('blocks enable, disable, rollout and rollback while locked', async () => {
    for (const [path, payload] of [
      [`/flags/${FLAG}/enable`, undefined],
      [`/flags/${FLAG}/disable`, undefined],
      [`/flags/${FLAG}/rollout`, { percentage: 5 }],
      [`/flags/${FLAG}/rollback`, undefined],
    ] as const) {
      const res = await post(path, adminKey, payload);
      expect(res.statusCode, path).toBe(409);
      expect(res.json().error.message, path).toMatch(/CVE-2026-1234/);
    }
  });

  it('refuses to lock an already-locked flag', async () => {
    const res = await post(`/flags/${FLAG}/lock`, adminKey, { reason: 'again' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/already locked/);
  });

  it('unlocks, and the flag becomes mutable again', async () => {
    const unlocked = await post(`/flags/${FLAG}/unlock`, adminKey);
    expect(unlocked.statusCode).toBe(200);
    expect(unlocked.json()).toMatchObject({ locked: false, lockReason: null });

    const rollout = await post(`/flags/${FLAG}/rollout`, writeKey, { percentage: 5 });
    expect(rollout.statusCode).toBe(200);
  });

  it('refuses to unlock a flag that is not locked', async () => {
    const res = await post(`/flags/${FLAG}/unlock`, adminKey);
    expect(res.statusCode).toBe(409);
  });

  it('leaves lock and unlock out of the undo stack', async () => {
    // The last undoable change was rollout 60 -> 5, so rollback restores 60,
    // not the lock state that happened in between.
    const res = await post(`/flags/${FLAG}/rollback`, writeKey);
    expect(res.json()).toMatchObject({ rolloutPercentage: 60, locked: false });
  });
});

describe('api keys', () => {
  let createdId: string;
  let createdRaw: string;

  it('refuses key creation from a non-admin key', async () => {
    const res = await post('/keys', writeKey, { name: 'nope', scopes: ['read'] });
    expect(res.statusCode).toBe(403);
  });

  it('creates a key and returns the raw value exactly once', async () => {
    const res = await post('/keys', adminKey, { name: 'CI reader', scopes: ['read'] });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.key).toMatch(/^sk_read_/);
    expect(body.scopes).toEqual(['read']);
    createdId = body.id;
    createdRaw = body.key;
  });

  it('normalizes scopes so admin implies write and read', async () => {
    const res = await post('/keys', adminKey, { name: 'ops', scopes: ['admin'] });
    expect(res.json().scopes).toEqual(['read', 'write', 'admin']);
    expect(res.json().key).toMatch(/^sk_admin_/);
  });

  it('issues a working key', async () => {
    const res = await get('/flags', createdRaw);
    expect(res.statusCode).toBe(200);
  });

  it('never returns the raw key or its hash when listing', async () => {
    const res = await get('/keys', adminKey);
    expect(res.statusCode).toBe(200);

    const listed = res.json().keys.find((k: { id: string }) => k.id === createdId);
    expect(listed).toMatchObject({ name: 'CI reader', active: true, environment: 'production' });
    expect(JSON.stringify(res.json())).not.toContain(createdRaw);
    expect(JSON.stringify(res.json())).not.toContain('keyHash');
  });

  it('revokes a key, and the revoked key stops authenticating', async () => {
    const revoked = await app.inject({
      method: 'DELETE',
      url: `/api/v1/keys/${createdId}`,
      headers: auth(adminKey),
    });
    expect(revoked.statusCode).toBe(200);

    const res = await get('/flags', createdRaw);
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toMatch(/revoked/);
  });

  it('refuses to revoke the same key twice', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/keys/${createdId}`,
      headers: auth(adminKey),
    });
    expect(res.statusCode).toBe(409);
  });

  it('audits key creation and revocation', async () => {
    const actions = await prisma.auditLog.findMany({
      where: { orgId, action: { startsWith: 'api_key.' } },
      select: { action: true },
    });
    expect(actions.map((a) => a.action).sort()).toEqual([
      'api_key.created',
      'api_key.created',
      'api_key.revoked',
    ]);
  });
});
