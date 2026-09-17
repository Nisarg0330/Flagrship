/**
 * Creates one organization for a beta team: the org, an admin user, their
 * environments (in their words), and per environment one write key for the
 * CLI and one read key for the SDK. Prints the keys once.
 *
 *   DATABASE_URL=<live db> npx tsx prisma/org.ts \
 *     --name "Acme" --slug acme --email dev@acme.com --envs production,staging
 *
 * Refuses to run if the slug exists. Keys are shown once and stored hashed.
 */
import { prisma } from '../src/lib/db';
import { generateApiKey } from '../src/middleware/auth';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v && fallback === undefined) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return v ?? (fallback as string);
}

const COLORS = ['#dc2626', '#d97706', '#2563eb', '#16a34a', '#7c3aed'];

async function main() {
  const name = arg('name');
  const slug = arg('slug');
  const email = arg('email');
  const envs = arg('envs', 'production,staging').split(',').map((s) => s.trim()).filter(Boolean);

  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) throw new Error(`slug "${slug}" is not lowercase-alphanumeric-hyphens`);
  if (await prisma.organization.findUnique({ where: { slug } })) throw new Error(`org "${slug}" already exists`);

  const org = await prisma.organization.create({ data: { name, slug } });
  const user = await prisma.user.create({ data: { orgId: org.id, email, name, role: 'ADMIN' } });

  const lines: string[] = [];
  for (const [i, envSlug] of envs.entries()) {
    const env = await prisma.environment.create({
      data: { orgId: org.id, name: envSlug, slug: envSlug, color: COLORS[i % COLORS.length], sortOrder: i },
    });

    const write = generateApiKey(envSlug === 'production' ? 'sk_live_' : 'sk_test_');
    const read = generateApiKey('sk_read_');
    await prisma.apiKey.createMany({
      data: [
        { orgId: org.id, envId: env.id, name: `${envSlug} CLI`, keyPrefix: write.keyPrefix, keyHash: write.keyHash, scopes: ['read', 'write'], createdBy: user.id },
        { orgId: org.id, envId: env.id, name: `${envSlug} SDK`, keyPrefix: read.keyPrefix, keyHash: read.keyHash, scopes: ['read'], createdBy: user.id },
      ],
    });
    lines.push(`  ${envSlug.padEnd(12)} CLI (write)  ${write.raw}`);
    lines.push(`  ${''.padEnd(12)} SDK (read)   ${read.raw}`);
  }

  console.log(`\n${name} (${slug}) - admin ${email}\n`);
  console.log(lines.join('\n'));
  console.log(`\nShown once. Only hashes are stored. Admin-scoped keys are not minted here;\nlock/unlock/archive for beta teams go through you.\n`);
}

main()
  .catch((err) => { console.error(err.message ?? err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
