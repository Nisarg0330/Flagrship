// Builds public/search.json from the docs pages: one entry per page plus one
// per <H2>…</H2> heading. Runs before `next build`, so the index cannot drift
// from the pages. A static export has no server to search on, so the client
// fetches this file and filters it in memory (a few KB).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../app/docs/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const entries = [];
for (const dir of ['.', ...readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)]) {
  let src;
  try {
    src = readFileSync(join(root, dir, 'page.tsx'), 'utf8');
  } catch {
    continue;
  }
  const href = dir === '.' ? '/docs/' : `/docs/${dir}/`;
  const title = text(src.match(/<Title[^>]*>([\s\S]*?)<\/Title>/)?.[1] ?? dir);
  entries.push({ href, title, heading: '' });
  for (const m of src.matchAll(/<H2>([\s\S]*?)<\/H2>/g)) {
    const h = text(m[1]);
    entries.push({ href: `${href}#${slug(h)}`, title, heading: h });
  }
}

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/search.json', import.meta.url), JSON.stringify(entries));
console.log(`search index: ${entries.length} entries`);
