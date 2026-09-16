import { join } from 'node:path';
import { Command } from 'commander';
import { CLI_VERSION, createClient, type Client } from './api';
import {
  CONFIG_FILE,
  CliError,
  DEFAULT_API_URL,
  ensureGitignored,
  findConfigPath,
  loadConfig,
  resolveKey,
  saveConfig,
  type Config,
} from './config';
import {
  bold,
  dim,
  green,
  printFlag,
  printFlagList,
  printHistory,
  printJson,
  stateOf,
  type FlagView,
  type HistoryEntry,
} from './output';

interface GlobalOpts {
  env?: string;
  json?: boolean;
  verbose?: boolean;
}

interface Session {
  api: Client;
  env: string;
  json: boolean;
}

const program = new Command()
  .name('flagrship')
  .description('Ship without a release. Roll out by percentage. Roll back instantly.')
  .version(CLI_VERSION, '-v, --version')
  .option('-e, --env <name>', `environment to target (default: "defaultEnvironment" in ${CONFIG_FILE})`)
  .option('--json', 'print JSON instead of a table')
  .option('--verbose', 'print each request and response status to stderr')
  .showHelpAfterError('(run with --help for usage)');

/** Every command except init starts here. */
function session(cmd: Command): Session {
  const opts = cmd.optsWithGlobals<GlobalOpts>();
  const { config } = loadConfig();
  const { env, key } = resolveKey(config, opts.env);
  return { api: createClient(config.apiUrl, key, opts.verbose), env, json: Boolean(opts.json) };
}

/** Shared tail for every command that returns a single flag. */
function showFlag(s: Session, flag: FlagView, verb?: string): void {
  if (s.json) return printJson(flag);
  if (verb) console.log(`${green('✓')} ${verb} ${bold(flag.key)} in ${flag.environment} ${dim('—')} ${stateOf(flag)}`);
  else printFlag(flag);
}

// ── init ─────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description(`store an API key in ${CONFIG_FILE} (one key per environment)`)
  .requiredOption('-k, --key <api-key>', 'API key from the dashboard or `flagrship keys create`')
  .option('--api-url <url>', 'API base URL', DEFAULT_API_URL)
  .option('--default', 'make this key\'s environment the default')
  .action(async (opts: { key: string; apiUrl: string; default?: boolean }, cmd: Command) => {
    const { verbose, json } = cmd.optsWithGlobals<GlobalOpts>();

    // Verify the key before writing anything, and learn which environment it
    // belongs to from the API rather than asking the user.
    const probe = createClient(opts.apiUrl, opts.key, verbose);
    const { environment } = await probe.get<{ environment: string }>('/flags');

    const existingPath = findConfigPath();
    const path = existingPath ?? join(process.cwd(), CONFIG_FILE);
    const config: Config = existingPath
      ? loadConfig().config
      : { apiUrl: opts.apiUrl, defaultEnvironment: environment, keys: {} };

    config.apiUrl = opts.apiUrl;
    config.keys[environment] = opts.key;
    if (opts.default || !config.defaultEnvironment) config.defaultEnvironment = environment;

    saveConfig(path, config);
    const ignored = ensureGitignored(path);

    if (json) return printJson({ path, environment, default: config.defaultEnvironment });
    console.log(`${green('✓')} Saved ${environment} key to ${dim(path)}`);
    if (ignored) console.log(`${green('✓')} Added ${CONFIG_FILE} to .gitignore`);
    if (config.defaultEnvironment === environment) console.log(`  Default environment: ${bold(environment)}`);
    else console.log(dim(`  Default environment is still ${config.defaultEnvironment}; use --env ${environment} or re-run with --default`));
  });

// ── flags ────────────────────────────────────────────────────────────────────

