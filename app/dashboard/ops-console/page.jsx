"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
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
  Check,
  Cpu,
  Radio,
  X
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
  gohal: { 
    name: "Holland America", 
    code: "gohal", 
    gradient: "from-amber-500 to-amber-700",
    accent: "#d97706"
  },
  completecruisesolutionA: { 
    name: "CCS - P&O / Cunard", 
    code: "CCS-A", 
    gradient: "from-indigo-600 to-indigo-800",
    accent: "#4338ca"
  },
  completecruisesolutionB: { 
    name: "CCS - Princess", 
    code: "CCS-B", 
    gradient: "from-blue-600 to-blue-800",
    accent: "#1d4ed8"
  },
  msc: { 
    name: "MSC Cruises", 
    code: "msc", 
    gradient: "from-sky-500 to-blue-700",
    accent: "#0284c7"
  },
  goccl: { 
    name: "Carnival Cruise Line", 
    code: "goccl", 
    gradient: "from-rose-500 to-rose-700",
    accent: "#e11d48"
  },
  seawebagents: { 
    name: "SeaWeb Agents", 
    code: "seaweb", 
    gradient: "from-teal-600 to-teal-800",
    accent: "#0f766e"
  },
  celestyal: { 
    name: "Celestyal Cruises", 
    code: "celestyal", 
    gradient: "from-cyan-500 to-teal-700",
    accent: "#0891b2"
  },
  azamara: { 
    name: "Azamara Cruises", 
    code: "azamara", 
    gradient: "from-slate-700 to-slate-900",
    accent: "#334155"
  },
  firstmates: { 
    name: "Virgin Voyages", 
    code: "firstmates", 
    gradient: "from-red-500 to-rose-800",
    accent: "#dc2626"
  },
  cruisingpower: { 
    name: "Cruising Power (RCI)", 
    code: "cruising", 
    gradient: "from-sky-500 to-indigo-700",
    accent: "#0ea5e9"
  }
}

function runStatusStyle(status) {
  if (status === "completed" || status === "success")
    return "bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
  if (status === "running" || status === "queued")
    return "bg-sky-50 text-sky-700 border border-sky-200 animate-pulse font-semibold"
  if (status === "failed" || status === "error")
    return "bg-rose-50 text-rose-700 border border-rose-200 font-semibold"
  return "bg-white/80 text-slate-600 border border-slate-200 font-semibold"
}

