"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock,
  Database,
  RefreshCcw,
  Server,
  Wifi,
  WifiOff
} from "lucide-react"

import {
  checkMainBackendHealth,
  checkScraperBackendHealth,
  fetchOperationalHealthData,
  fetchVendorRuns
} from "../api"

const fmtRunDT = v =>
  v
    ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "--"

const fmtRunMs = v =>
  v == null || Number.isNaN(v) ? "--" : v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}s`

function runStatusStyle(status) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (status === "running" || status === "queued") return "bg-sky-50 text-sky-700 border-sky-200"
  if (status === "failed") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-slate-100 text-slate-600 border-slate-200"
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getDaysAgo = value => {
  if (!value) return null
  const diff = Date.now() - new Date(value).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

const freshnessStatus = daysAgo => {
  if (daysAgo === null) return { label: "Stale",  bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    bar: "bg-rose-500" }
  if (daysAgo <= 60)    return { label: "Fresh",  bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", bar: "bg-teal-600" }
  if (daysAgo <= 90)    return { label: "Aging",  bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   bar: "bg-amber-500" }
  return                       { label: "Stale",  bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    bar: "bg-rose-500" }
}

const fmtDate = v =>
  v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"

const fmtMs = v => (v == null ? "--" : `${v}ms`)

const CACHE_KEY = "ops_health_checks"

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    for (const k of Object.keys(obj)) {
      if (obj[k]?.lastChecked) obj[k].lastChecked = new Date(obj[k].lastChecked)
    }
    return obj
  } catch { return {} }
}

function writeCache(key, value) {
  try {
    const existing = readCache()
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...existing, [key]: value }))
  } catch {}
}

const EMPTY = { data: null, lastChecked: null, loading: false }

export default function OperationalHealthPage() {
  const [vendorLoading, setVendorLoading] = useState(true)
  const [vendorStatus,  setVendorStatus]  = useState([])

  const [mainSvc,    setMainSvc]    = useState(() => ({ ...EMPTY, ...readCache().main }))
  const [scraperSvc, setScraperSvc] = useState(() => ({ ...EMPTY, ...readCache().scraper }))

  // Run log
  const [runs, setRuns]                 = useState([])
  const [runsLoading, setRunsLoading]   = useState(true)
  const [runsRefreshing, setRunsRefreshing] = useState(false)
  const [runsChecked, setRunsChecked]   = useState(null)

  const loadRuns = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRunsRefreshing(true)
      else setRunsLoading(true)

      const res = await fetchVendorRuns({ limit: 100 }).catch(() => ({ data: [] }))
      setRuns(res.data ?? [])
      setRunsChecked(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setRunsLoading(false)
      setRunsRefreshing(false)
    }
  }, [])

  useEffect(() => { loadRuns() }, [loadRuns])

  const recentRunErrors = useMemo(() => runs.filter(r => r.status === "failed").slice(0, 5), [runs])

  useEffect(() => {
    fetchOperationalHealthData()
      .catch(() => ({ dashboard: { vendor_fleet: [] } }))
      .then(healthData => {
        const vendors = healthData.dashboard?.vendor_fleet ?? []
        setVendorStatus(vendors.map(v => {
          const daysAgo   = getDaysAgo(v.last_updated_at)
          const freshness = freshnessStatus(daysAgo)
          return {
            ...v,
            daysAgo,
            freshness,
            lastUpdatedLabel: daysAgo === null ? "Never" : `${daysAgo}d ago`,
            coverageMeta:
              v.cruise_count > 0
                ? `${v.cruise_count} cruises · ${v.cabin_category_count ?? 0} categories`
                : "No cruise data captured"
          }
        }))
        setVendorLoading(false)
      })
  }, [])

  async function checkMain() {
    setMainSvc(prev => ({ ...prev, loading: true }))
    const data = await checkMainBackendHealth()
    const next = { data, lastChecked: new Date(), loading: false }
    setMainSvc(next)
    writeCache("main", next)
  }

  async function checkScraper() {
    setScraperSvc(prev => ({ ...prev, loading: true }))
    const data = await checkScraperBackendHealth()
    const next = { data, lastChecked: new Date(), loading: false }
    setScraperSvc(next)
    writeCache("scraper", next)
  }

  async function checkAll() {
    await Promise.all([checkMain(), checkScraper()])
  }

  const issues = useMemo(() => {
    const list = []
    if (mainSvc.data && !mainSvc.data.ok) {
      list.push({
        service: "Main Backend (cruisesaga.backend)",
        error: mainSvc.data.error ?? "Non-OK response",
        checkedAt: mainSvc.lastChecked
      })
    }
    if (scraperSvc.data && !scraperSvc.data.ok) {
      list.push({
        service: "Scraper Backend",
        error: scraperSvc.data.error ?? "Non-OK response",
        checkedAt: scraperSvc.lastChecked
      })
    }
    return list
  }, [mainSvc, scraperSvc])

  const summary = useMemo(() => {
    const fresh = vendorStatus.filter(v => v.freshness.label === "Fresh").length
    const aging = vendorStatus.filter(v => v.freshness.label === "Aging").length
    const stale = vendorStatus.filter(v => v.freshness.label === "Stale").length
    const total = Math.max(1, vendorStatus.length)
    return { fresh, aging, stale, freshPct: (fresh / total) * 100, agingPct: (aging / total) * 100, stalePct: (stale / total) * 100 }
  }, [vendorStatus])

  const anyLoading = mainSvc.loading || scraperSvc.loading

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
              <span>Fleet Telemetry · Operational Health & SLA</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Backend Status & Scraper Freshness
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">
              Test live microservice connectivity, check latency metrics, and monitor automated ingestion data freshness across all carriers.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={checkAll}
              disabled={anyLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 h-9 text-xs font-bold text-white shadow-xs transition hover:bg-teal-800 active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCcw size={13} className={anyLoading ? "animate-spin" : ""} />
              <span>{anyLoading ? "Testing Services…" : "Check All Services"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Service Cards ───────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <ServiceCard
          label="Main Backend (cruisesaga.backend)"
          description="Cruise database, pricing engine, user authentication"
          svc={mainSvc}
          onCheck={checkMain}
        />
        <ServiceCard
          label="Scraper Backend"
          description="Carrier scrapers, live cabin refresh, background jobs"
          svc={scraperSvc}
          onCheck={checkScraper}
        />
      </div>

      {/* ── Issues Log ─────────────────────────────────────────────────── */}
      {issues.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-800 uppercase tracking-wider">
            <AlertTriangle size={15} />
            <span>Active Issues Detected</span>
          </div>
          <div className="mt-3 space-y-2">
            {issues.map((issue, i) => (
              <div key={i} className="rounded-lg border border-rose-200 bg-white p-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-rose-700 text-xs">{issue.service}</span>
                  <span className="text-[11px] text-slate-400">Detected {fmtDate(issue.checkedAt)}</span>
                </div>
                <p className="mt-1 font-mono text-xs text-rose-600 break-all">{issue.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Vendor Data Freshness ───────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Vendor Data Freshness</h2>
            <p className="text-xs text-slate-500">
              Elapsed days since cruise inventory was last synchronized.
            </p>
          </div>
          <button
            onClick={() => {
              setVendorLoading(true)
              fetchOperationalHealthData()
                .catch(() => ({ dashboard: { vendor_fleet: [] } }))
                .then(healthData => {
                  const vendors = healthData.dashboard?.vendor_fleet ?? []
                  setVendorStatus(vendors.map(v => {
                    const daysAgo   = getDaysAgo(v.last_updated_at)
                    const freshness = freshnessStatus(daysAgo)
                    return {
                      ...v,
                      daysAgo,
                      freshness,
                      lastUpdatedLabel: daysAgo === null ? "Never" : `${daysAgo}d ago`,
                      coverageMeta:
                        v.cruise_count > 0
                          ? `${v.cruise_count} cruises · ${v.cabin_category_count ?? 0} categories`
                          : "No cruise data captured"
                    }
                  }))
                  setVendorLoading(false)
                })
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 h-8 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCcw size={12} className={vendorLoading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {vendorLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading vendor status…</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vendorStatus.map(vendor => (
                <div key={vendor.vendor_id} className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-xs truncate">{vendor.vendor_name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400 truncate">{vendor.coverageMeta}</div>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0 ${vendor.freshness.bg} ${vendor.freshness.text} ${vendor.freshness.border}`}>
                      {vendor.freshness.label}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-slate-200/60 pt-2.5">
                    <Stat icon={CalendarClock} label="Updated" value={vendor.lastUpdatedLabel} />
                    <Stat icon={Database} label="Cruises" value={vendor.cruise_count ?? 0} />
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${vendor.freshness.bar}`}
                      style={{ width: vendor.daysAgo == null ? "100%" : `${Math.max(5, 100 - (vendor.daysAgo / 90) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {vendorStatus.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">No vendor data available.</div>
            )}

            <div className="pt-3 border-t border-slate-100">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fleet Freshness Composition</div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 flex">
                <div className="bg-teal-600 transition-all" style={{ width: `${summary.freshPct}%` }} />
                <div className="bg-amber-500 transition-all" style={{ width: `${summary.agingPct}%` }} />
                <div className="bg-rose-500 transition-all"  style={{ width: `${summary.stalePct}%` }} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                <LegendDot color="bg-teal-600" label={`Fresh — ${summary.fresh}`} />
                <LegendDot color="bg-amber-500" label={`Aging — ${summary.aging}`} />
                <LegendDot color="bg-rose-500"  label={`Stale — ${summary.stale}`} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Ingestion Run Log ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Ingestion Run Log</h2>
            <p className="text-xs text-slate-500">Chronological list of background extraction cycles.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadRuns(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 h-8 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCcw size={12} className={runsRefreshing ? "animate-spin" : ""} />
              <span>Refresh Log</span>
            </button>
            <span className="text-xs text-slate-400 font-medium font-mono">{runs.length} runs loaded</span>
          </div>
        </div>

        {!runsLoading && recentRunErrors.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 uppercase tracking-wider">
              <AlertTriangle size={14} className="text-rose-600" />
              <span>Recent Run Failures</span>
            </div>
            <div className="space-y-2">
              {recentRunErrors.map(run => (
                <div key={run.id} className="rounded-lg border border-rose-200 bg-white p-3 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-rose-700 text-xs">
                      {run.vendor?.name ?? run.vendor?.slug ?? "Unknown Carrier"}
                    </span>
                    <span className="text-[11px] text-slate-400">{fmtRunDT(run.finishedAt)}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-rose-600 leading-relaxed">
                    {run.notes?.slice(0, 300) || "No error details stored."}
                  </p>
                  <div className="mt-1.5 text-[11px] text-slate-400 font-mono">
                    Run #{run.id} · {fmtRunMs(run.responseTimeMs)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {runsLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading run log…</div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {runs.map(run => (
              <div
                key={run.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200/70 bg-slate-50/50 p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50 transition"
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${runStatusStyle(run.status)}`}>
                    {run.status}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-800">
                    {run.vendor?.name ?? run.vendor?.slug ?? "--"}
                  </span>
                  <span className="font-mono text-xs text-slate-600 truncate max-w-sm">
                    {run.notes?.slice(0, 100) || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0 font-mono">
                  <span>{fmtRunMs(run.responseTimeMs)}</span>
                  <span>{fmtRunDT(run.finishedAt ?? run.startedAt)}</span>
                </div>
              </div>
            ))}
            {runs.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">No runs recorded yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── ServiceCard Component ───────────────────────────────────────────────────
function ServiceCard({ label, description, svc, onCheck }) {
  const { data, lastChecked, loading } = svc
  const unchecked = data === null && !loading
  const isOk      = data?.ok === true

  const borderBg = unchecked || loading
    ? "border-slate-200/90 bg-white"
    : isOk
    ? "border-teal-200/80 bg-teal-50/20"
    : "border-rose-200 bg-rose-50/30"

  const iconBg    = unchecked || loading ? "bg-slate-100"    : isOk ? "bg-teal-100"    : "bg-rose-100"
  const iconColor = unchecked || loading ? "text-slate-400"  : isOk ? "text-teal-700"  : "text-rose-600"
  const badgeCls  = unchecked || loading ? "bg-slate-100 text-slate-600 border-slate-200" : isOk ? "bg-teal-50 text-teal-800 border-teal-200" : "bg-rose-50 text-rose-700 border-rose-200"

  return (
    <div className={`rounded-xl border p-5 shadow-2xs ${borderBg}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${iconBg}`}>
          <Server size={16} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900 text-sm">{label}</div>
          <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</div>
        </div>
        <div className="shrink-0">
          {loading ? (
            <RefreshCcw size={16} className="animate-spin text-slate-400" />
          ) : unchecked ? null : isOk ? (
            <CheckCircle2 size={18} className="text-teal-600" />
          ) : (
            <CircleAlert size={18} className="text-rose-600" />
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="mt-3.5 flex items-center justify-between gap-2">
        <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold ${badgeCls}`}>
          {!loading && !unchecked && (isOk ? <Wifi size={12} /> : <WifiOff size={12} />)}
          <span>
            {loading ? "Testing connectivity…"
             : unchecked ? "Not tested yet"
             : isOk ? `Online · ${fmtMs(data.latencyMs)}`
             : "Offline / Error"}
          </span>
        </div>

        <button
          onClick={onCheck}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 h-8 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-60 shadow-2xs"
        >
          <RefreshCcw size={11} className={loading ? "animate-spin" : ""} />
          <span>{loading ? "Checking…" : lastChecked ? "Re-test" : "Test"}</span>
        </button>
      </div>

      {/* Error Detail */}
      {data?.error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-2 font-mono text-xs text-rose-600 break-all">
          {data.error}
        </div>
      )}

      {/* Last checked timestamp */}
      <div className="mt-3 text-[11px] text-slate-400 font-medium">
        {lastChecked ? `Last tested ${fmtDate(lastChecked)}` : "Not checked this session"}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 text-slate-500">
      <Icon size={12} className="text-slate-400" />
      <span className="text-[11px] font-medium">{label}:</span>
      <span className="font-bold text-slate-800 text-xs font-mono">{value}</span>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
    </span>
  )
}
