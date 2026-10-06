"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Cpu,
  ExternalLink,
  Filter,
  Layers,
  Play,
  Radio,
  RefreshCcw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Sparkles,
  Terminal,
  Timer,
  X,
  XCircle,
  Zap
} from "lucide-react"

import {
  checkAllVendorAuth,
  checkVendorAuth,
  fetchShips,
  fetchVendors,
  getScraperVendorLastRuns,
  getVendorSchedules,
  triggerVendorScrapeFetch
} from "../api"
import { OpsScraperGridSkeleton } from "@/components/ui/skeleton-patterns"

const fmtDT = (v) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Never run"

const fmtMs = (v) => {
  if (v == null || Number.isNaN(v)) return "--"
  if (v >= 60000) return `${(v / 60000).toFixed(1)}m`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}s`
  return `${v}ms`
}

function timeAgo(date) {
  if (!date) return "Never"
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const VENDOR_NAMES = {
  gohal: {
    name: "Holland America",
    code: "gohal",
    gradient: "from-amber-500 to-amber-700",
    accent: "#d97706",
    supportsShip: true
  },
  completecruisesolutionA: {
    name: "CCS - P&O / Cunard",
    code: "CCS-A",
    gradient: "from-indigo-600 to-indigo-800",
    accent: "#4338ca",
    supportsShip: true
  },
  completecruisesolutionB: {
    name: "CCS - Princess",
    code: "CCS-B",
    gradient: "from-blue-600 to-blue-800",
    accent: "#1d4ed8",
    supportsShip: true
  },
  msc: {
    name: "MSC Cruises",
    code: "msc",
    gradient: "from-sky-500 to-blue-700",
    accent: "#0284c7",
    supportsShip: true
  },
  goccl: {
    name: "Carnival Cruise Line",
    code: "goccl",
    gradient: "from-rose-500 to-rose-700",
    accent: "#e11d48",
    supportsShip: true
  },
  seawebagents: {
    name: "SeaWeb Agents",
    code: "seaweb",
    gradient: "from-teal-600 to-teal-800",
    accent: "#0f766e",
    supportsShip: true
  },
  celestyal: {
    name: "Celestyal Cruises",
    code: "celestyal",
    gradient: "from-cyan-500 to-teal-700",
    accent: "#0891b2",
    supportsShip: true
  },
  azamara: {
    name: "Azamara Cruises",
    code: "azamara",
    gradient: "from-slate-700 to-slate-900",
    accent: "#334155",
    supportsShip: true
  },
  firstmates: {
    name: "Virgin Voyages",
    code: "firstmates",
    gradient: "from-red-500 to-rose-800",
    accent: "#dc2626",
    supportsShip: true
  },
  cruisingpower: {
    name: "Cruising Power (RCI)",
    code: "cruising",
    gradient: "from-sky-500 to-indigo-700",
    accent: "#0ea5e9",
    supportsShip: true
  }
}

function runStatusStyle(status) {
  const s = String(status || "").toLowerCase()
  if (s === "completed" || s === "success")
    return "bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
  if (s === "running" || s === "queued" || s === "in_progress")
    return "bg-sky-50 text-sky-700 border border-sky-200 animate-pulse font-semibold"
  if (s === "failed" || s === "error")
    return "bg-rose-50 text-rose-700 border border-rose-200 font-semibold"
  return "bg-white/90 text-slate-600 border border-slate-200 font-semibold"
}

function authStatusStyle(status) {
  const s = String(status || "").toLowerCase()
  if (s === "ok") return "bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs"
  if (s === "skipped") return "bg-slate-100 text-slate-500 border border-slate-200"
  if (s === "checking") return "bg-sky-50 text-sky-700 border border-sky-200 animate-pulse"
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

const DURATION_OPTIONS = [
  { label: "1 Day", horizonDays: 1 },
  { label: "7 Days", horizonDays: 7 },
  { label: "30 Days", horizonDays: 30 },
  { label: "3 Mos", horizonDays: 90 },
  { label: "6 Mos", horizonDays: 180 }
]

const todayISO = () => new Date().toISOString().slice(0, 10)

const addDaysISO = (days) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const KNOWN_VENDOR_FLEETS = {
  msc: [
    "MSC Euribia", "MSC Grandiosa", "MSC Bellissima", "MSC Meraviglia", "MSC Meraviglia Plus",
    "MSC Seashore", "MSC Seascape", "MSC Seaside", "MSC Seaview",
    "MSC Virtuosa", "MSC World Europa", "MSC World America", "MSC World Asia",
    "MSC Poesia", "MSC Orchestra", "MSC Musica", "MSC Magnifica",
    "MSC Fantasia", "MSC Splendida", "MSC Divina", "MSC Preziosa",
    "MSC Lirica", "MSC Opera", "MSC Sinfonia", "MSC Armonia"
  ],
  goccl: [
    "Carnival Celebration", "Carnival Jubilee", "Carnival Mardi Gras", "Carnival Panorama",
    "Carnival Horizon", "Carnival Vista", "Carnival Breeze", "Carnival Magic",
    "Carnival Dream", "Carnival Splendor", "Carnival Freedom", "Carnival Liberty",
    "Carnival Valor", "Carnival Miracle", "Carnival Legend", "Carnival Pride",
    "Carnival Spirit", "Carnival Conquest", "Carnival Glory", "Carnival Radiance",
    "Carnival Sunrise", "Carnival Sunshine", "Carnival Elation", "Carnival Paradise",
    "Carnival Venezia", "Carnival Firenze"
  ],
  cruisingpower: [
    "Icon of the Seas", "Star of the Seas", "Utopia of the Seas", "Wonder of the Seas",
    "Symphony of the Seas", "Harmony of the Seas", "Oasis of the Seas", "Allure of the Seas",
    "Odyssey of the Seas", "Spectrum of the Seas", "Anthem of the Seas", "Quantum of the Seas",
    "Navigator of the Seas", "Mariner of the Seas", "Voyager of the Seas", "Adventure of the Seas",
    "Celebrity Ascent", "Celebrity Beyond", "Celebrity Apex", "Celebrity Edge", "Celebrity Xcel",
    "Celebrity Millennium", "Celebrity Infinity", "Celebrity Summit", "Celebrity Constellation",
    "Celebrity Solstice", "Celebrity Equinox", "Celebrity Eclipse", "Celebrity Silhouette", "Celebrity Reflection",
    "Silver Nova", "Silver Ray", "Silver Dawn", "Silver Moon", "Silver Muse", "Silver Origin", "Silver Endeavour"
  ],
  gohal: [
    "Rotterdam", "Nieuw Statendam", "Koningsdam", "Nieuw Amsterdam", "Eurodam",
    "Noordam", "Westerdam", "Oosterdam", "Zuiderdam", "Zaandam", "Volendam"
  ],
  completecruisesolutionA: [
    "Iona", "Arvia", "Britannia", "Azura", "Ventura", "Arcadia", "Aurora",
    "Queen Mary 2", "Queen Victoria", "Queen Elizabeth", "Queen Anne"
  ],
  completecruisesolutionB: [
    "Sun Princess", "Star Princess", "Discovery Princess", "Enchanted Princess",
    "Sky Princess", "Majestic Princess", "Regal Princess", "Royal Princess",
    "Diamond Princess", "Sapphire Princess", "Caribbean Princess", "Crown Princess",
    "Emerald Princess", "Ruby Princess", "Grand Princess", "Island Princess", "Coral Princess"
  ],
  celestyal: [
    "Celestyal Journey", "Celestyal Discovery", "Celestyal Crystal", "Celestyal Olympia"
  ],
  azamara: [
    "Azamara Journey", "Azamara Quest", "Azamara Pursuit", "Azamara Onward"
  ],
  firstmates: [
    "Scarlet Lady", "Valiant Lady", "Resilient Lady", "Brilliant Lady"
  ],
  seawebagents: [
    "Silver Nova", "Silver Ray", "Silver Dawn", "Silver Moon", "Silver Muse",
    "Silver Origin", "Silver Endeavour", "Silver Wind", "Silver Shadow", "Silver Whisper"
  ]
}

export default function OpsConsolePage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [scraperRuns, setScraperRuns] = useState([])
  const [schedules, setSchedules] = useState([])
  const [authResults, setAuthResults] = useState({})
  const [authRunning, setAuthRunning] = useState(false)
  const [singleAuthChecking, setSingleAuthChecking] = useState({})
  const [triggerState, setTriggerState] = useState({})
  const [runningVendor, setRunningVendor] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 250)
  const [filterMode, setFilterMode] = useState("all") // 'all' | 'ship_search' | 'auth_ok' | 'failed' | 'running'

  // Ship & Vendor DB Lookups
  const [dbShips, setDbShips] = useState([])
  const [dbVendors, setDbVendors] = useState([])

  // Live timer tick every 1 second for "updated X ago" and running timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const [scraperRunsRes, schedulesRes, shipsRes, vendorsRes] = await Promise.all([
        getScraperVendorLastRuns().catch(() => ({ vendors: [] })),
        getVendorSchedules().catch(() => ({ schedules: [] })),
        fetchShips({ limit: 500 }).catch(() => []),
        fetchVendors({ limit: 100 }).catch(() => [])
      ])

      const runs = scraperRunsRes.vendors ?? []
      const schs = schedulesRes.schedules?.length ? schedulesRes.schedules : DEFAULT_PRODUCTION_SCHEDULES
      const rawShips = Array.isArray(shipsRes) ? shipsRes : (shipsRes?.data || shipsRes?.ships || [])
      const rawVendors = Array.isArray(vendorsRes) ? vendorsRes : (vendorsRes?.data || vendorsRes?.vendors || [])

      setScraperRuns(runs)
      setSchedules(schs)
      setDbShips(rawShips)
      setDbVendors(rawVendors)
      setLastChecked(new Date())

      if (isRefresh) {
        setRunningVendor(null)
      }
    } catch (err) {
      console.warn("Failed to load ops data:", err?.message || err)
      setSchedules(DEFAULT_PRODUCTION_SCHEDULES)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Active polling while any vendor is running or queued
  const isAnyRunning = useMemo(() => {
    if (runningVendor) return true
    return scraperRuns.some(
      (r) => r?.lastRun?.status === "running" || r?.lastRun?.status === "queued" || r?.lastRun?.status === "in_progress"
    )
  }, [runningVendor, scraperRuns])

  useEffect(() => {
    if (!isAnyRunning) return
    const interval = setInterval(async () => {
      try {
        const res = await getScraperVendorLastRuns().catch(() => ({ vendors: [] }))
        const updatedRuns = res.vendors ?? []
        setScraperRuns(updatedRuns)
        setLastChecked(new Date())

        if (runningVendor) {
          const current = updatedRuns.find((v) => v.key === runningVendor)
          const currentStatus = current?.lastRun?.status?.toLowerCase()
          if (currentStatus === "completed" || currentStatus === "success" || currentStatus === "failed") {
            setRunningVendor(null)
            setTriggerState((prev) => ({
              ...prev,
              [runningVendor]: {
                loading: false,
                ok: currentStatus === "completed" || currentStatus === "success",
                msg: `Scrape finished (${currentStatus}) in ${fmtMs(current?.lastRun?.durationMs)}`
              }
            }))
          }
        }
      } catch {
        // silent background poll error
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [isAnyRunning, runningVendor])

  // Map database ships + official known fleet to each vendor key for quick targeting
  const vendorShipsMap = useMemo(() => {
    const map = {}
    Object.keys(VENDOR_NAMES).forEach((k) => {
      map[k] = [...(KNOWN_VENDOR_FLEETS[k] || [])]
    })

    const vendorIdToKey = {}
    dbVendors.forEach((v) => {
      const slug = (v.slug || v.code || v.key || v.name || "").toLowerCase()
      Object.keys(VENDOR_NAMES).forEach((vk) => {
        const info = VENDOR_NAMES[vk]
        if (
          slug === vk.toLowerCase() ||
          slug === info.code.toLowerCase() ||
          (info.name && (slug.includes(info.name.toLowerCase()) || info.name.toLowerCase().includes(slug)))
        ) {
          vendorIdToKey[v.id] = vk
        }
      })
    })

    dbShips.forEach((ship) => {
      const name = (typeof ship === "string" ? ship : ship?.name || ship?.shipName || ship?.title)?.trim()
      if (!name) return

      let matchedKey = null
      if (ship.vendorId && vendorIdToKey[ship.vendorId]) {
        matchedKey = vendorIdToKey[ship.vendorId]
      } else {
        const vText = `${ship.vendorName || ""} ${ship.cruiseLine || ""} ${ship.vendor || ""} ${name}`.toLowerCase()
        if (vText.includes("holland") || vText.includes("hal") || vText.includes("rotterdam")) matchedKey = "gohal"
        else if (vText.includes("princess")) matchedKey = "completecruisesolutionB"
        else if (vText.includes("p&o") || vText.includes("cunard") || vText.includes("queen mary") || vText.includes("britannia")) matchedKey = "completecruisesolutionA"
        else if (vText.includes("msc")) matchedKey = "msc"
        else if (vText.includes("carnival")) matchedKey = "goccl"
        else if (vText.includes("seaweb") || vText.includes("silversea") || vText.includes("silver ")) matchedKey = "seawebagents"
        else if (vText.includes("celestyal")) matchedKey = "celestyal"
        else if (vText.includes("azamara")) matchedKey = "azamara"
        else if (vText.includes("virgin") || vText.includes("firstmates") || vText.includes("scarlet lady") || vText.includes("valiant lady")) matchedKey = "firstmates"
        else if (vText.includes("royal") || vText.includes("celebrity") || vText.includes("cruising") || vText.includes("of the seas"))
          matchedKey = "cruisingpower"
      }

      if (matchedKey) {
        if (!map[matchedKey]) map[matchedKey] = []
        const exists = map[matchedKey].some((s) => s.toLowerCase() === name.toLowerCase())
        if (!exists) map[matchedKey].push(name)
      }
    })

    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => a.localeCompare(b))
    })

    return map
  }, [dbShips, dbVendors])

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

  async function checkSingleAuth(vendorKey) {
    setSingleAuthChecking((prev) => ({ ...prev, [vendorKey]: true }))
    setAuthResults((prev) => ({ ...prev, [vendorKey]: { status: "checking" } }))
    try {
      const res = await checkVendorAuth(vendorKey)
      setAuthResults((prev) => ({
        ...prev,
        [vendorKey]: {
          status: res?.status || (res?.ok ? "ok" : "failed"),
          latencyMs: res?.latencyMs,
          message: res?.message
        }
      }))
    } catch (err) {
      setAuthResults((prev) => ({
        ...prev,
        [vendorKey]: { status: "failed", message: err?.message || "Auth error" }
      }))
    } finally {
      setSingleAuthChecking((prev) => ({ ...prev, [vendorKey]: false }))
    }
  }

  async function triggerVendor(vendorKey, options = {}) {
    if (runningVendor) return
    setRunningVendor(vendorKey)
    setTriggerState((prev) => ({
      ...prev,
      [vendorKey]: { loading: true, startedAt: Date.now(), msg: null }
    }))

    try {
      const res = await triggerVendorScrapeFetch(vendorKey, options)
      const ok = res.httpStatus === 202 || res.result?.status === "queued" || res.status === "queued"
      setTriggerState((prev) => ({
        ...prev,
        [vendorKey]: {
          loading: false,
          startedAt: prev[vendorKey]?.startedAt,
          ok,
          msg: res.result?.status ?? (ok ? "Queued in live worker engine" : res.error ?? "Triggered")
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
      const availableShips = vendorShipsMap[sch.vendorKey] || []
      const vendorConfig = VENDOR_NAMES[sch.vendorKey] || {}
      return {
        ...sch,
        lastRun: scraperRun?.lastRun ?? null,
        auth: authResults[sch.vendorKey] ?? null,
        trigger: triggerState[sch.vendorKey] ?? null,
        availableShips,
        hasAvailableShips: availableShips.length > 0,
        supportsShipSearch: vendorConfig.supportsShip !== false
      }
    })
  }, [schedules, scraperRuns, authResults, triggerState, vendorShipsMap])

  const filteredCards = useMemo(() => {
    return vendorCards.filter((card) => {
      const info = VENDOR_NAMES[card.vendorKey] || {}
      const searchMatch =
        !debouncedSearchQuery.trim() ||
        card.vendorKey.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        (info.name && info.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))

      if (!searchMatch) return false

      if (filterMode === "ship_search") {
        return card.hasAvailableShips || card.supportsShipSearch
      }
      if (filterMode === "auth_ok") {
        return card.auth?.status === "ok"
      }
      if (filterMode === "failed") {
        return (
          card.lastRun?.status === "failed" ||
          card.lastRun?.status === "error" ||
          card.auth?.status === "failed"
        )
      }
      if (filterMode === "running") {
        return (
          card.lastRun?.status === "running" ||
          card.lastRun?.status === "queued" ||
          runningVendor === card.vendorKey
        )
      }
      return true
    })
  }, [vendorCards, debouncedSearchQuery, filterMode, runningVendor])

  // Summary telemetry metrics
  const stats = useMemo(() => {
    const total = vendorCards.length
    const authOk = vendorCards.filter((v) => v.auth?.status === "ok").length
    const shipsTargetable = vendorCards.filter((v) => v.hasAvailableShips || v.supportsShipSearch).length
    const recentlyFailed = vendorCards.filter(
      (v) => v.lastRun?.status === "failed" || v.lastRun?.status === "error"
    ).length
    const activeRuns = vendorCards.filter(
      (v) => v.lastRun?.status === "running" || v.lastRun?.status === "queued"
    ).length
    return { total, authOk, shipsTargetable, recentlyFailed, activeRuns }
  }, [vendorCards])

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
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/90 backdrop-blur-xs px-3 py-0.5 text-[11px] font-bold text-teal-800 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
                </span>
                <span>Worker Node Active · Scraper Orchestrator</span>
              </div>

              {lastChecked && (
                <span className="text-[11px] font-medium text-slate-500 bg-white/80 border border-slate-200/80 rounded-full px-2.5 py-0.5 shadow-2xs">
                  Updated {timeAgo(lastChecked)}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Scraper Fleet & Extraction Ops Console
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
              Trigger manual extraction runs, target individual vessel ships or full fleet inventories, test vendor credentials, and inspect live worker queues.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <RefreshCcw className={`size-3.5 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Refreshing Data…" : "Refresh Status"}</span>
            </button>

            <button
              onClick={runAuthCheck}
              disabled={authRunning}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className={`size-4 ${authRunning ? "animate-pulse" : ""}`} />
              <span>{authRunning ? "Testing All Auth Credentials…" : "Verify All Vendor Auth"}</span>
            </button>
          </div>
        </div>

        {/* Live Active Scraper Alert Banner */}
        {runningVendor && (
          <div className="mt-4 rounded-xl border border-sky-300 bg-white/95 p-3 shadow-xs flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-600"></span>
              </span>
              <span className="text-xs font-bold text-sky-950">
                Extraction in Progress:{" "}
                <span className="font-mono text-sky-800 font-black">
                  {VENDOR_NAMES[runningVendor]?.name || runningVendor}
                </span>
              </span>
            </div>
            <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
              Live Polling Active (Every 2.5s)
            </span>
          </div>
        )}
      </div>

      {/* ── Metric Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Scrapers</span>
            <Server className="size-4 text-teal-600" />
          </div>
          <div className="mt-1 text-xl font-black text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-400 font-medium">Configured pipelines</div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ship Capable</span>
            <Ship className="size-4 text-teal-600" />
          </div>
          <div className="mt-1 text-xl font-black text-slate-900">{stats.shipsTargetable}</div>
          <div className="text-[11px] text-teal-700 font-medium">Single ship targeting</div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Auth Validated</span>
            <ShieldCheck className="size-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-xl font-black text-slate-900">{stats.authOk} / {stats.total}</div>
          <div className="text-[11px] text-emerald-700 font-medium">Credentials verified</div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Workers</span>
            <Activity className="size-4 text-sky-600" />
          </div>
          <div className="mt-1 text-xl font-black text-slate-900">{stats.activeRuns}</div>
          <div className="text-[11px] text-sky-700 font-medium">Queued or extracting</div>
        </div>
      </div>

      {/* ── Search and Filter Suite ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 p-3 sm:p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by vendor name or key (e.g. Holland, MSC, RCI)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9.5 pl-9.5 pr-8 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterMode("all")}
            className={`inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
              filterMode === "all"
                ? "bg-teal-800 text-white shadow-sm shadow-teal-900/15"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span>All ({vendorCards.length})</span>
          </button>

          <button
            onClick={() => setFilterMode("ship_search")}
            className={`inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
              filterMode === "ship_search"
                ? "bg-teal-800 text-white shadow-sm shadow-teal-900/15"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Ship className="size-3.5" />
            <span>Ship Filter Capable</span>
          </button>

          <button
            onClick={() => setFilterMode("auth_ok")}
            className={`inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
              filterMode === "auth_ok"
                ? "bg-teal-800 text-white shadow-sm shadow-teal-900/15"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="size-3.5" />
            <span>Auth OK</span>
          </button>

          <button
            onClick={() => setFilterMode("failed")}
            className={`inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
              filterMode === "failed"
                ? "bg-rose-700 text-white shadow-sm shadow-rose-900/15"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <AlertTriangle className="size-3.5" />
            <span>Recent Issues</span>
          </button>

          <Link
            href="/dashboard/vendor-sites"
            className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition ml-1"
          >
            <span>Vendor Sites</span>
            <ExternalLink className="size-3 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* ── Quick Jump Bar ─────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1.5 flex items-center gap-1.5">
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
        <OpsScraperGridSkeleton count={6} />
      ) : filteredCards.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border border-slate-200 bg-white p-8 space-y-3">
          <Search className="size-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No scrapers match your search or filter</p>
          <p className="text-xs text-slate-400">Try resetting your search query or selecting &ldquo;All Scrapers&rdquo;.</p>
          <button
            onClick={() => {
              setSearchQuery("")
              setFilterMode("all")
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 shadow-2xs cursor-pointer transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCards.map((v) => (
            <div key={v.vendorKey} id={`vendor-card-${v.vendorKey}`} className="scroll-mt-20">
              <VendorCard
                vendor={v}
                dbShips={dbShips}
                onTrigger={(opts) => triggerVendor(v.vendorKey, opts)}
                onCheckAuth={() => checkSingleAuth(v.vendorKey)}
                isAuthChecking={!!singleAuthChecking[v.vendorKey]}
                globalLocked={isGloballyLocked}
                now={now}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ShipSearchCombobox({
  availableShips = [],
  selectedShip = "",
  onSelectShip
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef(null)

  // Filter matching ships
  const filteredShips = useMemo(() => {
    if (!query.trim()) return availableShips
    const q = query.toLowerCase()
    return availableShips.filter((s) => s.toLowerCase().includes(q))
  }, [availableShips, query])

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (ship) => {
    onSelectShip(ship)
    setQuery("")
    setIsOpen(false)
  }

  const handleClear = (e) => {
    if (e && e.stopPropagation) e.stopPropagation()
    onSelectShip("")
    setQuery("")
  }

  const inputValue = query !== "" ? query : selectedShip

  return (
    <div ref={containerRef} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Ship className="size-3.5 text-teal-700" />
          <span>Target Single Ship:</span>
        </label>
        {availableShips.length > 0 && (
          <span className="text-[10.5px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60">
            {availableShips.length} vessels
          </span>
        )}
      </div>

      {/* Search Input Box */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={inputValue}
          onFocus={() => {
            setIsOpen(true)
            if (selectedShip && query === "") setQuery(selectedShip)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            if (selectedShip && e.target.value !== selectedShip) {
              onSelectShip(e.target.value)
            }
          }}
          placeholder="All Fleet Vessels (or type to target ship)..."
          className="w-full h-8.5 pl-8 pr-7 rounded-xl border border-slate-200 bg-slate-50/80 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 outline-none transition shadow-2xs font-medium"
        />
        {selectedShip || query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="size-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <ChevronDown className={`size-3.5 transition-transform duration-200 ${isOpen ? "rotate-180 text-teal-700" : ""}`} />
          </button>
        )}

        {/* Dropdown Options List */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150">
            {/* Full Scan Option */}
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left font-semibold transition cursor-pointer ${
                !selectedShip
                  ? "bg-teal-50 text-teal-900 font-bold border border-teal-200/80"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="size-3.5 text-teal-600" />
                <span>All Fleet Vessels (Full Scan)</span>
              </div>
              {!selectedShip && <Check className="size-3.5 text-teal-700" />}
            </button>

            {/* Custom typed query option if typed text doesn't exactly match */}
            {query.trim() && !availableShips.some((s) => s.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => handleSelect(query.trim())}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-teal-800 bg-teal-50/50 hover:bg-teal-50 border border-teal-200/60 font-semibold cursor-pointer"
              >
                <Zap className="size-3.5 text-teal-600 shrink-0" />
                <span className="truncate">Target Custom: &ldquo;{query.trim()}&rdquo;</span>
              </button>
            )}

            {/* List of matched ships */}
            {filteredShips.length > 0 ? (
              filteredShips.map((ship) => {
                const isSelected = selectedShip?.toLowerCase() === ship.toLowerCase()
                return (
                  <button
                    key={ship}
                    type="button"
                    onClick={() => handleSelect(ship)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-teal-700 text-white font-bold shadow-2xs"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Ship className={`size-3.5 shrink-0 ${isSelected ? "text-white" : "text-slate-400"}`} />
                      <span className="truncate">{ship}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-white shrink-0 ml-1" />}
                  </button>
                )
              })
            ) : !query.trim() ? (
              <div className="py-2 text-center text-[11px] text-slate-400">No vessels found</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function ShipScrapeResultCard({ shipName, vendorInfo = {}, dbShips = [], onDismiss }) {
  const matchedShipData = useMemo(() => {
    if (!shipName) return null
    const sName = shipName.toLowerCase().trim()
    return (
      dbShips.find((s) => {
        const name = (s.name || s.shipName || "").toLowerCase().trim()
        const code = (s.code || s.shipCode || "").toLowerCase().trim()
        return name === sName || code === sName || (name.length > 3 && (sName.includes(name) || name.includes(sName)))
      }) || null
    )
  }, [shipName, dbShips])

  const searchCruiseUrl = `/dashboard/search-cruise?ship=${encodeURIComponent(shipName)}${
    vendorInfo.name ? `&vendor=${encodeURIComponent(vendorInfo.name)}` : ""
  }`

  return (
    <div className="rounded-xl border border-teal-200/90 bg-gradient-to-br from-teal-50/90 via-white to-sky-50/50 p-3 text-xs shadow-2xs space-y-2.5 transition-all animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 truncate">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-700 text-white shrink-0 shadow-2xs">
            <Ship className="size-4" />
          </div>
          <div className="truncate">
            <div className="font-bold text-slate-900 text-xs tracking-tight truncate flex items-center gap-1.5">
              <span>{shipName}</span>
              {matchedShipData?.code && (
                <span className="font-mono text-[10px] font-semibold text-teal-800 bg-teal-100/70 px-1.5 py-0.2 rounded border border-teal-200">
                  {matchedShipData.code}
                </span>
              )}
            </div>
            <div className="text-[10.5px] text-slate-500 font-medium">
              {vendorInfo.name || "Fleet Vessel"}
            </div>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            title="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Ship Specifications / Fleet Stats */}
      <div className="grid grid-cols-3 gap-1.5 py-1 px-2 rounded-lg bg-white/90 border border-teal-100/80 text-[10.5px]">
        <div>
          <span className="text-slate-400 block text-[9.5px] font-semibold uppercase">Cabins</span>
          <span className="font-bold text-slate-800 font-mono">
            {matchedShipData?.cabins ? Number(matchedShipData.cabins).toLocaleString() : "--"}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[9.5px] font-semibold uppercase">Guests</span>
          <span className="font-bold text-slate-800 font-mono">
            {matchedShipData?.guests ? Number(matchedShipData.guests).toLocaleString() : "--"}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[9.5px] font-semibold uppercase">Decks</span>
          <span className="font-bold text-slate-800 font-mono">
            {matchedShipData?.decks?.length || matchedShipData?.totalDecks || "--"}
          </span>
        </div>
      </div>

      {/* Direct Redirection to Search Cruise Link */}
      <Link
        href={searchCruiseUrl}
        className="group flex items-center justify-between w-full h-8 px-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-bold shadow-2xs transition active:scale-[0.98]"
      >
        <div className="flex items-center gap-1.5">
          <Search className="size-3 text-teal-200" />
          <span>Search Cruises for {shipName}</span>
        </div>
        <ArrowRight className="size-3.5 text-teal-200 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  )
}

function VendorCard({ vendor, dbShips = [], onTrigger, onCheckAuth, isAuthChecking, globalLocked, now }) {
  const {
    vendorKey,
    intervalDays,
    horizonDays,
    startHour,
    lastRun,
    auth,
    trigger,
    availableShips,
    hasAvailableShips,
    supportsShipSearch
  } = vendor

  const info = VENDOR_NAMES[vendorKey] || {
    name: vendorKey,
    code: vendorKey.slice(0, 2).toUpperCase(),
    gradient: "from-teal-600 to-teal-800",
    accent: "#0d9488"
  }

  const [runDate, setRunDate] = useState(todayISO)
  const [runHorizon, setRunHorizon] = useState(horizonDays || 30)
  const [shipName, setShipName] = useState("")
  const [lastScrapedShip, setLastScrapedShip] = useState("")
  const [showShipResult, setShowShipResult] = useState(false)

  // Running stopwatch elapsed time
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    let interval = null
    if (trigger?.loading && trigger?.startedAt) {
      interval = setInterval(() => {
        setElapsed(Math.max(0, Math.floor((Date.now() - trigger.startedAt) / 1000)))
      }, 500)
    } else {
      setElapsed(0)
    }
    return () => clearInterval(interval)
  }, [trigger?.loading, trigger?.startedAt])

  // When scrape execution finishes, if we targeted a ship, show the result card
  useEffect(() => {
    if (trigger?.msg && trigger?.ok && !trigger?.loading && lastScrapedShip) {
      setShowShipResult(true)
    }
  }, [trigger?.msg, trigger?.ok, trigger?.loading, lastScrapedShip])

  const lastRunTime = lastRun?.finishedAt ?? lastRun?.startedAt ?? null
  const lastRunStatus = lastRun?.status ?? null

  // Single ship targeting is available if vendor has ships in DB or explicitly supports it
  const isShipTargetingAvailable = hasAvailableShips || supportsShipSearch

  function handleRun() {
    const trimmedShip = shipName.trim()
    const shipActive = isShipTargetingAvailable && !!trimmedShip

    if (shipActive) {
      setLastScrapedShip(trimmedShip)
    } else {
      setLastScrapedShip("")
    }
    setShowShipResult(false)

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
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-md hover:border-teal-500/40 transition-all duration-200">
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

          <div className="flex items-center gap-1.5">
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
                  <span>Checking…</span>
                ) : (
                  <>
                    <AlertTriangle className="size-3 text-rose-600" />
                    <span>{auth.status}</span>
                  </>
                )}
              </span>
            )}

            <button
              onClick={onCheckAuth}
              disabled={isAuthChecking}
              title="Test vendor authentication"
              className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCcw className={`size-3 ${isAuthChecking ? "animate-spin text-teal-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Telemetry / Last Run Box */}
        <div className="rounded-xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-3.5 text-xs shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="size-3.5 text-teal-700" />
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

          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3 text-teal-700" />
              <span className="font-bold text-slate-900 text-xs">{fmtDT(lastRunTime)}</span>
              {lastRunTime && (
                <span className="text-[10px] text-slate-500">({timeAgo(lastRunTime)})</span>
              )}
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-700 bg-white/90 px-2 py-0.5 rounded-md border border-teal-200/80 shadow-2xs">
              Duration: {fmtMs(lastRun?.durationMs)}
            </span>
          </div>
        </div>

        {/* Trigger Controls Configuration */}
        <div className="space-y-3 pt-0.5">
          {/* Start Date + Quick Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-slate-400" />
                <span>Start Date:</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRunDate(todayISO())}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-800 transition"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setRunDate(addDaysISO(7))}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-800 transition"
                >
                  +7d
                </button>
                <button
                  type="button"
                  onClick={() => setRunDate(addDaysISO(30))}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-800 transition"
                >
                  +30d
                </button>
              </div>
            </div>
            <input
              type="date"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
              className="w-full h-8.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 outline-none transition shadow-2xs cursor-pointer"
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
            <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
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

          {/* Target Single Ship (Searchable Combobox) */}
          {isShipTargetingAvailable ? (
            <ShipSearchCombobox
              availableShips={availableShips}
              selectedShip={shipName}
              onSelectShip={setShipName}
              dbShips={dbShips}
              vendorInfo={info}
            />
          ) : null}
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

        {/* Render Ship Scrape Result Card ONLY AFTER scraper run completes for the targeted ship */}
        {showShipResult && lastScrapedShip && (
          <ShipScrapeResultCard
            shipName={lastScrapedShip}
            vendorInfo={info}
            dbShips={dbShips}
            onDismiss={() => setShowShipResult(false)}
          />
        )}

        <button
          onClick={handleRun}
          disabled={trigger?.loading || globalLocked}
          className={`w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold text-white shadow-md shadow-teal-900/15 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 ${
            trigger?.loading
              ? "bg-gradient-to-r from-sky-700 to-sky-800"
              : "bg-gradient-to-r from-teal-800 via-teal-700 to-teal-800 hover:from-teal-900 hover:to-teal-800 hover:shadow-lg"
          }`}
        >
          {trigger?.loading ? (
            <>
              <RefreshCcw className="size-3.5 text-sky-200 animate-spin" />
              <span>Running Extraction ({String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}s)…</span>
            </>
          ) : (
            <>
              <Play className="size-3.5 text-teal-200" />
              <span>{shipName ? `Scrape Vessel: ${shipName}` : "Trigger Scraper Run"}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
