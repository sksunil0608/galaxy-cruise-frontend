"use client"

import { useEffect, useRef, useState } from "react"
import {
  Activity,
  LogIn,
  RefreshCcw,
  Search,
  XCircle
} from "lucide-react"
import { fetchActivities } from "../api"

const fmtDT = v =>
  v
    ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "--"

const ACTION_META = {
  login:          { icon: LogIn,       label: "Login",         color: "bg-sky-100 text-sky-700" },
  search_cruise:  { icon: Search,      label: "Cruise search", color: "bg-indigo-100 text-indigo-700" },
  refresh_cabin:  { icon: RefreshCcw,  label: "Cabin refresh", color: "bg-amber-100 text-amber-700" },
}

const ACT_LIMIT = 30

export default function UserActivityPage() {
  const [items, setItems]           = useState([])
  const [total, setTotal]           = useState(0)
  const [offset, setOffset]         = useState(0)
  const [loading, setLoading]       = useState(false)
  const [filter, setFilter]         = useState("all")
  const [search, setSearch]         = useState("")
  const [searchInput, setSearchInput] = useState("")
  const bootedRef = useRef(false)

  const stats = {
    logins:    items.filter(a => a.action === "login").length,
    searches:  items.filter(a => a.action === "search_cruise").length,
    refreshes: items.filter(a => a.action === "refresh_cabin").length,
  }

  async function load({ reset = false, f = filter, s = search } = {}) {
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
    if (!bootedRef.current) {
      bootedRef.current = true
      load({ reset: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilter(f) {
    setFilter(f)
    load({ reset: true, f, s: search })
  }

  function applySearch(e) {
    e.preventDefault()
    setSearch(searchInput)
    load({ reset: true, f: filter, s: searchInput })
  }

  function clearSearch() {
    setSearchInput("")
    setSearch("")
    load({ reset: true, f: filter, s: "" })
  }

  const hasMore = offset < total

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-4">
      <div className="mx-auto max-w-[1000px] space-y-6">

        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Administration</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">User activity</h1>
          <p className="mt-2 text-sm text-slate-500">
            Login events, cruise searches, and cabin refreshes from all users.
          </p>

          {/* Stats */}
          {items.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-3">
              <StatPill icon={LogIn}      label="Logins"    value={stats.logins}    color="bg-sky-50 text-sky-700 border-sky-100" />
              <StatPill icon={Search}     label="Searches"  value={stats.searches}  color="bg-indigo-50 text-indigo-700 border-indigo-100" />
              <StatPill icon={RefreshCcw} label="Refreshes" value={stats.refreshes} color="bg-amber-50 text-amber-700 border-amber-100" />
              <StatPill icon={Activity}   label="Total"     value={total}           color="bg-slate-50 text-slate-600 border-slate-200" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter pills */}
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {[
              { key: "all",           label: "All" },
              { key: "login",         label: "Login" },
              { key: "search_cruise", label: "Search" },
              { key: "refresh_cabin", label: "Refresh" }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => applyFilter(f.key)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  filter === f.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={applySearch} className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
              <Search size={12} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by name or email…"
                className="bg-transparent text-xs outline-none w-52 text-slate-700 placeholder-slate-400"
              />
              {searchInput && (
                <button type="button" onClick={clearSearch} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={12} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Search
            </button>
          </form>

          <button
            onClick={() => load({ reset: true })}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Activity list */}
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {loading && items.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-400">No activity found.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {items.map((act, i) => <ActivityRow key={act.id ?? i} act={act} />)}
            </div>
          )}

          {/* Load more footer */}
          {items.length > 0 && (
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-6 py-4">
              <span className="text-xs text-slate-400">Showing {items.length} of {total}</span>
              {hasMore && (
                <button
                  onClick={() => load()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {loading && <RefreshCcw size={13} className="animate-spin" />}
                  Load more
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium ${color}`}>
      <Icon size={12} />
      <span>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}

function ActivityRow({ act }) {
  const meta  = ACTION_META[act.action] ?? { icon: Activity, label: act.action, color: "bg-slate-100 text-slate-600" }
  const Icon  = meta.icon
  const who   = act.user?.name ?? act.userEmail ?? "Unknown"
  const email = act.user?.email ?? act.userEmail ?? null
  const detail = act.details
    ? Object.entries(act.details)
        .filter(([, v]) => v != null && v !== false && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ")
    : null

  return (
    <div className="flex flex-col gap-1 px-6 py-3 hover:bg-slate-50 transition-colors md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>
          <Icon size={11} />
          {meta.label}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-slate-800">{who}</span>
          {email && who !== email && (
            <span className="text-xs text-slate-400">{email}</span>
          )}
        </div>
        {detail && (
          <span className="font-mono text-xs text-slate-400 truncate max-w-sm">{detail}</span>
        )}
      </div>
      <span className="text-xs text-slate-400 shrink-0">{fmtDT(act.createdAt)}</span>
    </div>
  )
}
