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
  if (status === "completed") return "bg-emerald-100 text-emerald-700"
  if (status === "running" || status === "queued") return "bg-sky-100 text-sky-700"
  if (status === "failed") return "bg-rose-100 text-rose-700"
  return "bg-slate-100 text-slate-600"
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getDaysAgo = value => {
  if (!value) return null
  const diff = Date.now() - new Date(value).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

const freshnessStatus = daysAgo => {
  if (daysAgo === null) return { label: "Stale",  bg: "bg-rose-100",    text: "text-rose-700",    bar: "bg-rose-500" }
  if (daysAgo <= 60)    return { label: "Fresh",  bg: "bg-emerald-100", text: "text-emerald-700", bar: "bg-emerald-500" }
  if (daysAgo <= 90)    return { label: "Aging",  bg: "bg-amber-100",   text: "text-amber-700",   bar: "bg-amber-500" }
  return                       { label: "Stale",  bg: "bg-rose-100",    text: "text-rose-700",    bar: "bg-rose-500" }
}

const fmtDate = v =>
  v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"

const fmtMs = v => (v == null ? "--" : `${v}ms`)

// ── Session-level cache so results survive navigation but not a hard refresh ──
const CACHE_KEY = "ops_health_checks"

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    // Revive date strings
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

// Initial per-service state shape: { data, lastChecked, loading }
const EMPTY = { data: null, lastChecked: null, loading: false }

export default function OperationalHealthPage() {
  const [vendorLoading, setVendorLoading] = useState(true)
  const [vendorStatus,  setVendorStatus]  = useState([])

  // Per-service states — hydrated from cache on first render
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

  // Vendor freshness auto-loads (cheap DB query, no external ping)
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

  // ── Individual check functions ────────────────────────────────────────────────
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

  // ── Issues log ───────────────────────────────────────────────────────────────
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
        service: "Scrapper Backend",
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
    <div className="min-h-screen bg-slate-50 px-6 py-4">
      <div className="mx-auto max-w-[1180px] space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Operational Health</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Backend status and data freshness</h1>
          <p className="mt-2 text-sm text-slate-500">
            Manually check backend connectivity — results are stored for your session. Vendor data freshness loads automatically from the database.
          </p>
        </div>

        {/* ── Service cards ───────────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          <ServiceCard
            label="Main Backend (cruisesaga.backend)"
            description="Cruise database, pricing API, user management"
            svc={mainSvc}
            onCheck={checkMain}
          />
          <ServiceCard
            label="Scrapper Backend"
            description="Vendor scrapers, cabin refresh, schedule runner"
            svc={scraperSvc}
            onCheck={checkScraper}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={checkAll}
            disabled={anyLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={15} className={anyLoading ? "animate-spin" : ""} />
            Check All
          </button>
        </div>

        {/* ── Issues log ─────────────────────────────────────────────────── */}
        {issues.length > 0 && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-base font-semibold text-rose-800">
              <AlertTriangle size={17} />
              Active issues detected
            </div>
            <div className="mt-4 space-y-3">
              {issues.map((issue, i) => (
                <div key={i} className="rounded-2xl border border-rose-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-rose-700 text-sm">{issue.service}</span>
                    <span className="text-xs text-slate-400">Detected {fmtDate(issue.checkedAt)}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-rose-600 break-all">{issue.error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Vendor data freshness ───────────────────────────────────────── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">Vendor data freshness</div>
              <div className="mt-1 text-sm text-slate-500">
                How recently each vendor&apos;s cruise data was ingested into the database.
              </div>
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
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 shrink-0"
            >
              <RefreshCcw size={12} className={vendorLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {vendorLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {vendorStatus.map(vendor => (
                  <div key={vendor.vendor_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{vendor.vendor_name}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{vendor.coverageMeta}</div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${vendor.freshness.bg} ${vendor.freshness.text}`}>
                        {vendor.freshness.label}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <Stat icon={CalendarClock} label="Last updated" value={vendor.lastUpdatedLabel} />
                      <Stat icon={Database}      label="Cruises"      value={vendor.cruise_count ?? 0} />
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${vendor.freshness.bar}`}
                        style={{ width: vendor.daysAgo == null ? "100%" : `${Math.max(5, 100 - (vendor.daysAgo / 90) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {vendorStatus.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400">No vendor data available.</div>
              )}

              <div className="mt-6">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overall freshness</div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200 flex">
                  <div className="bg-emerald-500" style={{ width: `${summary.freshPct}%` }} />
                  <div className="bg-amber-500"   style={{ width: `${summary.agingPct}%` }} />
                  <div className="bg-rose-500"    style={{ width: `${summary.stalePct}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                  <LegendDot color="bg-emerald-500" label={`Fresh — ${summary.fresh}`} />
                  <LegendDot color="bg-amber-500"   label={`Aging — ${summary.aging}`} />
                  <LegendDot color="bg-rose-500"    label={`Stale — ${summary.stale}`} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Ingestion run log ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadRuns(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw size={15} className={runsRefreshing ? "animate-spin" : ""} />
            Refresh Run Log
          </button>
          <span className="text-xs text-slate-400">{runs.length} runs loaded</span>
          {runsChecked && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Clock size={12} />
              Last loaded {fmtRunDT(runsChecked)}
            </span>
          )}
        </div>

        {!runsLoading && recentRunErrors.length > 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <AlertTriangle size={18} className="text-rose-500" />
              Recent run failures
            </div>
            <div className="mt-4 space-y-3">
              {recentRunErrors.map(run => (
                <div key={run.id} className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-rose-700">
                      {run.vendor?.name ?? run.vendor?.slug ?? "Unknown"}
                    </span>
                    <span className="text-xs text-slate-400">{fmtRunDT(run.finishedAt)}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-rose-600 leading-5">
                    {run.notes?.slice(0, 300) || "No error details stored."}
                  </p>
                  <div className="mt-2 text-xs text-slate-400">
                    Run #{run.id} · {fmtRunMs(run.responseTimeMs)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">All runs</div>
          <div className="mt-0.5 text-sm text-slate-400 mb-5">Most recent first</div>

          {runsLoading ? (
            <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="space-y-2">
              {runs.map(run => (
                <div
                  key={run.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${runStatusStyle(run.status)}`}>
                      {run.status}
                    </span>
                    <span className="rounded-full bg-sky-50 px-3 py-0.5 text-xs font-medium text-sky-700">
                      {run.vendor?.name ?? run.vendor?.slug ?? "--"}
                    </span>
                    <span className="font-mono text-sm text-slate-700 truncate max-w-sm">
                      {run.notes?.slice(0, 100) || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
                    <span>{fmtRunMs(run.responseTimeMs)}</span>
                    <span>{fmtRunDT(run.finishedAt ?? run.startedAt)}</span>
                  </div>
                </div>
              ))}
              {runs.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">No runs recorded yet.</div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── ServiceCard ───────────────────────────────────────────────────────────────
function ServiceCard({ label, description, svc, onCheck }) {
  const { data, lastChecked, loading } = svc
  const unchecked = data === null && !loading
  const isOk      = data?.ok === true

  const borderBg = unchecked || loading
    ? "border-slate-200 bg-white"
    : isOk
    ? "border-emerald-200 bg-emerald-50"
    : "border-rose-200 bg-rose-50"

  const iconBg    = unchecked || loading ? "bg-slate-100"    : isOk ? "bg-emerald-100"    : "bg-rose-100"
  const iconColor = unchecked || loading ? "text-slate-400"  : isOk ? "text-emerald-600"  : "text-rose-600"
  const badgeCls  = unchecked || loading ? "bg-slate-100 text-slate-500" : isOk ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"

  return (
    <div className={`rounded-3xl border p-6 shadow-sm ${borderBg}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full p-2 ${iconBg}`}>
          <Server size={16} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 text-sm">{label}</div>
          <div className="text-xs text-slate-500 mt-0.5">{description}</div>
        </div>
        <div className="shrink-0">
          {loading
            ? <RefreshCcw size={16} className="animate-spin text-slate-400" />
            : unchecked
            ? null
            : isOk
            ? <CheckCircle2 size={18} className="text-emerald-600" />
            : <CircleAlert  size={18} className="text-rose-600" />}
        </div>
      </div>

      {/* Status badge */}
      <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeCls}`}>
        {!loading && !unchecked && (isOk ? <Wifi size={11} /> : <WifiOff size={11} />)}
        {loading   ? "Checking…"
         : unchecked ? "Not checked yet"
         : isOk     ? `Online · ${fmtMs(data.latencyMs)}`
         : "Offline"}
      </div>

      {/* Error detail */}
      {data?.error && (
        <div className="mt-3 rounded-xl bg-white px-3 py-2 font-mono text-xs text-rose-600 break-all">
          {data.error}
        </div>
      )}

      {/* Footer: last checked + check button */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          {lastChecked ? `Checked ${fmtDate(lastChecked)}` : "Never checked"}
        </span>
        <button
          onClick={onCheck}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw size={11} className={loading ? "animate-spin" : ""} />
          {loading ? "Checking…" : lastChecked ? "Re-check" : "Check"}
        </button>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-slate-500">
      <Icon size={13} />
      <span className="text-xs">{label}:</span>
      <span className="font-semibold text-slate-800 text-xs">{value}</span>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}
