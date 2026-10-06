import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Standard table skeleton for data grids
 */
export function SkeletonTable({ rows = 5, cols = 5, className }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white", className)}>
      <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-32 bg-slate-200" />
          <Skeleton className="h-4 w-20 bg-slate-200" />
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className={cn(
                  "flex-1",
                  cIdx === 0 && "flex-[1.5]",
                  cIdx === cols - 1 && "flex justify-end"
                )}
              >
                <Skeleton
                  className={cn(
                    "h-4 bg-slate-100",
                    cIdx === 0 ? "w-4/5 h-4.5 bg-slate-200" : cIdx === cols - 1 ? "w-16 h-7 rounded-lg" : "w-3/5"
                  )}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * KPI Stat Card Skeleton
 */
export function SkeletonStatCard({ count = 4, className }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-20 bg-slate-200" />
              <Skeleton className="h-7 w-28 bg-slate-300" />
            </div>
            <Skeleton className="h-9 w-9 rounded-lg bg-teal-100/60" />
          </div>
          <Skeleton className="h-2.5 w-4/5 bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

/**
 * Banner Header Skeleton
 */
export function SkeletonBanner({ className }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/50 via-slate-50 to-teal-50/30 p-5 sm:p-6 shadow-xs", className)}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2.5 max-w-2xl flex-1">
          <Skeleton className="h-5 w-40 rounded-full bg-teal-100/80" />
          <Skeleton className="h-8 w-3/4 max-w-md bg-slate-300" />
          <Skeleton className="h-4 w-full max-w-lg bg-slate-200" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-28 rounded-lg bg-slate-300" />
        </div>
      </div>
    </div>
  )
}

/**
 * Full Dashboard Overview Skeleton
 */
export function DashboardOverviewSkeleton() {
  return (
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4 animate-in fade-in duration-300">
      <SkeletonBanner />

      {/* 5 KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-20 bg-slate-200" />
                <Skeleton className="h-7 w-24 bg-slate-300" />
              </div>
              <Skeleton className="h-9 w-9 rounded-xl bg-slate-100" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full bg-slate-100" />
            <div className="flex justify-between items-center pt-1">
              <Skeleton className="h-3 w-28 bg-slate-100" />
              <Skeleton className="h-4 w-16 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>


      {/* Main Grid: Vendor Fleet & Price Alerts */}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32 bg-slate-300" />
              <Skeleton className="h-3.5 w-64 bg-slate-200" />
            </div>
            <Skeleton className="h-6 w-20 rounded-md bg-slate-100" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4.5 w-40 bg-slate-300" />
                    <Skeleton className="h-3 w-48 bg-slate-200" />
                  </div>
                  <Skeleton className="h-7 w-16 bg-slate-300" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full bg-slate-200" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <Skeleton className="h-4 w-full bg-slate-100" />
                  <Skeleton className="h-4 w-full bg-slate-100" />
                  <Skeleton className="h-4 w-full bg-slate-100" />
                  <Skeleton className="h-4 w-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Price alerts & chart */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <Skeleton className="h-5 w-44 bg-slate-300" />
                <Skeleton className="h-3 w-56 bg-slate-200" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md bg-rose-100" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="rounded-xl border border-teal-200/60 bg-teal-50/20 p-3.5 flex items-center justify-between">
                  <div className="space-y-1.5 flex-1 mr-3">
                    <Skeleton className="h-4 w-3/4 bg-slate-300" />
                    <Skeleton className="h-3 w-1/2 bg-slate-200" />
                    <Skeleton className="h-4 w-24 bg-teal-200/80" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-lg bg-slate-200" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
            <Skeleton className="h-5 w-44 bg-slate-300" />
            <Skeleton className="h-3 w-52 bg-slate-200" />
            <Skeleton className="h-44 w-full rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Cruise Search Table & Card Skeleton
 */
export function CruiseSearchSkeleton({ rows = 6 }) {
  return (
    <div className="w-full space-y-4">
      {/* Desktop Table Skeleton */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="grid grid-cols-12 gap-4 items-center">
            <Skeleton className="col-span-4 h-4 bg-slate-200" />
            <Skeleton className="col-span-2 h-4 bg-slate-200" />
            <Skeleton className="col-span-2 h-4 bg-slate-200" />
            <Skeleton className="col-span-2 h-4 bg-slate-200" />
            <Skeleton className="col-span-2 h-4 bg-slate-200" />
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, idx) => (
            <div key={idx} className="p-4 sm:px-5 flex items-center gap-4">
              {/* Cruise package info */}
              <div className="w-[32%] space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-md bg-teal-100/70" />
                  <Skeleton className="h-4 w-16 bg-slate-200" />
                </div>
                <Skeleton className="h-4.5 w-4/5 bg-slate-300" />
                <Skeleton className="h-3.5 w-3/5 bg-slate-200" />
              </div>

              {/* Itinerary / Ship */}
              <div className="w-[24%] space-y-1.5">
                <Skeleton className="h-4 w-3/4 bg-slate-300" />
                <Skeleton className="h-3 w-1/2 bg-slate-200" />
              </div>

              {/* Sailing Dates */}
              <div className="w-[18%] space-y-1.5">
                <Skeleton className="h-4 w-28 bg-slate-300" />
                <Skeleton className="h-3 w-20 bg-slate-200" />
              </div>

              {/* Lead price & cabins */}
              <div className="w-[14%] space-y-1.5 text-right">
                <Skeleton className="h-5 w-20 ml-auto bg-teal-200/80" />
                <Skeleton className="h-3 w-16 ml-auto bg-slate-200" />
              </div>

              {/* Actions */}
              <div className="w-[12%] flex justify-end gap-2">
                <Skeleton className="h-8 w-8 rounded-lg bg-slate-200" />
                <Skeleton className="h-8 w-16 rounded-lg bg-teal-700/60" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Card List Skeleton */}
      <div className="block md:hidden divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4.5 w-4/5 bg-slate-300" />
                <Skeleton className="h-3.5 w-1/2 bg-slate-200" />
              </div>
              <Skeleton className="h-6 w-16 rounded bg-teal-100" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-28 bg-slate-200" />
              <Skeleton className="h-5 w-20 bg-teal-300/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Tagged Cruises List Skeleton
 */
export function TaggedCruisesSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-full bg-teal-100" />
                <Skeleton className="h-5 w-20 rounded-full bg-amber-100" />
              </div>
              <Skeleton className="h-5 w-3/4 max-w-md bg-slate-300" />
              <Skeleton className="h-3.5 w-1/2 bg-slate-200" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-lg bg-slate-200" />
              <Skeleton className="h-8 w-24 rounded-lg bg-teal-700/60" />
            </div>
          </div>

          {/* Cabin grid skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {Array.from({ length: 4 }).map((_, cIdx) => (
              <div key={cIdx} className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 space-y-1.5">
                <Skeleton className="h-3 w-16 bg-slate-200" />
                <Skeleton className="h-5 w-20 bg-slate-300" />
                <Skeleton className="h-2.5 w-12 bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Activity Stream Skeleton
 */
export function ActivityStreamSkeleton({ count = 6 }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 flex items-start gap-3.5">
          <Skeleton className="h-9 w-9 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-32 bg-slate-300" />
              <Skeleton className="h-3 w-20 bg-slate-200" />
            </div>
            <Skeleton className="h-3.5 w-4/5 bg-slate-200" />
            <Skeleton className="h-3 w-1/3 bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Scraper Ops Vendor Card Grid Skeleton
 */
export function OpsScraperGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4"
        >
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-5 w-36 bg-slate-300" />
              <Skeleton className="h-3 w-24 bg-slate-200" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full bg-slate-200" />
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-24 bg-slate-200" />
              <Skeleton className="h-4 w-28 bg-slate-300" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-20 bg-slate-200" />
              <Skeleton className="h-4 w-16 bg-slate-300" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-28 bg-slate-200" />
              <Skeleton className="h-4 w-20 bg-slate-300" />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            <Skeleton className="h-8 w-24 rounded-lg bg-slate-200" />
            <Skeleton className="h-8 w-28 rounded-lg bg-teal-700/60" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Settings / Form View Skeleton
 */
export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <Skeleton className="h-10 w-10 rounded-xl bg-teal-100/70" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-5 w-36 bg-slate-300" />
                <Skeleton className="h-3.5 w-48 bg-slate-200" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-3.5 w-28 bg-slate-200" />
              <Skeleton className="h-10 w-full rounded-xl bg-slate-100" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-8 w-24 rounded-lg bg-slate-200" />
                <Skeleton className="h-8 w-28 rounded-lg bg-teal-700/60" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
        <Skeleton className="h-5 w-48 bg-slate-300" />
        <Skeleton className="h-3.5 w-64 bg-slate-200" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <Skeleton className="h-3.5 w-28 bg-slate-200" />
              <Skeleton className="h-10 w-full rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
