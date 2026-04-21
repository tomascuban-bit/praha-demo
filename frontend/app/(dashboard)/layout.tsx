import Header from '@/components/layout/Header'
import NavTabs from '@/components/layout/NavTabs'
import { KaiProvider } from '@/lib/kai-context'
import { KaiPanel } from '@/components/kai/Chat'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <KaiProvider>
      <div className="min-h-screen bg-surface flex flex-col">
        <Header />
        <NavTabs />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <KaiPanel />
      </div>
    </KaiProvider>
  )
}
