/**
 * Sync behaviour with a scripted fetch: init failure, 304 handling, ETag
 * round-trip, polling, and close(). No network, no database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Flagrship, type FlagConfig } from '../src/index';

type Scripted = { status: number; flags?: FlagConfig[]; etag?: string } | Error;

/** A fetch that replays a script of responses and records what it was sent. */
function scriptedFetch(script: Scripted[]) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  let i = 0;
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    const step = script[Math.min(i++, script.length - 1)];
    if (step instanceof Error) throw step;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (step.etag) headers.etag = step.etag;
    return new Response(step.status === 304 ? null : JSON.stringify({ flags: step.flags ?? [] }), {
      status: step.status,
      headers,
    });
  };
  return { impl: impl as typeof fetch, calls };
}

const ON: FlagConfig = { key: 'f', enabled: true, rolloutPercentage: 100, targetingRules: null };
const OFF: FlagConfig = { key: 'f', enabled: false, rolloutPercentage: 0, targetingRules: null };

describe('construction', () => {
  it('requires an apiKey', () => {
    expect(() => new Flagrship({ apiKey: '' })).toThrow(/apiKey is required/);
  });

  it('sends the key as a bearer token to /api/v1/evaluate', async () => {
    const f = scriptedFetch([{ status: 200, flags: [] }]);
    const sdk = new Flagrship({ apiKey: 'sk_read_x', apiUrl: 'http://api.test/', fetch: f.impl, pollInterval: 0 });
    await sdk.ready();
    expect(f.calls[0].url).toBe('http://api.test/api/v1/evaluate');
    expect(f.calls[0].headers.authorization).toBe('Bearer sk_read_x');
  });
});

describe('graceful degradation', () => {
  it('never rejects ready() when the first sync fails', async () => {
    const f = scriptedFetch([new Error('ECONNREFUSED')]);
    const errors: Error[] = [];
    const sdk = new Flagrship({ apiKey: 'k', fetch: f.impl, pollInterval: 0, onError: (e) => errors.push(e) });
    await expect(sdk.ready()).resolves.toBeUndefined();
    expect(errors[0].message).toBe('ECONNREFUSED');
  });

  it('serves defaults until a sync succeeds', async () => {
    const f = scriptedFetch([new Error('down'), { status: 200, flags: [ON] }]);
    const sdk = new Flagrship({ apiKey: 'k', fetch: f.impl, pollInterval: 0, defaults: { f: true, g: false } });
    await sdk.ready();
    expect(sdk.isEnabled('f')).toBe(true); // from defaults
    expect(sdk.isEnabled('g')).toBe(false);
    expect(sdk.isEnabled('h')).toBe(false); // no default at all

    await sdk.refresh();
    expect(sdk.isEnabled('f')).toBe(true); // now from real config
    expect(sdk.getFlag('f')).toEqual(ON);
  });

  it('keeps the last good config when a later sync fails', async () => {
    const f = scriptedFetch([{ status: 200, flags: [ON] }, { status: 500 }]);
    const sdk = new Flagrship({ apiKey: 'k', fetch: f.impl, pollInterval: 0 });
    await sdk.ready();
    expect(await sdk.refresh()).toBe(false);
    expect(sdk.isEnabled('f')).toBe(true);
  });

  it('names a 401 as a key problem', async () => {
    const f = scriptedFetch([{ status: 401 }]);
    const errors: Error[] = [];
    const sdk = new Flagrship({ apiKey: 'bad', fetch: f.impl, pollInterval: 0, onError: (e) => errors.push(e) });
    await sdk.ready();
    expect(errors[0].message).toMatch(/401.*check the API key/);
  });
});

describe('ETag sync', () => {
  it('sends If-None-Match on the second request and leaves config alone on 304', async () => {
    const f = scriptedFetch([{ status: 200, flags: [ON], etag: '"v1"' }, { status: 304 }]);
    const updates: number[] = [];
    const sdk = new Flagrship({ apiKey: 'k', fetch: f.impl, pollInterval: 0, onUpdate: (m) => updates.push(m.size) });
    await sdk.ready();

    expect(await sdk.refresh()).toBe(false);
    expect(f.calls[0].headers['if-none-match']).toBeUndefined();
    expect(f.calls[1].headers['if-none-match']).toBe('"v1"');
    expect(sdk.isEnabled('f')).toBe(true);
    expect(updates).toEqual([1]); // onUpdate fired once, not for the 304
  });

  it('replaces config and updates the ETag on 200', async () => {
    const f = scriptedFetch([
      { status: 200, flags: [ON], etag: '"v1"' },
      { status: 200, flags: [OFF], etag: '"v2"' },
      { status: 304 },
    ]);
    const sdk = new Flagrship({ apiKey: 'k', fetch: f.impl, pollInterval: 0 });
    await sdk.ready();
    expect(sdk.isEnabled('f')).toBe(true);

    expect(await sdk.refresh()).toBe(true);
    expect(sdk.isEnabled('f')).toBe(false);

    await sdk.refresh();
    expect(f.calls[2].headers['if-none-match']).toBe('"v2"');
  });

  it('drops flags that disappear from the payload', async () => {
    const f = scriptedFetch([{ status: 200, flags: [ON] }, { status: 200, flags: [] }]);
    const sdk = new Flagrship({ apiKey: 'k', fetch: f.impl, pollInterval: 0 });
    await sdk.ready();
    await sdk.refresh();
    expect(sdk.getFlag('f')).toBeUndefined();
    expect(sdk.allFlags().size).toBe(0);
  });
});

describe('polling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('polls at the configured interval and stops on close()', async () => {
    const f = scriptedFetch([{ status: 200, flags: [ON], etag: '"v1"' }, { status: 304 }]);
    const sdk = new Flagrship({ apiKey: 'k', fetch: f.impl, pollInterval: 1000 });
    await sdk.ready();
    expect(f.calls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(f.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.calls).toHaveLength(4);

    sdk.close();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.calls).toHaveLength(4);
  });

  it('does not poll when pollInterval is 0', async () => {
    const f = scriptedFetch([{ status: 200, flags: [] }]);
    const sdk = new Flagrship({ apiKey: 'k', fetch: f.impl, pollInterval: 0 });
    await sdk.ready();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(f.calls).toHaveLength(1);
  });
});
