import Header from '@/components/layout/Header'
import NavTabs from '@/components/layout/NavTabs'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header />
      <NavTabs />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
