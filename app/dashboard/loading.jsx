export default function DashboardLoading() {
  return (
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4">
      {/* Top Banner Skeleton */}
      <div className="rounded-2xl border border-teal-200/60 bg-white p-6 sm:p-7 shadow-xs">
        <div className="h-4 w-36 animate-pulse rounded-full bg-teal-100" />
        <div className="mt-4 h-8 w-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs"
          >
            <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Table / Content Skeleton */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
        <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-3.5 w-72 animate-pulse rounded bg-slate-100" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4"
            >
              <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-56 animate-pulse rounded bg-slate-100" />
              <div className="mt-3 h-1.5 w-full animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
