"use client"

import { useEffect, useRef, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import {
  Activity,
  Calendar,
  LogIn,
  RefreshCcw,
  Search,
  UserCheck,
  XCircle
} from "lucide-react"
import { fetchActivities } from "../api"
import { ActivityStreamSkeleton } from "@/components/ui/skeleton-patterns"
import { Skeleton } from "@/components/ui/skeleton"


const fmtDT = v =>
  v
    ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "--"

const ACTION_META = {
  login:          { icon: LogIn,       label: "User Login",     color: "bg-teal-50 text-teal-800 border-teal-200/80" },
  search_cruise:  { icon: Search,      label: "Cruise Search",  color: "bg-sky-50 text-sky-800 border-sky-200/80" },
  refresh_cabin:  { icon: RefreshCcw,  label: "Cabin Refresh",  color: "bg-amber-50 text-amber-800 border-amber-200/80" },
}

const ACT_LIMIT = 30

export default function UserActivityPage() {
  const [items, setItems]             = useState([])
  const [total, setTotal]             = useState(0)
  const [offset, setOffset]           = useState(0)
  const [loading, setLoading]         = useState(false)
  const [filter, setFilter]           = useState("all")
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearchInput          = useDebounce(searchInput, 350)
  const bootedRef = useRef(false)

  const stats = {
    logins:    items.filter(a => a.action === "login").length,
    searches:  items.filter(a => a.action === "search_cruise").length,
    refreshes: items.filter(a => a.action === "refresh_cabin").length,
  }

  async function load({ reset = false, f = filter, s = debouncedSearchInput } = {}) {
    setLoading(true)
    const off = reset ? 0 : offset
    const res = await fetchActivities({
      limit:  ACT_LIMIT,
      offset: off,
      action: f !== "all" ? f : undefined,
      search: s || undefined
    }).catch(() => ({ data: [], total: 0 }))

    if (reset) {
      setItems(res.data ?? [])
      setOffset(ACT_LIMIT)
    } else {
      setItems(prev => [...prev, ...(res.data ?? [])])
      setOffset(prev => prev + ACT_LIMIT)
    }
    setTotal(res.total ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    if (!bootedRef.current) {
      bootedRef.current = true
      fetchActivities({
        limit:  ACT_LIMIT,
        offset: 0,
        action: undefined,
        search: undefined
      })
        .then(res => {
          if (!mounted) return
          setItems(res.data ?? [])
          setOffset(ACT_LIMIT)
          setTotal(res.total ?? 0)
        })
        .catch(() => {})
    }
    return () => {
      mounted = false
    }
  }, [])

  // Auto-trigger search when debounced search input changes
  useEffect(() => {
    if (!bootedRef.current) return
    load({ reset: true, f: filter, s: debouncedSearchInput })
  }, [debouncedSearchInput])

  function applyFilter(f) {
    setFilter(f)
    load({ reset: true, f, s: debouncedSearchInput })
  }

  function applySearch(e) {
    e?.preventDefault()
    load({ reset: true, f: filter, s: searchInput })
  }

  function clearSearch() {
    setSearchInput("")
  }

  const hasMore = offset < total

  return (
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4">
      {/* ── Top Header Banner ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/90 backdrop-blur-xs px-3 py-0.5 text-[11px] font-bold text-teal-800 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
              </span>
              <span>Audit Trail · Operational Access Log</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              User Activity & Event Log
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">
              Audit stream of employee logins, cruise searches, tag modifications, and automated live cabin refreshes across your workspace.
            </p>
          </div>

          {/* Stats Pills */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <StatPill icon={LogIn} label="Logins" value={stats.logins} color="bg-teal-50 text-teal-800 border-teal-200/80" />
            <StatPill icon={Search} label="Searches" value={stats.searches} color="bg-sky-50 text-sky-800 border-sky-200/80" />
            <StatPill icon={RefreshCcw} label="Refreshes" value={stats.refreshes} color="bg-amber-50 text-amber-800 border-amber-200/80" />
            <StatPill icon={Activity} label="Total Events" value={total} color="bg-white text-slate-800 border-slate-200 shadow-2xs" />
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Segmented Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: "all",           label: "All Events", activeBorder: "border-2 border-emerald-600 bg-emerald-50/80 text-emerald-900" },
            { key: "login",         label: "Logins", activeBorder: "border-2 border-teal-600 bg-teal-50/80 text-teal-900" },
            { key: "search_cruise", label: "Searches", activeBorder: "border-2 border-sky-600 bg-sky-50/80 text-sky-900" },
            { key: "refresh_cabin", label: "Cabin Refreshes", activeBorder: "border-2 border-amber-600 bg-amber-50/80 text-amber-900" }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => applyFilter(f.key)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                filter === f.key
                  ? f.activeBorder
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <form onSubmit={applySearch} className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-3 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by name or email…"
                className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-8.5 pr-8 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 placeholder-slate-400"
              />
              {searchInput && (
                <button type="button" onClick={clearSearch} className="absolute right-2.5 text-slate-400 hover:text-slate-600">
                  <XCircle size={13} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
            >
              Search
            </button>
          </form>

          <button
            onClick={() => load({ reset: true })}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition disabled:opacity-60 cursor-pointer"
          >
            <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Activity List Stream */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        {loading && items.length === 0 ? (
          <ActivityStreamSkeleton count={6} />
        ) : items.length === 0 ? (

          <div className="py-20 text-center text-xs text-slate-400">No activity events recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((act, i) => (
              <ActivityRow key={act.id ?? i} act={act} />
            ))}
          </div>
        )}

        {/* Load More Footer */}
        {items.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 bg-slate-50/50">
            <span className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{items.length}</span> of <span className="font-bold text-slate-800">{total}</span> total events
            </span>
            {hasMore && (
              <button
                onClick={() => load()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 h-8 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition disabled:opacity-60 cursor-pointer"
              >
                {loading && <RefreshCcw size={12} className="animate-spin" />}
                <span>Load More Events</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${color}`}>
      <Icon size={12} />
      <span className="text-[11px] text-slate-600">{label}:</span>
      <span className="font-bold font-mono text-xs">{value}</span>
    </div>
  )
}

function ActivityRow({ act }) {
  const meta = ACTION_META[act.action] ?? { icon: Activity, label: act.action, color: "bg-slate-100 text-slate-700 border-slate-200" }
  const Icon = meta.icon
  const who = act.user?.name ?? act.userEmail ?? "System Worker"
  const email = act.user?.email ?? act.userEmail ?? null
  const initials = (who || "U").slice(0, 2).toUpperCase()

  const detail = act.details
    ? Object.entries(act.details)
        .filter(([, v]) => v != null && v !== false && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ")
    : null

  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70 transition">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 border border-teal-200/80 text-teal-800 font-bold text-xs shrink-0">
          {initials}
        </div>

        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
          <Icon size={10} />
          <span>{meta.label}</span>
        </span>

        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-slate-900">{who}</span>
          {email && who !== email && (
            <span className="text-[10px] text-slate-400 font-mono">{email}</span>
          )}
        </div>

        {detail && (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono text-slate-600 truncate max-w-sm">
            {detail}
          </span>
        )}
      </div>

      <span className="text-[11px] font-mono text-slate-400 shrink-0 sm:text-right">
        {fmtDT(act.createdAt)}
      </span>
    </div>
  )
}
