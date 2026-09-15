import { bucket } from './hash';

export { bucket, murmurhash3_x86_32 } from './hash';

/** The shape /evaluate returns per flag. Mirrors the API, never extended client-side. */
export interface FlagConfig {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetingRules: unknown | null;
}

export interface FlagrshipOptions {
  /** A read-scoped key for one environment. Never ship this to a browser. */
  apiKey: string;
  /** Default: https://api.flagrship.dev */
  apiUrl?: string;
  /** Milliseconds between polls. Default 30 000. 0 disables polling. */
  pollInterval?: number;
  /** Returned for flags the SDK has no config for. Default: false for everything. */
  defaults?: Record<string, boolean>;
  /** Called after every successful config change. */
  onUpdate?: (flags: ReadonlyMap<string, FlagConfig>) => void;
  /** Called when a sync fails. The SDK keeps serving its last config regardless. */
  onError?: (error: Error) => void;
  /** Injectable for tests and non-standard runtimes. Default: globalThis.fetch. */
  fetch?: typeof fetch;
}

const DEFAULT_API_URL = 'https://api.flagrship.dev';
const DEFAULT_POLL_INTERVAL = 30_000;

export class Flagrship {
  private flags = new Map<string, FlagConfig>();
  private etag: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private readonly readyPromise: Promise<void>;

  private readonly apiKey: string;
  private readonly evaluateUrl: string;
  private readonly pollInterval: number;
  private readonly defaults: Record<string, boolean>;
  private readonly onUpdate?: FlagrshipOptions['onUpdate'];
  private readonly onError?: FlagrshipOptions['onError'];
  private readonly fetchImpl: typeof fetch;

  constructor(options: FlagrshipOptions) {
    if (!options?.apiKey) throw new Error('Flagrship: apiKey is required.');

    this.apiKey = options.apiKey;
    this.evaluateUrl = `${(options.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '')}/api/v1/evaluate`;
    this.pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL;
    this.defaults = options.defaults ?? {};
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;
    this.fetchImpl = options.fetch ?? globalThis.fetch;

    if (typeof this.fetchImpl !== 'function') {
      throw new Error('Flagrship: no fetch available. Pass one via options.fetch.');
    }

    // The first sync is the only one that runs before the app can call
    // isEnabled(). It must never throw: an unreachable flag service is not a
    // reason for a customer's app to fail to boot. Failures go to onError and
    // every flag evaluates to its default until a later poll succeeds.
    this.readyPromise = this.sync()
      .catch((err) => this.report(err))
      .then(() => this.startPolling());
  }

  /**
   * Resolves after the first sync attempt, success or failure. Await this once
   * at startup if you want the first evaluation to reflect real config rather
   * than defaults. Never rejects.
   */
  ready(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * The whole product, in one synchronous in-memory call.
   *
   *   1. Unknown flag             -> defaultValue (or options.defaults[key], or false)
   *   2. Disabled                 -> false
   *   3. Rollout 100              -> true, no user needed
   *   4. No userId, rollout < 100 -> false (cannot bucket without an identifier)
   *   5. bucket(key, userId) < rolloutPercentage
   *
   * Targeting rules are carried in the config but not evaluated yet (Phase 4).
   */
  isEnabled(flagKey: string, userId?: string | null, defaultValue?: boolean): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag) return defaultValue ?? this.defaults[flagKey] ?? false;
    if (!flag.enabled) return false;
    if (flag.rolloutPercentage >= 100) return true;
    if (!userId) return false;
    return bucket(flagKey, userId) < flag.rolloutPercentage;
  }

  /** The raw config for a flag, or undefined. Useful for debugging and dashboards. */
  getFlag(flagKey: string): FlagConfig | undefined {
    return this.flags.get(flagKey);
  }

  /** Every flag the SDK currently knows about. A snapshot - safe to iterate. */
  allFlags(): ReadonlyMap<string, FlagConfig> {
    return new Map(this.flags);
  }

  /** Force a sync now instead of waiting for the next poll. Resolves true if config changed. */
  async refresh(): Promise<boolean> {
    try {
      return await this.sync();
    } catch (err) {
      this.report(err);
      return false;
    }
  }

  /** Stop polling. The last config stays in memory and isEnabled() keeps working. */
  close(): void {
    this.closed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startPolling(): void {
    if (this.closed || this.pollInterval <= 0) return;
    this.timer = setInterval(() => void this.refresh(), this.pollInterval);
    // Do not keep a Node process alive just to poll. A script that creates an
    // SDK and finishes its work should exit; a server stays up for other reasons.
    (this.timer as { unref?: () => void }).unref?.();
  }

  /**
   * One GET /evaluate. Sends the last ETag; a 304 means nothing changed and the
   * Map is left untouched. Returns true only when config was actually replaced.
   */
  private async sync(): Promise<boolean> {
    const headers: Record<string, string> = { authorization: `Bearer ${this.apiKey}` };
    if (this.etag) headers['if-none-match'] = this.etag;

    const res = await this.fetchImpl(this.evaluateUrl, { headers });

    if (res.status === 304) return false;
    if (!res.ok) {
      throw new Error(`Flagrship: /evaluate returned ${res.status}${res.status === 401 ? ' - check the API key' : ''}.`);
    }

    const body = (await res.json()) as { flags: FlagConfig[] };
    if (!Array.isArray(body?.flags)) {
      throw new Error('Flagrship: /evaluate returned an unexpected shape.');
    }

    this.flags = new Map(body.flags.map((f) => [f.key, f]));
    this.etag = res.headers.get('etag');
    this.onUpdate?.(this.allFlags());
    return true;
  }

  private report(err: unknown): void {
    const error = err instanceof Error ? err : new Error(String(err));
    if (this.onError) this.onError(error);
    // No onError handler: stay silent. A flag SDK that spams a customer's logs
    // on every network blip is worse than one that quietly serves cached config.
  }
}
