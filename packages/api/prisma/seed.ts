/**
 * Creates the org, admin user, three environments, and one API key per
 * environment. Idempotent - re-running it will not duplicate anything, and will
 * not mint a second key for an environment that already has an active one.
 *
 * Run: npm run db:seed --workspace=@flagrship/api
 */
import { prisma } from '../src/lib/db';
import { generateApiKey } from '../src/middleware/auth';

const ORG = { name: 'Acme Inc', slug: 'acme' };
const ADMIN = { email: 'nisarg@flagrship.dev', name: 'Nisarg Patel' };

const ENVIRONMENTS = [
  { name: 'Production', slug: 'production', color: '#dc2626', sortOrder: 0 },
  { name: 'Staging', slug: 'staging', color: '#d97706', sortOrder: 1 },
  { name: 'Development', slug: 'development', color: '#2563eb', sortOrder: 2 },
] as const;

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: ORG.slug },
    update: {},
    create: { ...ORG, plan: 'FREE' },
  });

  const admin = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: ADMIN.email } },
    update: {},
    create: { orgId: org.id, ...ADMIN, role: 'ADMIN', authProvider: 'email' },
  });

  const minted: Array<{ env: string; key: string }> = [];
  const existing: string[] = [];

  for (const definition of ENVIRONMENTS) {
    const env = await prisma.environment.upsert({
      where: { orgId_slug: { orgId: org.id, slug: definition.slug } },
      update: {},
      create: { orgId: org.id, ...definition },
    });

    const activeKey = await prisma.apiKey.findFirst({
      where: { envId: env.id, revokedAt: null },
      select: { keyPrefix: true },
    });

    if (activeKey) {
      existing.push(`${env.slug.padEnd(12)} ${activeKey.keyPrefix}... (raw key was only shown at creation)`);
      continue;
    }

    // Seeded keys are admin-scoped: this script bootstraps a developer's own
    // local database, and POST /keys needs admin to mint anything narrower. A
    // seed that only issues read+write leaves no way in without a manual insert.
    const { raw, keyPrefix, keyHash } = generateApiKey('sk_admin_');

    await prisma.apiKey.create({
      data: {
        orgId: org.id,
        envId: env.id,
        name: `${definition.name} admin key`,
        keyPrefix,
        keyHash,
        scopes: ['read', 'write', 'admin'],
        createdBy: admin.id,
      },
    });

    minted.push({ env: env.slug, key: raw });
  }

  console.log(`\nOrganization  ${org.name} (${org.slug})`);
  console.log(`Admin         ${admin.email}`);
  console.log(`Environments  ${ENVIRONMENTS.map((e) => e.slug).join(', ')}\n`);

  if (minted.length) {
    console.log('New API keys - copy them now, they are hashed and cannot be shown again:\n');
    for (const { env, key } of minted) console.log(`  ${env.padEnd(12)} ${key}`);
    console.log('');
  }

  if (existing.length) {
    console.log('Environments that already had an active key:\n');
    for (const line of existing) console.log(`  ${line}`);
    console.log('');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
