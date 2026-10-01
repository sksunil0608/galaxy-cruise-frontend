"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Play,
  RefreshCcw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Sparkles,
  Terminal,
  XCircle,
  Zap,
  Calendar,
  Compass,
  Check
} from "lucide-react"

import {
  checkAllVendorAuth,
  checkVendorAuth,
  getScraperVendorLastRuns,
  getVendorSchedules,
  triggerVendorScrapeFetch
} from "../api"

const fmtDT = (v) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Never run"

const fmtMs = (v) =>
  v == null || Number.isNaN(v) ? "--" : v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}s`

const VENDOR_NAMES = {
  gohal: { name: "Holland America", code: "gohal", brandColor: "bg-amber-600" },
  completecruisesolutionA: { name: "CCS - P&O / Cunard", code: "CCS-A", brandColor: "bg-indigo-700" },
  completecruisesolutionB: { name: "CCS - Princess", code: "CCS-B", brandColor: "bg-blue-700" },
  msc: { name: "MSC Cruises", code: "msc", brandColor: "bg-blue-600" },
  goccl: { name: "Carnival Cruise Line", code: "goccl", brandColor: "bg-rose-600" },
  seawebagents: { name: "SeaWeb Agents", code: "seaweb", brandColor: "bg-teal-700" },
  celestyal: { name: "Celestyal Cruises", code: "celestyal", brandColor: "bg-cyan-600" },
  azamara: { name: "Azamara Cruises", code: "azamara", brandColor: "bg-slate-800" },
  firstmates: { name: "Virgin Voyages", code: "firstmates", brandColor: "bg-red-600" },
  cruisingpower: { name: "Cruising Power (RCI)", code: "cruising", brandColor: "bg-sky-600" }
}

function runStatusStyle(status) {
  if (status === "completed" || status === "success")
    return "bg-emerald-50 text-emerald-700 border border-emerald-200"
  if (status === "running" || status === "queued")
    return "bg-sky-50 text-sky-700 border border-sky-200 animate-pulse"
  if (status === "failed" || status === "error")
    return "bg-rose-50 text-rose-700 border border-rose-200"
  return "bg-slate-100 text-slate-600 border border-slate-200"
}

function authStatusStyle(status) {
  if (status === "ok") return "bg-emerald-50 text-emerald-700 border border-emerald-200"
  if (status === "skipped") return "bg-slate-100 text-slate-500 border border-slate-200"
  if (status === "checking") return "bg-sky-50 text-sky-700 border border-sky-200 animate-pulse"
  return "bg-rose-50 text-rose-700 border border-rose-200"
}

const DEFAULT_PRODUCTION_SCHEDULES = [
  { vendorKey: "gohal", intervalDays: 1, horizonDays: 30, startHour: 2, enabled: true },
  { vendorKey: "completecruisesolutionA", intervalDays: 1, horizonDays: 60, startHour: 3, enabled: true },
  { vendorKey: "completecruisesolutionB", intervalDays: 1, horizonDays: 60, startHour: 4, enabled: true },
  { vendorKey: "msc", intervalDays: 2, horizonDays: 30, startHour: 5, enabled: true },
  { vendorKey: "goccl", intervalDays: 2, horizonDays: 30, startHour: 6, enabled: true },
  { vendorKey: "seawebagents", intervalDays: 3, horizonDays: 14, startHour: 7, enabled: true },
  { vendorKey: "celestyal", intervalDays: 1, horizonDays: 90, startHour: 8, enabled: true },
  { vendorKey: "azamara", intervalDays: 1, horizonDays: 90, startHour: 9, enabled: true },
  { vendorKey: "firstmates", intervalDays: 2, horizonDays: 60, startHour: 10, enabled: true },
  { vendorKey: "cruisingpower", intervalDays: 2, horizonDays: 60, startHour: 11, enabled: true }
]

export default function OpsConsolePage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [scraperRuns, setScraperRuns] = useState([])
  const [schedules, setSchedules] = useState([])
  const [authResults, setAuthResults] = useState({})
  const [authRunning, setAuthRunning] = useState(false)
  const [triggerState, setTriggerState] = useState({})
  const [runningVendor, setRunningVendor] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState("all") // 'all' | 'healthy' | 'ship_search'

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const [scraperRunsRes, schedulesRes] = await Promise.all([
        getScraperVendorLastRuns().catch(() => ({ vendors: [] })),
        getVendorSchedules().catch(() => ({ schedules: [] }))
      ])

      const runs = scraperRunsRes.vendors ?? []
      const schs = schedulesRes.schedules?.length ? schedulesRes.schedules : DEFAULT_PRODUCTION_SCHEDULES

      setScraperRuns(runs)
      setSchedules(schs)
      setLastChecked(new Date())

      if (isRefresh) {
        setRunningVendor(null)
        setTriggerState({})
      }
    } catch (err) {
      console.error("Failed to load ops data:", err)
      setSchedules(DEFAULT_PRODUCTION_SCHEDULES)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function runAuthCheck() {
    setAuthRunning(true)
    const effectiveSchedules = schedules.length ? schedules : DEFAULT_PRODUCTION_SCHEDULES
    const checking = {}
    for (const vendorKey of new Set(effectiveSchedules.map((s) => s.vendorKey)))
      checking[vendorKey] = { status: "checking" }
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
    if (runningVendor) return
    setRunningVendor(vendorKey)
    setTriggerState((prev) => ({ ...prev, [vendorKey]: { loading: true } }))
    try {
      const res = await triggerVendorScrapeFetch(vendorKey, options)
      const ok = res.httpStatus === 202 || res.result?.status === "queued"
      setTriggerState((prev) => ({
        ...prev,
        [vendorKey]: {
          loading: false,
          ok,
          msg: res.result?.status ?? (ok ? "Queued in worker" : res.error ?? "Triggered")
        }
      }))
      if (!ok) setRunningVendor(null)
    } catch (err) {
      setTriggerState((prev) => ({
        ...prev,
        [vendorKey]: { loading: false, ok: false, msg: err.message }
      }))
      setRunningVendor(null)
    }
  }

  const isGloballyLocked = runningVendor !== null

  const vendorCards = useMemo(() => {
    const list = schedules.length ? schedules : DEFAULT_PRODUCTION_SCHEDULES
    const byVendor = new Map()
    for (const sch of list) {
      if (!byVendor.has(sch.vendorKey)) byVendor.set(sch.vendorKey, sch)
    }
    return [...byVendor.values()].map((sch) => {
      const scraperRun = scraperRuns.find((v) => v.key === sch.vendorKey)
      return {
        ...sch,
        lastRun: scraperRun?.lastRun ?? null,
        auth: authResults[sch.vendorKey] ?? null,
        trigger: triggerState[sch.vendorKey] ?? null
      }
    })
  }, [schedules, scraperRuns, authResults, triggerState])

  const filteredCards = useMemo(() => {
    return vendorCards.filter((card) => {
      const info = VENDOR_NAMES[card.vendorKey] || {}
      const searchMatch =
        !searchQuery.trim() ||
        card.vendorKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (info.name && info.name.toLowerCase().includes(searchQuery.toLowerCase()))

      if (!searchMatch) return false

      if (filterMode === "ship_search") {
        return SHIP_SEARCH_VENDORS.has(card.vendorKey)
      }
      if (filterMode === "auth_ok") {
        return card.auth?.status === "ok"
      }
      return true
    })
  }, [vendorCards, searchQuery, filterMode])

  function scrollToVendorCard(vendorKey) {
    window.history.pushState(null, "", `#${vendorKey}`)
    document.getElementById(`vendor-card-${vendorKey}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  useEffect(() => {
    if (loading) return
    const vendorKey = window.location.hash.slice(1)
    if (!vendorKey) return
    document.getElementById(`vendor-card-${vendorKey}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [loading])

  return (
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-6 py-5 space-y-5">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-teal-200/80 bg-white px-2.5 py-0.5 text-[11px] font-bold text-teal-800 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
              </span>
              <span>Worker Node Active · Scraper Orchestrator</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Scraper Fleet & Extraction Ops Console
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
              Trigger manual scraping runs, test authentication tokens, narrow crawls by ship vessel, and inspect live extraction queues.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => loadData(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
            >
              <RefreshCcw className={`size-3.5 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Refreshing..." : "Refresh Status"}</span>
            </button>

            <button
              onClick={runAuthCheck}
              disabled={authRunning}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="size-4" />
              <span>{authRunning ? "Checking All Auth…" : "Verify All Vendor Auth"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Search and Filter Toolbar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search scrapers by vendor or brand name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8.5 pl-8 pr-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-teal-600 outline-none transition shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterMode("all")}
            className={`h-8 px-3 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ${
              filterMode === "all"
                ? "bg-teal-700 text-white border border-teal-700"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            All Scrapers ({vendorCards.length})
          </button>

          <button
            onClick={() => setFilterMode("ship_search")}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ${
              filterMode === "ship_search"
                ? "bg-teal-700 text-white border border-teal-700"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Ship className="size-3.5" />
            <span>Ship Filter Capable</span>
          </button>

          <Link
            href="/dashboard/vendor-sites"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition"
          >
            <span>Vendor Sites</span>
            <ExternalLink className="size-3 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* ── Quick Jump Bar ──────────────────────────────────────────────────── */}
      <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
          <Compass className="size-3.5 text-teal-700" />
          Quick Jump:
        </span>
        {vendorCards.map((v) => {
          const info = VENDOR_NAMES[v.vendorKey] || { name: v.vendorKey }
          return (
            <button
              key={v.vendorKey}
              onClick={() => scrollToVendorCard(v.vendorKey)}
              className="h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-200 text-xs font-medium text-slate-700 transition cursor-pointer"
            >
              {info.name}
            </button>
          )
        })}
      </div>

      {/* ── Vendor Scraper Cards Grid ───────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-xs font-medium text-slate-400 flex flex-col items-center justify-center gap-2">
          <RefreshCcw className="size-5 animate-spin text-teal-700" />
          <span>Loading scraper cluster status...</span>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="py-20 text-center text-xs text-slate-400 font-medium">
          No scrapers matching your search criteria.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCards.map((v) => (
            <div key={v.vendorKey} id={`vendor-card-${v.vendorKey}`} className="scroll-mt-20">
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
  )
}

const DURATION_OPTIONS = [
  { label: "1 Day", horizonDays: 1 },
  { label: "7 Days", horizonDays: 7 },
  { label: "30 Days", horizonDays: 30 },
  { label: "3 Months", horizonDays: 90 }
]

const SHIP_SEARCH_VENDORS = new Set([
  "gohal",
  "completecruisesolutionA",
  "completecruisesolutionB",
  "msc",
  "goccl",
  "seawebagents",
  "celestyal",
  "azamara",
  "firstmates",
  "cruisingpower"
])

const todayISO = () => new Date().toISOString().slice(0, 10)

function VendorCard({ vendor, onTrigger, globalLocked }) {
  const { vendorKey, intervalDays, horizonDays, startHour, enabled, lastRun, auth, trigger } = vendor
  const info = VENDOR_NAMES[vendorKey] || { name: vendorKey, code: vendorKey.slice(0, 2).toUpperCase(), brandColor: "bg-teal-700" }

  const [runDate, setRunDate] = useState(todayISO)
  const [runHorizon, setRunHorizon] = useState(horizonDays || 30)
  const [shipName, setShipName] = useState("")

  const supportsShipSearch = SHIP_SEARCH_VENDORS.has(vendorKey)
  const lastRunTime = lastRun?.finishedAt ?? lastRun?.startedAt ?? null
  const lastRunStatus = lastRun?.status ?? null

  function handleRun() {
    const trimmedShip = shipName.trim()
    const shipActive = supportsShipSearch && !!trimmedShip
    onTrigger({
      startDate: runDate,
      horizonDays: runHorizon,
      ...(shipActive ? { shipName: trimmedShip } : {}),
      ...(shipActive &&
      (vendorKey === "msc" || vendorKey === "goccl" || vendorKey === "cruisingpower")
        ? { withDecks: true }
        : {}),
      ...(shipActive && vendorKey === "seawebagents" ? { listOnly: false } : {})
    })
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all duration-200">
      <div>
        {/* Title & Auth Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${info.brandColor} text-white font-bold text-xs uppercase shadow-2xs`}
            >
              {info.code.slice(0, 3)}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                {info.name}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5 font-mono">
                {vendorKey} · Every {intervalDays}d · {String(startHour).padStart(2, "0")}:00 UTC
              </div>
            </div>
          </div>

          {auth && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${authStatusStyle(
                auth.status
              )}`}
            >
              {auth.status === "ok" ? (
                <>
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  <span>Auth OK</span>
                </>
              ) : auth.status === "checking" ? (
                "Checking..."
              ) : (
                auth.status
              )}
            </span>
          )}
        </div>

        {/* Last Run Information Bar */}
        <div className="mt-3.5 rounded-lg bg-slate-50/80 border border-slate-100 p-3 text-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-medium text-slate-600">Last Extraction Run:</span>
            {lastRunStatus && (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${runStatusStyle(
                  lastRunStatus
                )}`}
              >
                {lastRunStatus}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-bold text-slate-900">{fmtDT(lastRunTime)}</span>
            <span className="text-[11px] text-slate-500 font-mono">
              Duration: {fmtMs(lastRun?.durationMs)}
            </span>
          </div>
        </div>

        {/* Trigger Options Configuration */}
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="size-3.5 text-slate-400" />
              <span>Start Date:</span>
            </label>
            <input
              type="date"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-teal-600 outline-none shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Search Horizon:</span>
              <span className="text-[10px] text-slate-400 font-normal">Active: {runHorizon} Days</span>
            </label>
            <div className="grid grid-cols-4 gap-1">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.horizonDays}
                  type="button"
                  onClick={() => setRunHorizon(opt.horizonDays)}
                  className={`h-7 rounded-md text-xs font-bold transition shadow-2xs cursor-pointer ${
                    runHorizon === opt.horizonDays
                      ? "bg-teal-700 text-white border border-teal-700"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {supportsShipSearch && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Ship className="size-3.5 text-teal-700" />
                <span>Narrow to Single Ship (Optional):</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Britannia, MSC Virtuosa..."
                value={shipName}
                onChange={(e) => setShipName(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-teal-600 outline-none shadow-2xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">
        {trigger?.msg && (
          <div
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              trigger.ok
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {trigger.msg}
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={trigger?.loading || globalLocked}
          className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-xs font-bold text-white shadow-xs transition active:scale-98 disabled:opacity-50 cursor-pointer"
        >
          <Play className={`size-3.5 ${trigger?.loading ? "animate-spin" : ""}`} />
          <span>{trigger?.loading ? "Starting Scraper Worker…" : "Trigger Scraper Run"}</span>
        </button>
      </div>
    </div>
  )
}
