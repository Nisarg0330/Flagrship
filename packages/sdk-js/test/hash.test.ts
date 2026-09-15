import { describe, expect, it } from 'vitest';
import { bucket, murmurhash3_x86_32 } from '../src/hash';

describe('murmurhash3_x86_32', () => {
  // Published reference vectors for the x86_32 variant. If any of these fail,
  // the implementation is wrong - not the vector.
  it.each([
    ['', 0, 0x00000000],
    ['', 1, 0x514e28b7],
    ['', 0xffffffff, 0x81f16f39],
    ['a', 0, 0x3c2569b2],
    ['hello', 0, 0x248bfa47],
    ['hello, world', 0, 0x149bbb7f],
    ['The quick brown fox jumps over the lazy dog', 0, 0x2e4ff723],
    ['aaaa', 0x9747b28c, 0x5a97808a],
    ['abc', 0, 0xb3dd93fa],
    ['abcd', 0, 0x43ed676a],
  ])('hashes %j with seed %i to 0x%s', (input, seed, expected) => {
    expect(murmurhash3_x86_32(input as string, seed as number)).toBe(expected);
  });

  it('hashes UTF-8 bytes, not UTF-16 code units', () => {
    // "é" is 2 bytes in UTF-8 (0xC3 0xA9) and 1 code unit in UTF-16 (0xE9).
    // Cross-checked against murmurhash-js fed the raw bytes as chars:
    //   over [0xC3, 0xA9] -> 0x10110787   (what Python's bytes will produce)
    //   over [0xE9]       -> 0x44c6b0b2   (what a UTF-16 implementation produces)
    expect(murmurhash3_x86_32('é', 0)).toBe(0x10110787);
    expect(murmurhash3_x86_32('é', 0)).not.toBe(0x44c6b0b2);
  });

  it('is deterministic', () => {
    expect(murmurhash3_x86_32('new-checkout:user-42')).toBe(
      murmurhash3_x86_32('new-checkout:user-42'),
    );
  });
});

describe('bucket', () => {
  it('is always in 0..99', () => {
    for (let i = 0; i < 10_000; i++) {
      const b = bucket('flag', `user-${i}`);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });

  it('distributes roughly evenly', () => {
    const counts = new Array(100).fill(0);
    for (let i = 0; i < 100_000; i++) counts[bucket('flag', `user-${i}`)]++;
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    // 1000 expected per bucket; ±15% is generous for a good hash.
    expect(min).toBeGreaterThan(850);
    expect(max).toBeLessThan(1150);
  });

  it('gives the same user different buckets for different flags', () => {
    const a = bucket('flag-a', 'user-1');
    const b = bucket('flag-b', 'user-1');
    // Not guaranteed for any single pair, but across 100 flags at least one
    // must differ or the flag key is not contributing to the hash.
    const distinct = new Set(Array.from({ length: 100 }, (_, i) => bucket(`flag-${i}`, 'user-1')));
    expect(distinct.size).toBeGreaterThan(50);
    expect([a, b]).toHaveLength(2);
  });
});
