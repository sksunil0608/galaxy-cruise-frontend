"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  XCircle
} from "lucide-react"

import { checkAllVendorAuth, checkVendorAuth, getVendorSchedules } from "../api"

// Real vendor portal login URLs — for manually opening the actual site to
// log in and verify data by eye, separate from the automated scraper runs.
const VENDOR_SITE_URLS = {
  celestyal: "https://sale.celestyal.com",
  azamara: "https://connect.azamara.com/login",
  cruisingpower: "https://secure.cruisingpower.com/login",
  msc: "https://www.mscbook.com/",
  goccl: "https://www.goccl.com/",
  completecruisesolutionA: "https://www.completecruisesolution.com/Login.aspx",
  completecruisesolutionB: "https://www.completecruisesolution.com/Login.aspx",
  gohal: "https://gohal.com/",
  firstmates: "https://www.firstmates.com/login",
  seawebagents: "https://seawebagents.ncl.com/Security/login/"
}

const VENDOR_PRETTY_NAMES = {
  celestyal: "Celestyal Cruises",
  azamara: "Azamara Club Cruises",
  cruisingpower: "Cruising Power (RCL / Celebrity / Silversea)",
  msc: "MSC Cruises Bookings",
  goccl: "GOCCL (Carnival Cruise Line)",
  completecruisesolutionA: "Complete Cruise Solution A (P&O / Cunard)",
  completecruisesolutionB: "Complete Cruise Solution B (Princess)",
  gohal: "Go HAL (Holland America Line)",
  firstmates: "FirstMates (Virgin Voyages)",
  seawebagents: "SeaWeb (Norwegian Cruise Line)"
}

const VENDOR_BRAND_COLORS = {
  celestyal: "bg-cyan-50 text-cyan-800 border-cyan-200/80",
  azamara: "bg-slate-100 text-slate-800 border-slate-300",
  cruisingpower: "bg-sky-50 text-sky-800 border-sky-200/80",
  msc: "bg-blue-50 text-blue-800 border-blue-200/80",
  goccl: "bg-rose-50 text-rose-800 border-rose-200/80",
  completecruisesolutionA: "bg-indigo-50 text-indigo-800 border-indigo-200/80",
  completecruisesolutionB: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
  gohal: "bg-amber-50 text-amber-800 border-amber-200/80",
  firstmates: "bg-red-50 text-red-800 border-red-200/80",
  seawebagents: "bg-teal-50 text-teal-800 border-teal-200/80"
}

function authStatusBadge(status) {
  if (status === "ok") {
    return {
      bg: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
      dot: "bg-emerald-500",
      label: "Authenticated",
      icon: ShieldCheck
    }
  }
  if (status === "checking") {
    return {
      bg: "bg-sky-50 text-sky-800 border-sky-200/80",
      dot: "bg-sky-500",
      label: "Verifying…",
      icon: RefreshCw
    }
  }
  if (status === "skipped") {
    return {
      bg: "bg-slate-100 text-slate-600 border-slate-200",
      dot: "bg-slate-400",
      label: "Skipped",
      icon: ShieldAlert
    }
  }
  if (status) {
    return {
      bg: "bg-rose-50 text-rose-800 border-rose-200/80",
      dot: "bg-rose-500",
      label: "Auth Failed",
      icon: XCircle
    }
  }
  return {
    bg: "bg-slate-50 text-slate-500 border-slate-200",
    dot: "bg-slate-300",
    label: "Not Checked",
    icon: Globe
  }
}

