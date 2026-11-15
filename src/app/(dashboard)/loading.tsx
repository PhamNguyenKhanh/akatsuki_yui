export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Đang tải dữ liệu">
      <div className="space-y-2 border-b border-border pb-5">
        <div className="h-4 w-48 rounded bg-slate-200" />
        <div className="h-8 w-72 rounded bg-slate-200" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} className="h-24 rounded-xl border border-border bg-card p-4">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-7 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-xl border border-border bg-card p-6" />
        <div className="h-64 rounded-xl border border-border bg-card p-6" />
      </div>
    </div>
  );
}
