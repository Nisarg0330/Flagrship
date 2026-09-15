import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const CONFIG_FILE = '.flagrship.json';
export const DEFAULT_API_URL = 'https://api.flagrship.dev';

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

export function saveConfig(path: string, config: Config): void {
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
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
