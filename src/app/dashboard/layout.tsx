export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard-theme min-h-screen bg-slate-50 text-slate-900">
      {children}
    </div>
  )
}
