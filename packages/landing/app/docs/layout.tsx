import { OnThisPage, Pager, Sidebar, TopTabs } from '@/components/DocsShell';

/* Mintlify-shaped shell: fixed sidebar, tab bar, prose column, outline rail. */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopTabs />
        <div className="mx-auto flex max-w-[1100px] gap-12 px-6 py-10 md:px-10 md:py-14">
          <main className="min-w-0 max-w-[720px] flex-1">
            {children}
            <Pager />
            <footer className="mt-16 border-t border-line pt-6 text-[13px] text-muted">Flagrship · Ship without a release.</footer>
          </main>
          <aside className="hidden w-[200px] flex-none xl:block">
            <div className="sticky top-[72px]">
              <OnThisPage />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
