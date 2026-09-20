export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-9 w-72 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-4 w-full max-w-xl animate-pulse rounded bg-slate-100" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-4 w-56 animate-pulse rounded bg-slate-100" />
                <div className="mt-5 h-2 w-full animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
