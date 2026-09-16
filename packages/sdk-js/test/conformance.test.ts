/**
 * Runs conformance/conformance.json at the repo root. The Python SDK runs the same file.
 * If a case fails here, fix the SDK, never the fixture - unless the hash
 * contract itself changed, which it must not.
 */
import { describe, expect, it } from 'vitest';
import { Flagrship, bucket, murmurhash3_x86_32, type FlagConfig } from '../src/index';
import fixtures from '../../../conformance/conformance.json';

/** A Flagrship whose first sync returns exactly these flags, with polling off. */
async function sdkWith(flags: FlagConfig[]): Promise<Flagrship> {
  const sdk = new Flagrship({
    apiKey: 'sk_read_fixture',
    pollInterval: 0,
    fetch: async () =>
      new Response(JSON.stringify({ environment: 'test', flags }), {
        status: 200,
        headers: { 'content-type': 'application/json', etag: '"fixture"' },
      }),
  });
  await sdk.ready();
  return sdk;
}

describe('conformance: hash vectors', () => {
  it.each(fixtures.hashVectors)('$input (seed $seed) -> $expected', ({ input, seed, expected }) => {
    expect(murmurhash3_x86_32(input, seed)).toBe(expected);
  });
});

describe('conformance: buckets', () => {
  it.each(fixtures.buckets)('$flagKey : $userId -> $expected', ({ flagKey, userId, expected }) => {
    expect(bucket(flagKey, userId)).toBe(expected);
  });
});

describe('conformance: evaluations', () => {
  it.each(fixtures.evaluations)('$name', async (c) => {
    const sdk = await sdkWith(c.flags as FlagConfig[]);
    const result = sdk.isEnabled(c.flagKey, c.userId, c.default ?? undefined);
    expect(result).toBe(c.expected);
  });

  it('covers the documented case count', () => {
    // Bump this when adding cases. It stops a bad merge from silently dropping half the file.
    expect(fixtures.evaluations.length).toBeGreaterThanOrEqual(24);
    expect(fixtures.buckets.length).toBeGreaterThanOrEqual(15);
    expect(fixtures.hashVectors.length).toBeGreaterThanOrEqual(8);
  });
});
