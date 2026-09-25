"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Play,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle
} from "lucide-react"

import {
  checkAllVendorAuth,
  getScraperVendorLastRuns,
  getVendorSchedules,
  triggerVendorScrapeFetch
} from "../api"

const fmtDT = v =>
  v
    ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "--"

const fmtMs = v =>
  v == null || Number.isNaN(v) ? "--" : v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}s`

function runStatusStyle(status) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700"
  if (status === "running" || status === "queued") return "bg-sky-100 text-sky-700"
  if (status === "failed") return "bg-rose-100 text-rose-700"
  return "bg-slate-100 text-slate-600"
}

function authStatusStyle(status) {
  if (status === "ok")       return "bg-emerald-100 text-emerald-700"
  if (status === "skipped")  return "bg-slate-100 text-slate-500"
  if (status === "checking") return "bg-sky-100 text-sky-600"
  return "bg-rose-100 text-rose-700"
}

export default function OpsConsolePage() {
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [scraperRuns, setScraperRuns]   = useState([])
  const [schedules, setSchedules]       = useState([])
  const [authResults, setAuthResults]   = useState({})
  const [authRunning, setAuthRunning]   = useState(false)
  const [triggerState, setTriggerState] = useState({})
  const [runningVendor, setRunningVendor] = useState(null) // locked until refresh or error
  const [lastChecked, setLastChecked]   = useState(null)

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const [scraperRunsRes, schedulesRes] = await Promise.all([
        getScraperVendorLastRuns().catch(() => ({ vendors: [] })),
        getVendorSchedules().catch(() => ({ schedules: [] }))
      ])

      setScraperRuns(scraperRunsRes.vendors ?? [])
      setSchedules(schedulesRes.schedules ?? [])
      setLastChecked(new Date())
      // clear the run lock when user explicitly refreshes
      if (isRefresh) {
        setRunningVendor(null)
        setTriggerState({})
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function runAuthCheck() {
    setAuthRunning(true)
    const checking = {}
    for (const vendorKey of new Set(schedules.map(s => s.vendorKey))) checking[vendorKey] = { status: "checking" }
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

  async function triggerVendor(vendorKey, options = {}) {
    if (runningVendor) return // already locked
    setRunningVendor(vendorKey)
    setTriggerState(prev => ({ ...prev, [vendorKey]: { loading: true } }))
    try {
      const res = await triggerVendorScrapeFetch(vendorKey, options)
      const ok  = res.httpStatus === 202 || res.result?.status === "queued"
      setTriggerState(prev => ({
        ...prev,
        [vendorKey]: { loading: false, ok, msg: res.result?.status ?? (ok ? "queued" : res.error ?? "Triggered") }
      }))
      if (!ok) setRunningVendor(null)
    } catch (err) {
      setTriggerState(prev => ({
        ...prev,
        [vendorKey]: { loading: false, ok: false, msg: err.message }
      }))
      setRunningVendor(null)
    }
  }

  const isGloballyLocked = runningVendor !== null

  // scheduler.js registers multiple date-tiers per vendor (e.g. "gohal near",
  // "gohal far") — group down to one card per unique vendorKey so the console
  // shows exactly the 10 real vendors, not 26 schedule tiers.
  const vendorCards = useMemo(() => {
    const byVendor = new Map()
    for (const sch of schedules) {
      if (!byVendor.has(sch.vendorKey)) byVendor.set(sch.vendorKey, sch)
    }
    return [...byVendor.values()].map(sch => {
      const scraperRun = scraperRuns.find(v => v.key === sch.vendorKey)
      return {
        ...sch,
        lastRun: scraperRun?.lastRun ?? null,
        auth:    authResults[sch.vendorKey] ?? null,
        trigger: triggerState[sch.vendorKey] ?? null
      }
    })
  }, [schedules, scraperRuns, authResults, triggerState])

  function scrollToVendorCard(vendorKey) {
    // Sets a real, shareable/bookmarkable URL (#vendorKey) instead of just
    // scrolling — pushState avoids adding a back-button entry per click.
    window.history.pushState(null, "", `#${vendorKey}`)
    document.getElementById(`vendor-card-${vendorKey}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // Deep-link support: opening /dashboard/ops-console#gohal jumps straight to
  // that vendor's card once the cards have rendered.
  useEffect(() => {
    if (loading) return
    const vendorKey = window.location.hash.slice(1)
    if (!vendorKey) return
    document.getElementById(`vendor-card-${vendorKey}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [loading])

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-4">
      <div className="mx-auto max-w-[1280px] space-y-6">

        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Operations Console</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Scraper fleet management</h1>
          <p className="mt-2 text-sm text-slate-500">
            Authentication status, last run times, and manual triggers for all vendor scrapers.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => loadData(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw size={15} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={runAuthCheck}
            disabled={authRunning}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <ShieldCheck size={15} />
            {authRunning ? "Checking auth…" : "Check All Auth"}
          </button>
          {lastChecked && (
            <span className="text-xs text-slate-400">Loaded {fmtDT(lastChecked)}</span>
          )}
        </div>

        {/* Quick jump links — click a vendor to scroll straight to its card.
            Real vendor-site login links now live on their own page. */}
        {!loading && vendorCards.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-1">Jump to:</span>
            {vendorCards.map(v => (
              <button
                key={v.vendorKey}
                onClick={() => scrollToVendorCard(v.vendorKey)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                {v.vendorKey}
              </button>
            ))}
            <a
              href="/dashboard/vendor-sites"
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              <ExternalLink size={12} />
              Real vendor sites →
            </a>
          </div>
        )}

        {/* Vendor cards */}
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Loading scrapers…</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vendorCards.map(v => (
              <div key={v.vendorKey} id={`vendor-card-${v.vendorKey}`} className="scroll-mt-6">
                <VendorCard
                  vendor={v}
                  onTrigger={(opts) => triggerVendor(v.vendorKey, opts)}
                  globalLocked={isGloballyLocked}
                />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

const DURATION_OPTIONS = [
  { label: "1 Day",    horizonDays: 1  },
  { label: "7 Days",   horizonDays: 7  },
  { label: "30 Days",  horizonDays: 30 },
  { label: "3 Months", horizonDays: 90 },
]

// Vendors whose search flow can be narrowed to a single ship, via each site's
// own "Ship" dropdown/param on the same form used for the date search.
// gohal/CCS-A/celestyal/azamara/firstmates filter at the search-submit step
// itself; msc/goccl/seawebagents/cruisingpower still bulk-fetch the full date
// range (their list endpoints have no ship param) but narrow the much more
// expensive per-cruise deck/detail pass to just this ship.
const SHIP_SEARCH_VENDORS = new Set([
  "gohal", "completecruisesolutionA", "completecruisesolutionB", "msc", "goccl", "seawebagents",
  "celestyal", "azamara", "firstmates", "cruisingpower",
])

const todayISO = () => new Date().toISOString().slice(0, 10)

function VendorCard({ vendor, onTrigger, globalLocked }) {
  const { vendorKey, intervalDays, horizonDays, startHour, enabled, lastRun, auth, trigger } = vendor

  // Run options — every vendor now takes the same {startDate, horizonDays}
  // shape; the scrapper-backend translates it into whatever each vendor's
  // own scraper actually expects (date range, single sail date, etc).
  const [runDate, setRunDate]           = useState(todayISO)
  const [runHorizon, setRunHorizon]     = useState(30)
  const [shipName, setShipName]         = useState("")

  const supportsShipSearch = SHIP_SEARCH_VENDORS.has(vendorKey)

  const lastRunTime   = lastRun?.finishedAt ?? lastRun?.startedAt ?? null
  const lastRunStatus = lastRun?.status ?? null

  function handleRun() {
    const trimmedShip = shipName.trim()
    const shipActive = supportsShipSearch && !!trimmedShip
    onTrigger({
      startDate: runDate,
      horizonDays: runHorizon,
      ...(shipActive ? { shipName: trimmedShip } : {}),
      // msc/goccl only apply the ship filter inside their per-cruise deck/detail
      // pass — force it on when a ship is requested, since the point of a ship
      // search is the real cabin data, not just the list.
      ...(shipActive && (vendorKey === "msc" || vendorKey === "goccl" || vendorKey === "cruisingpower") ? { withDecks: true } : {}),
      // seawebagents only applies the ship filter in full mode (listOnly skips
      // the per-voyage wizard entirely, before the filter would ever run).
      ...(shipActive && vendorKey === "seawebagents" ? { listOnly: false } : {})
    })
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4">
      {/* Title */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900 text-base">{vendorKey}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Every {intervalDays}d · {horizonDays}d horizon · {String(startHour).padStart(2, "0")}:00 UTC
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {enabled ? "Enabled" : "Paused"}
        </span>
      </div>

      {/* Last run */}
      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Clock size={13} />
          <span>Last run</span>
        </div>
        <div className="flex items-center gap-2">
          {lastRunStatus && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${runStatusStyle(lastRunStatus)}`}>
              {lastRunStatus}
            </span>
          )}
          <span className="font-mono text-xs text-slate-700">{fmtDT(lastRunTime)}</span>
        </div>
      </div>

      {/* Auth status */}
      {auth && (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-500">
            {auth.status === "ok"        ? <ShieldCheck size={13} className="text-emerald-500" />
            : auth.status === "skipped"  ? <ShieldCheck size={13} className="text-slate-400" />
            : auth.status === "checking" ? <RefreshCcw  size={13} className="animate-spin text-sky-500" />
            :                              <ShieldAlert size={13} className="text-rose-500" />}
            <span>Auth</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${authStatusStyle(auth.status)}`}>
              {auth.status}
            </span>
            {auth.latencyMs != null && (
              <span className="font-mono text-xs text-slate-400">{fmtMs(auth.latencyMs)}</span>
            )}
          </div>
        </div>
      )}

      {auth?.status === "error" && auth.error && (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 font-mono">
          {auth.error}
        </div>
      )}

      {/* Run options panel — date + duration, same for every vendor */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col gap-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Run options</div>

        {/* Start date */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500 w-20 shrink-0">Start date</label>
          <input
            type="date"
            value={runDate}
            min={todayISO()}
            onChange={e => setRunDate(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-slate-400"
          />
        </div>

        {/* Duration pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 w-20 shrink-0">Duration</span>
          <div className="flex gap-1 flex-wrap">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.horizonDays}
                onClick={() => setRunHorizon(opt.horizonDays)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  runHorizon === opt.horizonDays
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ship name filter — only for vendors whose search flow supports it */}
        {supportsShipSearch && (
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-500 w-20 shrink-0">Ship</label>
            <input
              type="text"
              value={shipName}
              onChange={e => setShipName(e.target.value)}
              placeholder="e.g. ROTTERDAM (optional)"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-slate-400"
            />
          </div>
        )}
        {supportsShipSearch && shipName.trim() && (
          <div className="text-[11px] text-slate-400 -mt-1">
            Narrows to "{shipName.trim()}" only — much lighter than a full date-window run.
          </div>
        )}

      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={globalLocked}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-white transition disabled:opacity-60"
      >
        <Play size={14} className={trigger?.loading ? "animate-pulse" : ""} />
        {trigger?.loading ? "Queuing…" : (globalLocked && !trigger) ? "Locked" : "Run Now"}
      </button>

      {trigger && !trigger.loading && (
        <div className={`text-xs text-center font-medium ${trigger.ok ? "text-emerald-600" : "text-rose-600"}`}>
          {trigger.ok
            ? <CheckCircle2 size={12} className="inline mr-1" />
            : <XCircle      size={12} className="inline mr-1" />}
          {trigger.msg}
        </div>
      )}
    </div>
  )
}
