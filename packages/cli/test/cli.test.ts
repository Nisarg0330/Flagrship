/**
 * Week 4's runnable check: every CLI command, executed as the built binary,
 * against a real API on a random port. `npm test` builds first (see pretest).
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../api/src/server';
import { prisma } from '../../api/src/lib/db';
import { generateApiKey } from '../../api/src/middleware/auth';
import { assertSafeApiUrl } from '../src/config';

const execFileAsync = promisify(execFile);
const BIN = join(__dirname, '..', 'dist', 'flagrship.js');
const SLUG = `cli-${Date.now()}`;

let app: FastifyInstance;
let apiUrl: string;
let orgId: string;
let stagingKey: string;
let productionKey: string;
let workdir: string;

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs the CLI in the temp project dir. Never throws - exit code is data. */
async function cli(...args: string[]): Promise<Result> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [BIN, ...args], {
      cwd: workdir,
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as Result & { code: number };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: 'CLI Org', slug: SLUG } });
  orgId = org.id;
  const user = await prisma.user.create({
    data: { orgId, email: `dev@${SLUG}.test`, name: 'CLI Dev', role: 'ADMIN' },
  });
  const [staging, production] = await Promise.all(
    ['staging', 'production'].map((slug, i) =>
      prisma.environment.create({ data: { orgId, name: slug, slug, sortOrder: i } }),
    ),
  );

  const s = generateApiKey('sk_admin_');
  const p = generateApiKey('sk_live_');
  stagingKey = s.raw;
  productionKey = p.raw;
  await prisma.apiKey.createMany({
    data: [
      { orgId, envId: staging.id, name: 's', keyPrefix: s.keyPrefix, keyHash: s.keyHash, scopes: ['read', 'write', 'admin'], createdBy: user.id },
      { orgId, envId: production.id, name: 'p', keyPrefix: p.keyPrefix, keyHash: p.keyHash, scopes: ['read', 'write'], createdBy: user.id },
    ],
  });

  app = await buildServer();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  apiUrl = `http://127.0.0.1:${address.port}`;

  workdir = mkdtempSync(join(tmpdir(), 'flagrship-cli-'));
});

afterAll(async () => {
  rmSync(workdir, { recursive: true, force: true });
  await app.close();
  await prisma.auditLog.deleteMany({ where: { orgId } });
  await prisma.flag.deleteMany({ where: { orgId } });
  await prisma.apiKey.deleteMany({ where: { orgId } });
  await prisma.environment.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe('init', () => {
  it('fails clearly before any config exists', async () => {
    const r = await cli('list');
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/No \.flagrship\.json found/);
  });

  it('verifies the key, learns its environment, and gitignores the file', async () => {
    const r = await cli('init', '--key', stagingKey, '--api-url', apiUrl);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/Saved staging key/);

    const config = JSON.parse(readFileSync(join(workdir, '.flagrship.json'), 'utf8'));
    expect(config).toEqual({ apiUrl, defaultEnvironment: 'staging', keys: { staging: stagingKey } });
    expect(readFileSync(join(workdir, '.gitignore'), 'utf8')).toContain('.flagrship.json');
  });

  it('rejects a bad key without writing anything', async () => {
    const before = readFileSync(join(workdir, '.flagrship.json'), 'utf8');
    const r = await cli('init', '--key', 'sk_test_bogus', '--api-url', apiUrl);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/not recognized/);
    expect(readFileSync(join(workdir, '.flagrship.json'), 'utf8')).toBe(before);
  });

  it('adds a second environment without changing the default', async () => {
    const r = await cli('init', '--key', productionKey, '--api-url', apiUrl);
    expect(r.code).toBe(0);
    const config = JSON.parse(readFileSync(join(workdir, '.flagrship.json'), 'utf8'));
    expect(config.defaultEnvironment).toBe('staging');
    expect(Object.keys(config.keys).sort()).toEqual(['production', 'staging']);
  });
});

