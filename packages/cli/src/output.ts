import { styleText } from 'node:util';

export interface FlagView {
  key: string;
  name: string;
  description: string | null;
  environment: string;
  enabled: boolean;
  rolloutPercentage: number;
  locked: boolean;
  lockReason: string | null;
  updatedAt: string;
}

export interface HistoryEntry {
  action: string;
  environment: string | null;
  actor: { name: string; email: string; via: string };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
}

const color = (c: Parameters<typeof styleText>[0], s: string) =>
  process.stdout.isTTY && !process.env.NO_COLOR ? styleText(c, s) : s;

export const dim = (s: string) => color('dim', s);
export const bold = (s: string) => color('bold', s);
export const green = (s: string) => color('green', s);
export const red = (s: string) => color('red', s);
export const yellow = (s: string) => color('yellow', s);

/** "ON 25%" / "OFF" / "LOCKED" - the state a human scans for first. */
export function stateOf(flag: Pick<FlagView, 'enabled' | 'rolloutPercentage' | 'locked'>): string {
  const base = flag.enabled ? green(`ON  ${String(flag.rolloutPercentage).padStart(3)}%`) : red('OFF     ');
  return flag.locked ? `${base} ${yellow('LOCKED')}` : base;
}

/**
 * Minimal column layout. console.table prints an index column and boxes; this
 * is what `docker ps` and `kubectl get` look like, which is what people expect.
 */
export function table(rows: string[][], header: string[]): string {
  const all = [header, ...rows];
  const widths = header.map((_, i) => Math.max(...all.map((r) => visibleLength(r[i] ?? ''))));
  const line = (r: string[]) =>
    r.map((cell, i) => cell + ' '.repeat(widths[i] - visibleLength(cell))).join('  ').trimEnd();
  return [dim(line(header)), ...rows.map(line)].join('\n');
}

/** Length as rendered - ANSI escape codes take no columns. */
function visibleLength(s: string): number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

export function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function printFlag(flag: FlagView): void {
  const rows: [string, string][] = [
    ['Flag', bold(flag.key)],
    ['Name', flag.name],
    ['Environment', flag.environment],
    ['State', stateOf(flag)],
  ];
  if (flag.description) rows.push(['Description', flag.description]);
  if (flag.locked) rows.push(['Lock reason', flag.lockReason ?? dim('none recorded')]);
  rows.push(['Last change', `${relativeTime(flag.updatedAt)} ${dim(flag.updatedAt)}`]);

  const width = Math.max(...rows.map(([k]) => k.length));
  for (const [k, v] of rows) console.log(`${dim(k.padEnd(width))}  ${v}`);
}

export function printFlagList(flags: FlagView[], environment: string): void {
  if (!flags.length) {
    console.log(dim(`No flags in ${environment}. Create one with: flagrship create <key>`));
    return;
  }
  console.log(
    table(
      flags.map((f) => [f.key, stateOf(f), f.name, relativeTime(f.updatedAt)]),
      ['KEY', 'STATE', 'NAME', 'CHANGED'],
    ),
  );
}

/** One line per audit entry, most recent first: "2m ago  rollout  25% -> 50%  nisarg@..." */
export function printHistory(entries: HistoryEntry[]): void {
  if (!entries.length) {
    console.log(dim('No history yet.'));
    return;
  }
  console.log(
    table(
      entries.map((e) => [
        relativeTime(e.at),
        e.action.replace(/^flag\./, ''),
        describeChange(e),
        `${e.actor.email} ${dim(`via ${e.actor.via}`)}`,
      ]),
      ['WHEN', 'ACTION', 'CHANGE', 'BY'],
    ),
  );
}

function describeChange(e: HistoryEntry): string {
  const b = e.before ?? {};
  const a = e.after ?? {};
  const pct = (s: Record<string, unknown>) =>
    s.enabled === false ? 'off' : s.rolloutPercentage !== undefined ? `${s.rolloutPercentage}%` : '';

  switch (e.action) {
    case 'flag.created':
      return `created as "${a.name ?? ''}"`;
    case 'flag.archived':
      return 'archived';
    case 'flag.locked':
      return `locked: ${a.lockReason ?? ''}`;
    case 'flag.unlocked':
      return 'unlocked';
    default: {
      const from = pct(b);
      const to = pct(a);
      return from && to ? `${from} ${dim('->')} ${to}` : to || from;
    }
  }
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
