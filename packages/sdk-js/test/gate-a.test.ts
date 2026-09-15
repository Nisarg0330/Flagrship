/**
 * Gate A, as a test. Boots the real API, creates a flag, and proves that an
 * SDK instance sees rollout and rollback through /evaluate.
 *
 * This is the demo the plan says nothing else matters without.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../api/src/server';
import { prisma } from '../../api/src/lib/db';
import { generateApiKey } from '../../api/src/middleware/auth';
import { Flagrship } from '../src/index';

const SLUG = `sdk-${Date.now()}`;
const FLAG = 'new-checkout';

let app: FastifyInstance;
let apiUrl: string;
let orgId: string;
let writeKey: string;
let readKey: string;

const mutate = (path: string, body?: unknown) =>
  fetch(`${apiUrl}/api/v1${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${writeKey}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: 'SDK Org', slug: SLUG } });
  orgId = org.id;
  const user = await prisma.user.create({
    data: { orgId, email: `dev@${SLUG}.test`, name: 'SDK Dev', role: 'ADMIN' },
  });
  const env = await prisma.environment.create({
    data: { orgId, name: 'production', slug: 'production', sortOrder: 0 },
  });

  const w = generateApiKey('sk_live_');
  const r = generateApiKey('sk_read_');
  writeKey = w.raw;
  readKey = r.raw;
  await prisma.apiKey.createMany({
    data: [
      { orgId, envId: env.id, name: 'w', keyPrefix: w.keyPrefix, keyHash: w.keyHash, scopes: ['read', 'write'], createdBy: user.id },
      { orgId, envId: env.id, name: 'r', keyPrefix: r.keyPrefix, keyHash: r.keyHash, scopes: ['read'], createdBy: user.id },
    ],
  });

  app = buildServer();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  apiUrl = `http://127.0.0.1:${address.port}`;

  await mutate('/flags', { key: FLAG, name: 'New Checkout' });
});

afterAll(async () => {
  await app.close();
  await prisma.auditLog.deleteMany({ where: { orgId } });
  await prisma.flag.deleteMany({ where: { orgId } });
  await prisma.apiKey.deleteMany({ where: { orgId } });
  await prisma.environment.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe('Gate A: create -> rollout -> SDK flips -> rollback', () => {
  it('a fresh flag evaluates false', async () => {
    const sdk = new Flagrship({ apiKey: readKey, apiUrl, pollInterval: 0 });
    await sdk.ready();
    expect(sdk.getFlag(FLAG)).toMatchObject({ enabled: false, rolloutPercentage: 0 });
    expect(sdk.isEnabled(FLAG, 'user-1')).toBe(false);
    sdk.close();
  });

  it('rollout to 100 flips it to true on the next poll', async () => {
    const sdk = new Flagrship({ apiKey: readKey, apiUrl, pollInterval: 0 });
    await sdk.ready();
    expect(sdk.isEnabled(FLAG, 'user-1')).toBe(false);

    await mutate(`/flags/${FLAG}/enable`);
    await mutate(`/flags/${FLAG}/rollout`, { percentage: 100 });

    expect(await sdk.refresh()).toBe(true);
    expect(sdk.isEnabled(FLAG, 'user-1')).toBe(true);
    expect(sdk.isEnabled(FLAG)).toBe(true); // 100% needs no user
    sdk.close();
  });

  it('a partial rollout splits users by bucket, consistently with the fixtures', async () => {
    await mutate(`/flags/${FLAG}/rollout`, { percentage: 50 });
    const sdk = new Flagrship({ apiKey: readKey, apiUrl, pollInterval: 0 });
    await sdk.ready();

    // From fixtures/conformance.json: user-53 is bucket 49, user-8 is bucket 50.
    expect(sdk.isEnabled(FLAG, 'user-53')).toBe(true);
    expect(sdk.isEnabled(FLAG, 'user-8')).toBe(false);
    expect(sdk.isEnabled(FLAG, null)).toBe(false);
    sdk.close();
  });

  it('a second poll with nothing changed is a 304 and touches nothing', async () => {
    let status: number | undefined;
    const spy: typeof fetch = async (url, init) => {
      const res = await fetch(url, init);
      status = res.status;
      return res;
    };
    const sdk = new Flagrship({ apiKey: readKey, apiUrl, pollInterval: 0, fetch: spy });
    await sdk.ready();
    expect(status).toBe(200);
    expect(await sdk.refresh()).toBe(false);
    expect(status).toBe(304);
    sdk.close();
  });

  it('rollback flips it back to false - the Gate A script, literally', async () => {
    await mutate(`/flags/${FLAG}/rollout`, { percentage: 0 });
    const sdk = new Flagrship({ apiKey: readKey, apiUrl, pollInterval: 0 });
    await sdk.ready();
    expect(sdk.isEnabled(FLAG, 'user-1')).toBe(false); // app prints: false

    await mutate(`/flags/${FLAG}/rollout`, { percentage: 100 });
    await sdk.refresh();
    expect(sdk.isEnabled(FLAG, 'user-1')).toBe(true); // app prints: true

    await mutate(`/flags/${FLAG}/rollback`); // undo: 100 -> 0
    await sdk.refresh();
    expect(sdk.getFlag(FLAG)).toMatchObject({ enabled: true, rolloutPercentage: 0 });
    expect(sdk.isEnabled(FLAG, 'user-1')).toBe(false); // app prints: false
    sdk.close();
  });

  it('a second rollback undoes the first - it is an undo stack, not a history walk', async () => {
    const sdk = new Flagrship({ apiKey: readKey, apiUrl, pollInterval: 0 });
    await sdk.ready();
    expect(sdk.getFlag(FLAG)?.rolloutPercentage).toBe(0);

    await mutate(`/flags/${FLAG}/rollback`); // undo the rollback: 0 -> 100
    await sdk.refresh();
    expect(sdk.getFlag(FLAG)?.rolloutPercentage).toBe(100);
    sdk.close();
  });

  it('a write key works for the SDK too, but a read key is what you should use', async () => {
    // Not a behaviour test - a reminder in the suite. Read keys cannot mutate,
    // so a leaked SDK key can only reveal flag state, never change it.
    const res = await fetch(`${apiUrl}/api/v1/flags/${FLAG}/enable`, {
      method: 'POST',
      headers: { authorization: `Bearer ${readKey}` },
    });
    expect(res.status).toBe(403);
  });
});