describe('flag lifecycle', () => {
  it('create derives a name from the key', async () => {
    const r = await cli('create', 'new-checkout');
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/Created new-checkout in staging/);

    const j = await cli('status', 'new-checkout', '--json');
    expect(JSON.parse(j.stdout)).toMatchObject({ name: 'New Checkout', enabled: false });
  });

  it('enable, rollout, status', async () => {
    expect((await cli('enable', 'new-checkout')).stdout).toMatch(/ON\s+0%/);
    expect((await cli('rollout', 'new-checkout', '40')).stdout).toMatch(/ON\s+40%/);
    expect((await cli('status', 'new-checkout')).stdout).toMatch(/State\s+ON\s+40%/);
  });

  it('rejects an invalid percentage before touching the network', async () => {
    const r = await cli('rollout', 'new-checkout', '150');
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/whole number from 0 to 100/);
    expect(r.stderr).not.toMatch(/request id/);
  });

  it('rollback undoes the last change', async () => {
    const r = await cli('rollback', 'new-checkout');
    expect(r.stdout).toMatch(/Rolled back .* ON\s+0%/);
  });

  it('lock blocks changes and shows the reason', async () => {
    expect((await cli('lock', 'new-checkout', '--reason', 'incident 42')).stdout).toMatch(/LOCKED/);

    const blocked = await cli('rollout', 'new-checkout', '10');
    expect(blocked.code).toBe(1);
    expect(blocked.stderr).toMatch(/incident 42/);
    expect(blocked.stderr).toMatch(/request id: [0-9a-f-]{36}/);

    expect((await cli('unlock', 'new-checkout')).code).toBe(0);
  });

  it('list renders a table', async () => {
    const r = await cli('list');
    const lines = r.stdout.trim().split('\n');
    expect(lines[0]).toMatch(/^KEY\s+STATE\s+NAME\s+CHANGED$/);
    expect(lines[1]).toMatch(/^new-checkout\s+ON\s+0%\s+New Checkout/);
  });

  it('log shows every change, newest first', async () => {
    const r = await cli('log', 'new-checkout');
    const actions = r.stdout
      .trim()
      .split('\n')
      .slice(1)
      .map((l) => l.split(/\s{2,}/)[1]);
    expect(actions).toEqual(['unlocked', 'locked', 'rollback', 'rollout', 'enabled', 'created']);
  });
});

describe('environments', () => {
  it('--env switches keys, and each environment has its own state', async () => {
    const prod = await cli('status', 'new-checkout', '--env', 'production', '--json');
    expect(prod.code, prod.stderr).toBe(0);
    expect(JSON.parse(prod.stdout)).toMatchObject({ environment: 'production', enabled: false });
  });

  it('names the known environments when --env has no key', async () => {
    const r = await cli('list', '--env', 'qa');
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/No API key for environment "qa"/);
    expect(r.stderr).toMatch(/production, staging/);
  });

  it('refuses admin commands with a write-scoped key', async () => {
    const r = await cli('lock', 'new-checkout', '--reason', 'x', '--env', 'production');
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/requires "admin"/);
  });
});

describe('config discovery', () => {
  it('finds the config from a subdirectory', async () => {
    const sub = join(workdir, 'src', 'deep');
    require('node:fs').mkdirSync(sub, { recursive: true });
    const { stdout } = await execFileAsync('node', [BIN, 'list', '--json'], {
      cwd: sub,
      env: { ...process.env, NO_COLOR: '1' },
    });
    expect(JSON.parse(stdout).environment).toBe('staging');
  });

  it('reports a corrupt config file by path', async () => {
    writeFileSync(join(workdir, '.flagrship.json'), '{ not json');
    const r = await cli('list');
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/is not valid JSON/);
  });
});

/* ── security review fixes ─────────────────────────────────────────────────── */