program
  .command('create <key>')
  .description('create a flag (disabled, 0%, in every environment)')
  .option('-n, --name <name>', 'display name (default: derived from the key)')
  .option('-d, --description <text>', 'what this flag controls')
  .action(async (key: string, opts: { name?: string; description?: string }, cmd: Command) => {
    const s = session(cmd);
    const name = opts.name ?? key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const flag = await s.api.post<FlagView>('/flags', { key, name, description: opts.description });
    showFlag(s, flag, 'Created');
  });

program
  .command('list')
  .alias('ls')
  .description('list flags in the current environment')
  .option('-s, --search <text>', 'filter by key or name')
  .action(async (opts: { search?: string }, cmd: Command) => {
    const s = session(cmd);
    const query = opts.search ? `?search=${encodeURIComponent(opts.search)}` : '';
    const res = await s.api.get<{ environment: string; flags: FlagView[] }>(`/flags${query}`);
    if (s.json) return printJson(res);
    printFlagList(res.flags, res.environment);
  });

program
  .command('status <key>')
  .description('show a flag\'s current state')
  .action(async (key: string, _opts: unknown, cmd: Command) => {
    const s = session(cmd);
    showFlag(s, await s.api.get<FlagView>(`/flags/${key}`));
  });

program
  .command('enable <key>')
  .description('turn a flag on (rollout percentage is preserved)')
  .action(async (key: string, _opts: unknown, cmd: Command) => {
    const s = session(cmd);
    showFlag(s, await s.api.post<FlagView>(`/flags/${key}/enable`), 'Enabled');
  });

program
  .command('disable <key>')
  .description('turn a flag off (rollout resets to 0%)')
  .action(async (key: string, _opts: unknown, cmd: Command) => {
    const s = session(cmd);
    showFlag(s, await s.api.post<FlagView>(`/flags/${key}/disable`), 'Disabled');
  });

program
  .command('rollout <key> <percentage>')
  .description('set the percentage of users who see the flag (0-100)')
  .action(async (key: string, pct: string, _opts: unknown, cmd: Command) => {
    const percentage = Number(pct);
    if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
      throw new CliError(`Percentage must be a whole number from 0 to 100, got "${pct}".`);
    }
    const s = session(cmd);
    showFlag(s, await s.api.post<FlagView>(`/flags/${key}/rollout`, { percentage }), 'Rolled out');
  });

program
  .command('rollback <key>')
  .description('undo the most recent change to this flag')
  .action(async (key: string, _opts: unknown, cmd: Command) => {
    const s = session(cmd);
    showFlag(s, await s.api.post<FlagView>(`/flags/${key}/rollback`), 'Rolled back');
  });

program
  .command('lock <key>')
  .description('freeze a flag so nobody can change it (admin key required)')
  .requiredOption('-r, --reason <text>', 'why - shown to anyone who tries to change it')
  .action(async (key: string, opts: { reason: string }, cmd: Command) => {
    const s = session(cmd);
    showFlag(s, await s.api.post<FlagView>(`/flags/${key}/lock`, { reason: opts.reason }), 'Locked');
  });

program
  .command('unlock <key>')
  .description('release a lock (admin key required)')
  .action(async (key: string, _opts: unknown, cmd: Command) => {
    const s = session(cmd);
    showFlag(s, await s.api.post<FlagView>(`/flags/${key}/unlock`), 'Unlocked');
  });

program
  .command('log <key>')
  .description('show who changed a flag, and when')
  .action(async (key: string, _opts: unknown, cmd: Command) => {
    const s = session(cmd);
    const res = await s.api.get<{ flag: string; entries: HistoryEntry[] }>(`/flags/${key}/history`);
    if (s.json) return printJson(res);
    printHistory(res.entries);
  });

// ── run ──────────────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof CliError) {
    console.error(`${bold('error:')} ${err.message}`);
  } else {
    console.error(`${bold('error:')} ${(err as Error).stack ?? String(err)}`);
  }
  // Not process.exit(1): a failed fetch can still have a socket closing, and
  // exiting under it trips a libuv assertion on Node 24 / Windows. Setting the
  // code and letting the loop drain exits cleanly with the same status.
  process.exitCode = 1;
});
