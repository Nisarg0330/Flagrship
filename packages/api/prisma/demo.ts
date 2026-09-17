/**
 * Creates the public demo organization behind "Try it in 60 seconds" on the
 * landing page, and prints its read-only key.
 *
 * Flag state and audit history are produced by driving the real API with a
 * temporary admin key, which is revoked at the end. Nothing is written to the
 * flag tables directly, so the demo's `flagrship log` shows real entries.
 *
 * Idempotent: exits if the demo org already exists. To rebuild it, delete the
 * org (and its rows) first.
 *
 *   DATABASE_URL=<live db> API_URL=https://api.flagrship.dev npx tsx prisma/demo.ts
 */
import { prisma } from '../src/lib/db';
import { generateApiKey } from '../src/middleware/auth';

const API = process.env.API_URL ?? 'https://api.flagrship.dev';
const SLUG = 'demo';

async function call(key: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  if (await prisma.organization.findUnique({ where: { slug: SLUG } })) {
    console.log(`org "${SLUG}" already exists; nothing to do.`);
    return;
  }

  const org = await prisma.organization.create({ data: { name: 'Flagrship Demo', slug: SLUG } });
  const user = await prisma.user.create({
    data: { orgId: org.id, email: 'demo@flagrship.dev', name: 'Flagrship Demo', role: 'ADMIN' },
  });
  const env = await prisma.environment.create({
    data: { orgId: org.id, name: 'Production', slug: 'production', color: '#dc2626' },
  });

  const admin = generateApiKey('sk_admin_');
  const read = generateApiKey('sk_read_');
  const adminRow = await prisma.apiKey.create({
    data: { orgId: org.id, envId: env.id, name: 'demo setup (revoked)', keyPrefix: admin.keyPrefix, keyHash: admin.keyHash, scopes: ['read', 'write', 'admin'], createdBy: user.id },
  });
  await prisma.apiKey.create({
    data: { orgId: org.id, envId: env.id, name: 'public demo (read-only)', keyPrefix: read.keyPrefix, keyHash: read.keyHash, scopes: ['read'], createdBy: user.id },
  });

  // The first call may wait out a Render cold start.
  console.log(`waking ${API} ...`);
  await fetch(`${API}/health`);

  const k = admin.raw;
  await call(k, 'POST', '/flags', { key: 'new-checkout', name: 'New Checkout', description: 'Rewritten checkout flow. Rolling out gradually.' });
  await call(k, 'POST', '/flags/new-checkout/enable');
  await call(k, 'POST', '/flags/new-checkout/rollout', { percentage: 10 });
  await call(k, 'POST', '/flags/new-checkout/rollout', { percentage: 25 });

  await call(k, 'POST', '/flags', { key: 'dark-mode', name: 'Dark Mode', description: 'Fully rolled out last week.' });
  await call(k, 'POST', '/flags/dark-mode/enable');
  await call(k, 'POST', '/flags/dark-mode/rollout', { percentage: 50 });
  await call(k, 'POST', '/flags/dark-mode/rollout', { percentage: 100 });

  await call(k, 'POST', '/flags', { key: 'new-pricing', name: 'New Pricing Page', description: 'Deployed dark. Not yet enabled.' });

  await call(k, 'POST', '/flags', { key: 'checkout-v2', name: 'Checkout v2', description: 'Locked during an incident. Nobody can change it until an admin unlocks it.' });
  await call(k, 'POST', '/flags/checkout-v2/enable');
  await call(k, 'POST', '/flags/checkout-v2/rollout', { percentage: 50 });
  await call(k, 'POST', '/flags/checkout-v2/lock', { reason: 'CVE-2026-1234 in the payments SDK' });

  await prisma.apiKey.update({ where: { id: adminRow.id }, data: { revokedAt: new Date() } });

  console.log(`\ndemo org ready. Public read-only key (put this on the landing page):\n\n  ${read.raw}\n`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