/** Like `cli()`, but with a controlled environment and optional stdin. */
async function cliWith(
  opts: { env?: NodeJS.ProcessEnv; input?: string },
  ...args: string[]
): Promise<Result> {
  const child = execFile(
    'node',
    [BIN, ...args],
    { cwd: workdir, env: { ...process.env, NO_COLOR: '1', ...opts.env } },
    () => {},
  );
  if (opts.input !== undefined) child.stdin?.end(opts.input);
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d));
    child.stderr?.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

describe('init refuses to hand the key to the wrong place', () => {
  it('rejects a host that is not Flagrship', async () => {
    const r = await cli('init', '--key', stagingKey, '--api-url', 'https://attacker.example');
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/not a Flagrship host/);
    // The refusal happens before the request, so nothing was ever sent.
    expect(r.stderr).toMatch(/--allow-custom-host/);
  });

  it('rejects plain http to a host that is not loopback', async () => {
    const r = await cli('init', '--key', stagingKey, '--api-url', 'http://api.flagrship.dev');
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/plain http/);
  });

  // The rest is the guard itself, called directly: going through the binary
  // would mean a real request to whatever host the case names, and one of them
  // is production.
  it('passes the official host, its subdomains, and loopback', () => {
    for (const url of [
      'https://api.flagrship.dev',
      'https://flagrship.dev',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://api.localhost:3000',
    ]) {
      expect(() => assertSafeApiUrl(url), url).not.toThrow();
    }
  });

  it('lets a self-hoster through with the explicit flag', () => {
    expect(() => assertSafeApiUrl('https://flags.mycorp.internal')).toThrow(/not a Flagrship host/);
    expect(() => assertSafeApiUrl('https://flags.mycorp.internal', true)).not.toThrow();
  });

  it('is not fooled by a lookalike host', () => {
    for (const url of [
      'https://flagrship.dev.attacker.example',
      'https://notflagrship.dev',
      'https://flagrship.dev@attacker.example',
    ]) {
      expect(() => assertSafeApiUrl(url), url).toThrow();
    }
  });

  it('rejects a url it cannot parse or a scheme it does not speak', () => {
    expect(() => assertSafeApiUrl('not a url')).toThrow(/not a valid URL/);
    expect(() => assertSafeApiUrl('file:///etc/passwd')).toThrow(/http or https/);
  });
});

describe('init keeps the key out of argv', () => {
  // The config-discovery block above leaves a deliberately corrupt file behind.
  beforeAll(() => rmSync(join(workdir, '.flagrship.json'), { force: true }));

  it('reads FLAGRSHIP_API_KEY when --key is absent', async () => {
    const r = await cliWith(
      { env: { FLAGRSHIP_API_KEY: stagingKey } },
      'init',
      '--api-url',
      apiUrl,
    );
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/Saved staging key/);
  });

  it('reads stdin with --key -', async () => {
    const r = await cliWith({ input: `${stagingKey}\n` }, 'init', '--key', '-', '--api-url', apiUrl);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/Saved staging key/);
  });

  it('says what to do when there is no key anywhere', async () => {
    const r = await cliWith({ env: { FLAGRSHIP_API_KEY: '' } }, 'init', '--api-url', apiUrl);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/FLAGRSHIP_API_KEY/);
  });
});

describe('the config file is treated as a secret', () => {
  it('is owner-only', async () => {
    await cli('init', '--key', stagingKey, '--api-url', apiUrl);
    const mode = require('node:fs').statSync(join(workdir, '.flagrship.json')).mode & 0o777;
    // Windows does not implement POSIX modes; the call is a no-op there.
    if (process.platform !== 'win32') expect(mode).toBe(0o600);
  });

  it('never prints the key, even with --verbose', async () => {
    const r = await cli('--verbose', 'list');
    expect(r.code, r.stderr).toBe(0);
    expect(`${r.stdout}${r.stderr}`).not.toContain(stagingKey);
  });
});