export default function VendorSitesPage() {
  const [loading, setLoading] = useState(true)
  const [vendorKeys, setVendorKeys] = useState([])
  const [authResults, setAuthResults] = useState({})
  const [authRunning, setAuthRunning] = useState(false)
  const [checkingSingle, setCheckingSingle] = useState({})
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // "all" | "ok" | "failed" | "untested"
  const [copiedUrl, setCopiedUrl] = useState(null)

  useEffect(() => {
    getVendorSchedules()
      .then(res => {
        const keys = [...new Set((res.schedules ?? []).map(s => s.vendorKey))]
        setVendorKeys(keys.length > 0 ? keys : Object.keys(VENDOR_SITE_URLS))
      })
      .catch(() => setVendorKeys(Object.keys(VENDOR_SITE_URLS)))
      .finally(() => setLoading(false))
  }, [])

  async function runAuthCheck() {
    setAuthRunning(true)
    const checking = {}
    for (const key of vendorKeys) checking[key] = { status: "checking" }
    setAuthResults(checking)
    try {
      const res = await checkAllVendorAuth()
      const map = {}
      for (const v of res.vendors ?? []) map[v.key] = v
      setAuthResults(map)
    } catch (err) {
      setAuthResults({ _error: err.message })
    } finally {
      setAuthRunning(false)
    }
  }

  async function checkSingleAuth(key) {
    setCheckingSingle(prev => ({ ...prev, [key]: true }))
    setAuthResults(prev => ({ ...prev, [key]: { status: "checking" } }))
    try {
      const res = await checkVendorAuth(key)
      setAuthResults(prev => ({ ...prev, [key]: res }))
    } catch (err) {
      setAuthResults(prev => ({ ...prev, [key]: { status: "failed", error: err.message } }))
    } finally {
      setCheckingSingle(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleCopy = (url, key) => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopiedUrl(key)
    setTimeout(() => setCopiedUrl(null), 1800)
  }

  // Filtered vendors
  const filteredKeys = useMemo(() => {
    return vendorKeys.filter(key => {
      const prettyName = VENDOR_PRETTY_NAMES[key] || key
      const url = VENDOR_SITE_URLS[key] || ""
      const q = searchQuery.toLowerCase().trim()

      const matchSearch =
        !q ||
        key.toLowerCase().includes(q) ||
        prettyName.toLowerCase().includes(q) ||
        url.toLowerCase().includes(q)

      if (!matchSearch) return false

      const auth = authResults[key]?.status
      if (statusFilter === "ok") return auth === "ok"
      if (statusFilter === "failed") return auth && auth !== "ok" && auth !== "checking" && auth !== "skipped"
      if (statusFilter === "untested") return !auth

      return true
    })
  }, [vendorKeys, searchQuery, statusFilter, authResults])

  // Stats calculation
  const stats = useMemo(() => {
    let ok = 0
    let failed = 0
    let unchecked = 0

    for (const key of vendorKeys) {
      const s = authResults[key]?.status
      if (s === "ok") ok++
      else if (s && s !== "checking" && s !== "skipped") failed++
      else unchecked++
    }

    return { total: vendorKeys.length, ok, failed, unchecked }
  }, [vendorKeys, authResults])

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
              <span>Carrier Portals · External Live Access Directory</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Vendor Sites & Booking Portals
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">
              Direct access to vendor booking portals to verify login credentials, active agent sessions, and scraped inventory accuracy.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-teal-200/80 bg-white/90 backdrop-blur-xs shadow-2xs text-xs font-bold text-teal-900">
              <Globe className="size-3.5 text-teal-700" />
              <span>{vendorKeys.length} Portals</span>
            </div>
            <button
              onClick={runAuthCheck}
              disabled={authRunning}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-4.5 h-9.5 text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              <KeyRound size={13} className={authRunning ? "animate-spin" : ""} />
              <span>{authRunning ? "Verifying Credentials…" : "Verify All Auth"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Portals</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">{stats.total}</span>
            <span className="text-xs text-slate-500 font-medium">Configured</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Authenticated</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">{stats.ok}</span>
            <span className="text-xs text-emerald-600/80 font-medium">Verified OK</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Auth Issues</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700 font-mono">{stats.failed}</span>
            <span className="text-xs text-rose-600/80 font-medium">Failed / Stale</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unchecked</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-700 font-mono">{stats.unchecked}</span>
            <span className="text-xs text-slate-500 font-medium">Pending test</span>
          </div>
        </div>
      </div>

      {/* ── Main Vendor Directory Card ───────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/40">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Carrier Portal Directory</h2>
            <p className="text-xs text-slate-500">Live booking endpoints for operators and automated scraper bots.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search vendor or URL…"
                className="w-full h-8.5 rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-teal-500 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status Segment Filters */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold shadow-2xs">
              {[
                { key: "all", label: "All" },
                { key: "ok", label: "Authenticated" },
                { key: "failed", label: "Issues" }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`rounded-md px-2.5 py-1 text-[11px] transition cursor-pointer ${
                    statusFilter === f.key
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Carrier / Vendor</th>
                <th className="px-5 py-3">Portal URL</th>
                <th className="px-5 py-3">Authentication Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-teal-600" />
                      <span>Loading vendor directories…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    No vendor portals match the active search or filters.
                  </td>
                </tr>
              ) : (
                filteredKeys.map(key => {
                  const auth = authResults[key]
                  const url = VENDOR_SITE_URLS[key]
                  const prettyName = VENDOR_PRETTY_NAMES[key] || key
                  const badge = authStatusBadge(auth?.status)
                  const isChecking = checkingSingle[key] || auth?.status === "checking"
                  const brandStyle = VENDOR_BRAND_COLORS[key] || "bg-slate-100 text-slate-800 border-slate-200"

                  return (
                    <tr key={key} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg border font-bold text-xs shadow-2xs shrink-0 ${brandStyle}`}>
                            {key.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">{prettyName}</div>
                            <div className="font-mono text-[10px] text-slate-400">{key}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {url ? (
                          <div className="flex items-center gap-1.5 max-w-sm">
                            <span className="font-mono text-[11px] text-slate-600 truncate" title={url}>
                              {url.replace(/^https?:\/\//, "")}
                            </span>
                            <button
                              onClick={() => handleCopy(url, key)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                              title="Copy URL"
                            >
                              {copiedUrl === key ? <Check size={12} className="text-teal-600" /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold ${badge.bg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                            <span>{badge.label}</span>
                          </span>
                          {auth?.error && (
                            <span className="text-[10px] text-rose-600 font-mono truncate max-w-[140px]" title={auth.error}>
                              ({auth.error})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => checkSingleAuth(key)}
                            disabled={isChecking}
                            className="inline-flex items-center gap-1 px-2.5 h-7.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Verify credentials now"
                          >
                            <KeyRound size={11} className={isChecking ? "animate-spin text-teal-600" : ""} />
                            <span>{isChecking ? "Testing…" : "Test Auth"}</span>
                          </button>

                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-3 h-7.5 text-xs font-bold transition shadow-2xs"
                            >
                              <span>Open Portal</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="px-4 py-12 text-center text-xs text-slate-400 font-medium">
              Loading vendor directories…
            </div>
          ) : filteredKeys.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-slate-400">
              No vendor portals match search.
            </div>
          ) : (
            filteredKeys.map(key => {
              const auth = authResults[key]
              const url = VENDOR_SITE_URLS[key]
              const prettyName = VENDOR_PRETTY_NAMES[key] || key
              const badge = authStatusBadge(auth?.status)
              const isChecking = checkingSingle[key] || auth?.status === "checking"
              const brandStyle = VENDOR_BRAND_COLORS[key] || "bg-slate-100 text-slate-800 border-slate-200"

              return (
                <div key={key} className="p-4 bg-white hover:bg-slate-50/70 transition space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-bold text-xs shadow-2xs ${brandStyle}`}>
                        {key.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">{prettyName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{key}</div>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0 ${badge.bg}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  {url && (
                    <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-2.5 flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-[11px] text-slate-500 truncate" title={url}>
                        {url.replace(/^https?:\/\//, "")}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleCopy(url, key)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title="Copy URL"
                        >
                          {copiedUrl === key ? <Check size={12} className="text-teal-600" /> : <Copy size={12} />}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shadow-2xs"
                        >
                          <span>Launch</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => checkSingleAuth(key)}
                      disabled={isChecking}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs disabled:opacity-50"
                    >
                      <KeyRound size={11} className={isChecking ? "animate-spin text-teal-600" : ""} />
                      <span>{isChecking ? "Testing…" : "Test Auth"}</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