function authStatusStyle(status) {
  if (status === "ok") return "bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs"
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
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [filterMode, setFilterMode] = useState("all") // 'all' | 'ship_search' | 'auth_ok'

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
          msg: res.result?.status ?? (ok ? "Queued in worker engine" : res.error ?? "Triggered")
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
        !debouncedSearchQuery.trim() ||
        card.vendorKey.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        (info.name && info.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))

      if (!searchMatch) return false

      if (filterMode === "ship_search") {
        return SHIP_SEARCH_VENDORS.has(card.vendorKey)
      }
      if (filterMode === "auth_ok") {
        return card.auth?.status === "ok"
      }
      return true
    })
  }, [vendorCards, debouncedSearchQuery, filterMode])

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
    <div className="w-full min-h-screen bg-[#f8fafc] px-4 sm:px-7 py-6 space-y-6">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/90 backdrop-blur-xs px-3 py-0.5 text-[11px] font-bold text-teal-800 shadow-2xs">
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

      {/* ── Search and Filter Suite ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 p-3 sm:p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by vendor name (e.g. Holland America, MSC)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9.5 pl-9.5 pr-8 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterMode("all")}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
              filterMode === "all"
                ? "bg-teal-800 text-white shadow-sm shadow-teal-900/15"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            All Scrapers ({vendorCards.length})
          </button>

          <button
            onClick={() => setFilterMode("ship_search")}
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
              filterMode === "ship_search"
                ? "bg-teal-800 text-white shadow-sm shadow-teal-900/15"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Ship className="size-3.5" />
            <span>Ship Filter Capable</span>
          </button>

          <Link
            href="/dashboard/vendor-sites"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition"
          >
            <span>Vendor Sites</span>
            <ExternalLink className="size-3 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* ── Quick Jump Bar ─────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1.5">
          <Compass className="size-3.5 text-teal-700" />
          Quick Jump:
        </span>
        {vendorCards.map((v) => {
          const info = VENDOR_NAMES[v.vendorKey] || { name: v.vendorKey, accent: "#0d9488" }
          return (
            <button
              key={v.vendorKey}
              onClick={() => scrollToVendorCard(v.vendorKey)}
              className="group inline-flex items-center gap-1.5 h-7.5 px-3 rounded-lg border border-slate-200/80 bg-slate-50 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 text-xs font-semibold text-slate-700 transition active:scale-95 cursor-pointer shadow-2xs"
            >
              <span
                className="h-2 w-2 rounded-full transition-transform group-hover:scale-125"
                style={{ backgroundColor: info.accent }}
              />
              <span>{info.name}</span>
            </button>
          )
        })}
      </div>

      {/* ── Vendor Scraper Cards Grid ──────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 text-center text-xs font-medium text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCcw className="size-6 animate-spin text-teal-700" />
          <span className="font-semibold text-slate-600">Connecting to Scraper Cluster Telemetry...</span>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="py-24 text-center rounded-2xl border border-slate-200 bg-white p-8 space-y-2">
          <Search className="size-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No scrapers match your search criteria</p>
          <p className="text-xs text-slate-400">Try clearing the search query or changing your filter.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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
  const info = VENDOR_NAMES[vendorKey] || { 
    name: vendorKey, 
    code: vendorKey.slice(0, 2).toUpperCase(), 
    gradient: "from-teal-600 to-teal-800",
    accent: "#0d9488"
  }

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
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-6px_rgba(15,23,42,0.1)] hover:border-teal-500/40 transition-all duration-250">
      <div className="space-y-4">
        {/* Title, Brand Badge & Live Auth Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${info.gradient} text-white font-black text-xs tracking-wider uppercase shadow-md`}
            >
              {info.code.slice(0, 3)}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm sm:text-base tracking-tight leading-tight">
                {info.name}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-0.5">
                <span className="font-mono font-semibold text-slate-600">{vendorKey}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3 text-slate-400" />
                  Every {intervalDays}d · {String(startHour).padStart(2, "0")}:00 UTC
                </span>
              </div>
            </div>
          </div>

          {auth && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${authStatusStyle(
                auth.status
              )}`}
            >
              {auth.status === "ok" ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
                  </span>
                  <span>Auth OK</span>
                </>
              ) : auth.status === "checking" ? (
                "Checking…"
              ) : (
                <>
                  <AlertTriangle className="size-3 text-rose-600" />
                  <span>{auth.status}</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Telemetry / Last Run Box */}
        <div className="rounded-xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-3.5 text-xs shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider">
              Last Extraction Run
            </span>
            {lastRunStatus ? (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${runStatusStyle(
                  lastRunStatus
                )}`}
              >
                {lastRunStatus}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-slate-500 bg-white/90 px-2 py-0.5 rounded border border-slate-200 uppercase">
                Never run
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3 text-teal-700" />
              <span className="font-bold text-slate-900 text-xs">{fmtDT(lastRunTime)}</span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-700 bg-white/90 px-2 py-0.5 rounded-md border border-teal-200/80 shadow-2xs">
              Duration: {fmtMs(lastRun?.durationMs)}
            </span>
          </div>
        </div>

        {/* Trigger Controls Configuration */}
        <div className="space-y-3.5 pt-1">
          {/* Start Date */}
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="size-3.5 text-slate-400" />
              <span>Start Date:</span>
            </label>
            <input
              type="date"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
              className="h-8.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 outline-none transition shadow-2xs cursor-pointer"
            />
          </div>

          {/* Search Horizon Segmented Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Search Horizon:</span>
              <span className="text-[10.5px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                {runHorizon} Days
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.horizonDays}
                  type="button"
                  onClick={() => setRunHorizon(opt.horizonDays)}
                  className={`h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                    runHorizon === opt.horizonDays
                      ? "bg-teal-800 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Ship Filter */}
          {supportsShipSearch && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Ship className="size-3.5 text-teal-700" />
                <span>Target Single Ship (Optional):</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Britannia, MSC Virtuosa..."
                  value={shipName}
                  onChange={(e) => setShipName(e.target.value)}
                  className="w-full h-8.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 outline-none transition shadow-2xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 space-y-2.5">
        {trigger?.msg && (
          <div
            className={`rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 ${
              trigger.ok
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {trigger.ok ? (
              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="size-3.5 text-rose-600 shrink-0" />
            )}
            <span className="truncate">{trigger.msg}</span>
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={trigger?.loading || globalLocked}
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-800 via-teal-700 to-teal-800 hover:from-teal-900 hover:to-teal-800 text-xs font-bold text-white shadow-md shadow-teal-900/15 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
        >
          <Play className={`size-3.5 text-teal-200 ${trigger?.loading ? "animate-spin" : ""}`} />
          <span>{trigger?.loading ? "Deploying Scraper Task…" : "Trigger Scraper Run"}</span>
        </button>
      </div>
    </div>
  )
}
