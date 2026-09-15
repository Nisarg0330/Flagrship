#!/usr/bin/env node
/**
 * Gate A, live. Prints the flag's value every second while you flip it from
 * another terminal with the CLI.
 *
 *   node examples/demo.js new-checkout
 *
 * Env: FLAGRSHIP_API_KEY (required), FLAGRSHIP_API_URL (default localhost:3000),
 *      FLAGRSHIP_USER (default "user-1"), FLAGRSHIP_POLL_MS (default 2000).
 */
const { Flagrship } = require('../dist/index.js');

const flagKey = process.argv[2] ?? 'new-checkout';
const userId = process.env.FLAGRSHIP_USER ?? 'user-1';
const apiKey = process.env.FLAGRSHIP_API_KEY;

if (!apiKey) {
  console.error('Set FLAGRSHIP_API_KEY to a read or write key for the environment you want to watch.');
  process.exit(1);
}

const flags = new Flagrship({
  apiKey,
  apiUrl: process.env.FLAGRSHIP_API_URL ?? 'http://localhost:3000',
  pollInterval: Number(process.env.FLAGRSHIP_POLL_MS ?? 2000),
  onUpdate: () => console.log('  ↻ config updated'),
  onError: (err) => console.log(`  ! ${err.message} (serving cached config)`),
});

let last;

async function main() {
  await flags.ready();
  console.log(`Watching "${flagKey}" as ${userId}. Ctrl+C to stop.\n`);

  setInterval(() => {
    const on = flags.isEnabled(flagKey, userId);
    const cfg = flags.getFlag(flagKey);
    const state = cfg ? `${cfg.enabled ? 'enabled' : 'disabled'} @ ${cfg.rolloutPercentage}%` : 'unknown flag';
    const changed = on !== last ? '  ← changed' : '';
    console.log(`${new Date().toLocaleTimeString()}  isEnabled = ${String(on).padEnd(5)}  (${state})${changed}`);
    last = on;
  }, 1000);
}

main();
