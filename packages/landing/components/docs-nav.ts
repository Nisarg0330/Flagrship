import type { IconName } from './ui';

/** The docs tree. Tabs are Mintlify-style: each tab owns its groups; the sidebar shows the active tab's groups. */
export const TABS = [
  {
    tab: 'Guides',
    groups: [
      { group: 'Getting started', items: [{ href: '/docs/', label: 'Introduction', icon: 'book' }, { href: '/docs/quickstart/', label: 'Quickstart', icon: 'rocket' }] },
      { group: 'Understand', items: [{ href: '/docs/concepts/', label: 'Concepts', icon: 'hash' }] },
    ],
  },
  {
    tab: 'Reference',
    groups: [
      { group: 'Tools', items: [{ href: '/docs/cli/', label: 'CLI', icon: 'terminal' }] },
      { group: 'SDKs', items: [{ href: '/docs/sdk-js/', label: 'JavaScript', icon: 'js' }, { href: '/docs/sdk-python/', label: 'Python', icon: 'python' }] },
      { group: 'HTTP', items: [{ href: '/docs/api/', label: 'API', icon: 'api' }] },
    ],
  },
] as const satisfies ReadonlyArray<{ tab: string; groups: ReadonlyArray<{ group: string; items: ReadonlyArray<{ href: string; label: string; icon: IconName }> }> }>;

export const PAGES = TABS.flatMap((t) => t.groups.flatMap((g) => g.items.map((i) => ({ ...i, tab: t.tab }))));

export const tabFor = (path: string) => TABS.find((t) => t.groups.some((g) => g.items.some((i) => i.href === path))) ?? TABS[0];
