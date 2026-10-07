"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  Tag,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Bell,
  Sparkles,
  ArrowDownRight,
  Flame,
  Plus,
  Trash2,
  Edit2,
  X,
  RefreshCw,
  Volume2,
  VolumeX,
  Radio,
  Check,
  CheckCheck,
  Zap,
  Eye,
  Search,
  Layers,
  Ship
} from "lucide-react"
import { toast } from "sonner"

import {
  fetchCruises,
  fetchCruiseTags,
  fetchCruisePriceAlerts,
  markCruisePriceAlertRead,
  createCruiseTag,
  updateCruiseTag,
  deleteCruiseTag,
  fetchShips,
  fetchUsers,
  fetchVendors,
  refreshCruiseCabins,
  getCruiseRefreshStatus
} from "../api"
import { TaggedCruisesSkeleton } from "@/components/ui/skeleton-patterns"
import { buildCabinGroups, getCruiseDisplayId, getCruiseRouteLabel, getLoadFactor } from "../cruise-helpers"

function fmtSeconds(sec) {
  const s = Math.max(0, Math.ceil(sec))
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

const PAGE_SIZE = 20

function formatDate(value) {
  if (!value) return "--"
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })
}

function formatCurrency(amount, currency = "GBP") {
  return `${currency === "GBP" ? "\u00A3" : "$"}${Number(amount ?? 0).toLocaleString()}`
}

function playPriceDropChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(587.33, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12)
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.25)

    gain.gain.setValueAtTime(0.01, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.52)
  } catch {
    // AudioContext blocked or not supported
  }
}

export default function TaggedCruisesPage() {
  const [loading, setLoading] = useState(true)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [error, setError] = useState("")
  const [rows, setRows] = useState([])
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [pagination, setPagination] = useState(null)
  const [tagDirectory, setTagDirectory] = useState({ tags: [], assignees: [] })
  const [lookupOptions, setLookupOptions] = useState({
    vendors: [],
    ships: [],
    users: []
  })
  const [page, setPage] = useState(1)
  const [priceDropOnly, setPriceDropOnly] = useState(false)
  
  // Real-time price radar controls
  const [radarActive, setRadarActive] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [radarCountdown, setRadarCountdown] = useState(20)
  const [priceAlerts, setPriceAlerts] = useState([])
  const [showAlertsPanel, setShowAlertsPanel] = useState(false)

  // Tag Management modal state
  const [tagModalCruise, setTagModalCruise] = useState(null)
  const [savingTag, setSavingTag] = useState(false)

  // Cabin Categories Modal state
  const [cabinModalCruise, setCabinModalCruise] = useState(null)

  const [filters, setFilters] = useState({
    tag: "",
    assignedTo: "",
    vendorName: "",
    ship: "",
    startDateFrom: "",
    endDateTo: ""
  })
  const debouncedTag = useDebounce(filters.tag, 350)
  const [appliedFilters, setAppliedFilters] = useState({
    tag: "",
    assignedTo: "",
    vendorName: "",
    ship: "",
    startDateFrom: "",
    endDateTo: ""
  })

  // Debounce tag input changes so typing doesn't spam requests
  useEffect(() => {
    setAppliedFilters(current => {
      if (current.tag === debouncedTag) return current
      return { ...current, tag: debouncedTag }
    })
    setPage(1)
  }, [debouncedTag])

  // Ref to track notified price drops to avoid duplicate toasts in session
  const notifiedDropsRef = useRef(new Set())

  // Load tag lookups & assignees
  const loadDirectory = useCallback(async () => {
    try {
      const [tagResponse, vendorResponse, shipResponse, userResponse] = await Promise.all([
        fetchCruiseTags().catch(() => ({ data: {} })),
        fetchVendors({ limit: 100 }).catch(() => ({ data: [] })),
        fetchShips({ limit: 100 }).catch(() => ({ data: [] })),
        fetchUsers().catch(() => ({ data: [] }))
      ])

      setTagDirectory({
        tags: tagResponse.data?.tags ?? [],
        assignees:
          userResponse.data?.map(user => user.name).filter(Boolean) ||
          (tagResponse.data?.assignees ?? [])
      })

      setLookupOptions({
        vendors: [...new Set((vendorResponse.data || []).map(vendor => vendor.name).filter(Boolean))],
        ships: [...new Set((shipResponse.data || []).map(ship => ship.name).filter(Boolean))],
        users: [...new Set((userResponse.data || []).map(user => user.name).filter(Boolean))]
      })
    } catch (err) {
      console.warn("Failed to load tagged cruise lookups:", err?.message || err)
    }
  }, [])

  useEffect(() => {
    loadDirectory()
  }, [loadDirectory])

  // Main loader for cruises and price alerts
  const loadCruises = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setError("")

      const [cruisesResponse, alertsResponse] = await Promise.allSettled([
        fetchCruises({
          page,
          limit: PAGE_SIZE,
          detail: "full",
          tagged: true,
          tag: appliedFilters.tag || undefined,
          assignedTo: appliedFilters.assignedTo || undefined,
          vendorName: appliedFilters.vendorName || undefined,
          ship: appliedFilters.ship || undefined,
          startDateFrom: appliedFilters.startDateFrom || undefined,
          endDateTo: appliedFilters.endDateTo || undefined
        }),
        fetchCruisePriceAlerts({ status: "unread", limit: 20 })
      ])

      const data = cruisesResponse.status === "fulfilled" ? cruisesResponse.value?.data || [] : []
      const alerts = alertsResponse.status === "fulfilled" ? alertsResponse.value?.data || [] : []
      
      setRows(data)
      setPagination(cruisesResponse.status === "fulfilled" ? cruisesResponse.value?.pagination || null : null)
      setPriceAlerts(alerts)

      // Scan & Trigger Real-Time Toast Notifications for Price Drops with Team Mentions
      let hasNewDrop = false

      data.forEach(row => {
        const availPrices = (row.cabinCategories || [])
          .filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0) || !c.avlResult)
          .map(c => Number(c.cabinPrice ?? c.price ?? 0))
          .filter(p => Number.isFinite(p) && p > 0)
        const currentLowest = availPrices.length > 0 ? Math.min(...availPrices) : (row.lowestPrice ? Number(row.lowestPrice) : (row.price ? Number(row.price) : null))

        const tags = row.tags || []
        tags.forEach(tag => {
          const trackedLow = Number(tag.trackedLowestPrice)
          const lastSeen = Number(tag.lastSeenPrice)
          const isDrop = Boolean(tag.lastPriceDropAt) || 
            (Number.isFinite(trackedLow) && trackedLow > 0 && currentLowest && currentLowest < trackedLow) || 
            (Number.isFinite(lastSeen) && lastSeen > 0 && currentLowest && currentLowest < lastSeen)
          
          const dropKey = `${row.id}-${tag.id}-${currentLowest}`

          if (isDrop && currentLowest && !notifiedDropsRef.current.has(dropKey)) {
            notifiedDropsRef.current.add(dropKey)
            hasNewDrop = true
            const basePrice = (Number.isFinite(trackedLow) && trackedLow > 0) ? trackedLow : lastSeen
            const savedAmount = basePrice && currentLowest ? basePrice - currentLowest : null
            const savedPercent = savedAmount && basePrice ? Math.round((savedAmount / basePrice) * 100) : null
            const shipName = row.ship || row.shipName || "Cruise Ship"

            toast.success(
              <div className="flex flex-col gap-1.5 py-0.5 font-sans">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                    <TrendingDown size={14} />
                  </div>
                  <span>Price Drop Alert!</span>
                  {savedPercent && savedPercent > 0 ? (
                    <span className="ml-auto rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-950 border border-emerald-300">
                      {savedPercent}% OFF
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-700 leading-snug">
                  <strong>{shipName}</strong> ({row.package || row.code}) dropped to{" "}
                  <strong className="text-emerald-800 font-bold">{formatCurrency(currentLowest, row.currency)}</strong>
                  {savedAmount && savedAmount > 0 ? (
                    <span className="font-semibold text-emerald-700"> (Save {formatCurrency(savedAmount, row.currency)})</span>
                  ) : ""}!
                </div>
                {tag.assignedTo ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-900 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-md mt-0.5 w-fit">
                    <Bell size={12} className="shrink-0 text-teal-700 animate-bounce" />
                    <span>Mention: @{tag.assignedTo} · Tag: {tag.label}</span>
                  </div>
                ) : (
                  <div className="text-[11px] font-medium text-slate-500">
                    Tag: {tag.label}
                  </div>
                )}
              </div>,
              {
                duration: 10000,
                id: `price-drop-${row.id}-${tag.id}`
              }
            )
          }
        })
      })

      if (hasNewDrop && soundEnabled) {
        playPriceDropChime()
      }
    } catch (err) {
      setError(err.message || "Failed to load tagged cruises")
      setRows([])
      setPagination(null)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [appliedFilters, page, soundEnabled])

  useEffect(() => {
    loadCruises()
  }, [loadCruises])

  // Dynamic Real-Time Price Radar Polling
  useEffect(() => {
    if (!radarActive) return

    setRadarCountdown(20)
    const interval = setInterval(() => {
      setRadarCountdown(prev => {
        if (prev <= 1) {
          loadCruises({ silent: true })
          return 20
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [radarActive, loadCruises])

  // Refresh single cruise cabins & prices with live polling
  const [refreshJobs, setRefreshJobs] = useState({})
  const pollRefs = useRef({})

  useEffect(() => {
    const currentPolls = pollRefs.current
    return () => {
      Object.values(currentPolls).forEach(clearInterval)
    }
  }, [])

  function startPolling(rowId, cruiseCode) {
    if (pollRefs.current[rowId]) clearInterval(pollRefs.current[rowId])
    pollRefs.current[rowId] = setInterval(async () => {
      try {
        const s = await getCruiseRefreshStatus(cruiseCode)
        setRefreshJobs(prev => ({ ...prev, [rowId]: s }))
        if (s.status === "cooldown" || s.status === "idle" || s.status === "completed") {
          clearInterval(pollRefs.current[rowId])
          delete pollRefs.current[rowId]
          toast.success(`Pricing updated for ${cruiseCode}`)
          loadCruises({ silent: true })
        }
      } catch {
        // network retry
      }
    }, 3000)
  }

  async function handleGetFullDetails(row) {
    const cruiseCode = row.code ?? row.id
    const vendorKey = row.vendor?.slug ?? row.vendorKey ?? row.source
    if (!vendorKey) {
      setRefreshJobs(prev => ({ ...prev, [row.id]: { status: "error", error: "Vendor unknown — cannot refresh." } }))
      return
    }
    setRefreshJobs(prev => ({ ...prev, [row.id]: { status: "started", estimatedMs: 45000, remaining: 45000 } }))
    try {
      const result = await refreshCruiseCabins(cruiseCode, vendorKey)
      const rem = result.remaining ?? result.estimatedMs ?? 45000
      setRefreshJobs(prev => ({ ...prev, [row.id]: { status: result.status || "in_progress", estimatedMs: result.estimatedMs ?? rem, remaining: rem } }))
      if (result.status === "started" || result.status === "in_progress") {
        startPolling(row.id, cruiseCode)
      } else if (result.status === "cooldown" || result.status === "completed" || rem <= 0) {
        loadCruises({ silent: true })
      }
    } catch (err) {
      const offline = err.message?.toLowerCase().includes("fetch") || err.message?.toLowerCase().includes("network")
      setRefreshJobs(prev => ({ ...prev, [row.id]: { status: "error", error: offline ? "Scraper server is offline." : err.message, retryAfter: err.retryAfter } }))
    }
  }

  // Scan & Refresh all tagged cruises currently on screen
  async function handleRefreshAllTagged() {
    setRefreshingAll(true)
    toast.info(`Starting live radar scan for ${rows.length} tagged ships...`)
    try {
      for (const row of rows) {
        const cruiseCode = row.code ?? row.id
        const vendorKey = row.vendor?.slug ?? row.vendorKey ?? row.source
        if (cruiseCode && vendorKey) {
          try {
            await refreshCruiseCabins(cruiseCode, vendorKey)
          } catch {
            // ignore individual rate-limit
          }
        }
      }
      toast.success("Radar scan initiated for all tagged ships. Prices will update dynamically.")
      setTimeout(() => loadCruises({ silent: true }), 4000)
    } finally {
      setRefreshingAll(false)
    }
  }

  // Mark alert as read
  async function handleMarkAlertRead(alertId) {
    try {
      await markCruisePriceAlertRead(alertId)
      setPriceAlerts(current => current.filter(a => a.id !== alertId))
      toast.success("Price alert marked as read")
    } catch (err) {
      toast.error("Failed to dismiss alert: " + err.message)
    }
  }

  // Tag Management Handlers
  const handleCreateTag = async (cruiseId, payload) => {
    try {
      setSavingTag(true)
      const res = await createCruiseTag(cruiseId, payload)
      if (res.data) {
        setRows(current => current.map(r => (r.id === cruiseId ? res.data : r)))
        if (tagModalCruise?.id === cruiseId) {
          setTagModalCruise(res.data)
        }
      }
      await loadDirectory()
      await loadCruises({ silent: true })
      toast.success("Tag saved successfully")
    } catch (err) {
      toast.error("Failed to save tag: " + err.message)
    } finally {
      setSavingTag(false)
    }
  }

  const handleUpdateTag = async (cruiseId, tagId, payload) => {
    try {
      setSavingTag(true)
      const res = await updateCruiseTag(cruiseId, tagId, payload)
      if (res.data) {
        setRows(current => current.map(r => (r.id === cruiseId ? res.data : r)))
        if (tagModalCruise?.id === cruiseId) {
          setTagModalCruise(res.data)
        }
      }
      await loadDirectory()
      await loadCruises({ silent: true })
      toast.success("Tag updated successfully")
    } catch (err) {
      toast.error("Failed to update tag: " + err.message)
    } finally {
      setSavingTag(false)
    }
  }

  const handleDeleteTag = async (cruiseId, tagId) => {
    try {
      setSavingTag(true)
      const res = await deleteCruiseTag(cruiseId, tagId)
      if (res.data) {
        setRows(current => current.map(r => (r.id === cruiseId ? res.data : r)))
        if (tagModalCruise?.id === cruiseId) {
          setTagModalCruise(res.data)
        }
      } else {
        setRows(current => current.map(r => {
          if (r.id === cruiseId) {
            return { ...r, tags: (r.tags || []).filter(t => t.id !== tagId) }
          }
          return r
        }))
        if (tagModalCruise?.id === cruiseId) {
          setTagModalCruise(prev => ({
            ...prev,
            tags: (prev.tags || []).filter(t => t.id !== tagId)
          }))
        }
      }
      await loadDirectory()
      await loadCruises({ silent: true })
      toast.success("Tag removed")
    } catch (err) {
      toast.error("Failed to delete tag: " + err.message)
    } finally {
      setSavingTag(false)
    }
  }

  // Helper to check if a row has a price drop
  const checkRowHasDrop = useCallback((row) => {
    const availPrices = (row.cabinCategories || [])
      .filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0) || !c.avlResult)
      .map(c => Number(c.cabinPrice ?? c.price ?? 0))
      .filter(p => Number.isFinite(p) && p > 0)
    const lowest = availPrices.length > 0 ? Math.min(...availPrices) : (row.lowestPrice ? Number(row.lowestPrice) : (row.price ? Number(row.price) : null))

    const hasTagDrop = (row.tags || []).some(tag => {
      const trackedLow = Number(tag.trackedLowestPrice)
      const lastSeen = Number(tag.lastSeenPrice)
      return Boolean(tag.lastPriceDropAt) ||
        (Number.isFinite(trackedLow) && trackedLow > 0 && lowest && lowest < trackedLow) ||
        (Number.isFinite(lastSeen) && lastSeen > 0 && lowest && lowest < lastSeen)
    })

    const hasAlertDrop = priceAlerts.some(a => 
      (a.cruiseCode && a.cruiseCode === (row.code || row.id)) || 
      (a.cruiseId && a.cruiseId === row.id)
    )

    return hasTagDrop || hasAlertDrop
  }, [priceAlerts])

  // Summary Metrics
  const summary = useMemo(() => {
    const totalTagged = pagination?.total ?? rows.length
    const employees = new Set(
      rows.flatMap(row => (row.tags || []).map(tag => tag.assignedTo).filter(Boolean))
    ).size
    const ships = new Set(rows.map(row => row.shipCode || row.ship).filter(Boolean)).size
    const drops = rows.reduce((count, row) => count + (checkRowHasDrop(row) ? 1 : 0), 0)

    return { totalTagged, employees, ships, drops }
  }, [pagination, rows, checkRowHasDrop])

  const vendorOptions = useMemo(() => lookupOptions.vendors, [lookupOptions])
  const shipOptions = useMemo(() => lookupOptions.ships, [lookupOptions])

  const setF = (key, value) => {
    setFilters(current => ({ ...current, [key]: value }))
    if (key !== "tag") {
      setAppliedFilters(current => ({ ...current, [key]: value }))
      setPage(1)
    }
  }

  const applyFilters = () => {
    setAppliedFilters(filters)
    setPage(1)
  }

  const resetFilters = () => {
    const empty = {
      tag: "",
      assignedTo: "",
      vendorName: "",
      ship: "",
      startDateFrom: "",
      endDateTo: ""
    }
    setFilters(empty)
    setAppliedFilters(empty)
    setPage(1)
  }

  const togglePriceDropFilter = () => {
    const next = !priceDropOnly
    setPriceDropOnly(next)
    if (next) {
      const droppedIds = rows.filter(checkRowHasDrop).map(r => r.id)
      setExpandedRows(new Set(droppedIds))
    }
  }

  const displayedRows = useMemo(() => {
    if (!priceDropOnly) return rows
    return rows.filter(checkRowHasDrop)
  }, [rows, priceDropOnly, checkRowHasDrop])

  const toggleExpand = (id) => {
    setExpandedRows(current => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4 font-sans">
      {/* ── Top Header Banner with Live Radar Status & Controls ──────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/90 backdrop-blur-xs px-3.5 py-1 text-[11px] font-semibold text-teal-800 shadow-2xs">
                <span className="relative flex h-2.5 w-2.5">
                  {radarActive ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400" />
                  )}
                </span>
                <span>{radarActive ? "Live Price Radar: Active" : "Price Radar: Paused"}</span>
                {radarActive && (
                  <span className="text-[10px] text-teal-600 font-semibold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 tabular-nums">
                    sync in {radarCountdown}s
                  </span>
                )}
              </div>

              {priceAlerts.length > 0 && (
                <button
                  onClick={() => setShowAlertsPanel(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 shadow-2xs hover:bg-rose-100 transition cursor-pointer animate-pulse"
                >
                  <Flame size={13} className="text-rose-600" />
                  <span>{priceAlerts.length} Price Alert{priceAlerts.length > 1 ? "s" : ""}</span>
                </button>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Tagged Cruises & Dynamic Price Drop Radar
            </h1>
            <p className="text-xs sm:text-sm font-normal text-slate-600 max-w-3xl leading-relaxed">
              Real-time radar monitoring saved cruise tags, calculating live fare reductions against baselines, and triggering instant mentions for assigned team members.
            </p>
          </div>

          {/* Quick Action Controls on Header */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setRadarActive(!radarActive)}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-xs font-semibold transition shadow-2xs cursor-pointer ${
                radarActive
                  ? "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                  : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
              }`}
              title={radarActive ? "Pause automated background radar" : "Resume real-time background price drop sync"}
            >
              <Radio size={14} className={radarActive ? "text-emerald-600 animate-pulse" : "text-slate-400"} />
              <span>{radarActive ? "Radar: ON" : "Radar: PAUSED"}</span>
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`inline-flex items-center justify-center h-9 w-9 rounded-xl border text-xs font-semibold transition shadow-2xs cursor-pointer ${
                soundEnabled
                  ? "bg-white text-teal-800 border-teal-300 hover:bg-teal-50"
                  : "bg-slate-100 text-slate-400 border-slate-300"
              }`}
              title={soundEnabled ? "Mute audio alerts" : "Enable chime on price drop"}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>

            <button
              onClick={handleRefreshAllTagged}
              disabled={refreshingAll || rows.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <RefreshCw size={13} className={refreshingAll ? "animate-spin" : ""} />
              <span>{refreshingAll ? "Scanning Fleet…" : "Scan Fleet Now"}</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tagged Cruises" value={summary.totalTagged} icon={Tag} />
          <StatCard label="Assigned Employees" value={summary.employees} icon={Bell} />
          <StatCard label="Ships Covered" value={summary.ships} icon={Sparkles} />
          <StatCard
            label="Price Drops Tracked"
            value={summary.drops}
            highlight={summary.drops > 0}
            active={priceDropOnly}
            variant="amber"
            onClick={togglePriceDropFilter}
            subtext={summary.drops > 0 ? (priceDropOnly ? "Filtering drops (click to show all)" : "Click to filter & expand drops") : "All fares steady"}
            icon={Flame}
          />
        </div>
      </div>

      {/* ── Filters Section ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tag</label>
            <input
              list="tagged-tag-options"
              value={filters.tag}
              onChange={event => setF("tag", event.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              placeholder="e.g. Priority"
            />
            <datalist id="tagged-tag-options">
              {tagDirectory.tags.map(item => (
                <option key={item.label} value={item.label} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Assigned to</label>
            <select
              value={filters.assignedTo}
              onChange={event => setF("assignedTo", event.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            >
              <option value="">All assignees</option>
              {lookupOptions.users.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Vendor</label>
            <select
              value={filters.vendorName}
              onChange={event => setF("vendorName", event.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            >
              <option value="">All vendors</option>
              {vendorOptions.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Ship</label>
            <select
              value={filters.ship}
              onChange={event => setF("ship", event.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            >
              <option value="">All ships</option>
              {shipOptions.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <DateField
            label="Departure from"
            value={filters.startDateFrom}
            onChange={value => setF("startDateFrom", value)}
          />

          <DateField
            label="Departure to"
            value={filters.endDateTo}
            onChange={value => setF("endDateTo", value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={applyFilters}
            className="inline-flex items-center gap-2 h-10 px-6 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-95 transition cursor-pointer"
          >
            <Filter size={15} />
            <span>Apply Filters</span>
          </button>
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border border-rose-200/90 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs sm:text-sm font-semibold active:scale-95 transition cursor-pointer shadow-2xs"
          >
            <RotateCcw size={14} className="text-rose-600" />
            <span>Reset</span>
          </button>
          <button
            onClick={togglePriceDropFilter}
            className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border text-xs sm:text-sm font-semibold active:scale-95 transition cursor-pointer ${
              priceDropOnly
                ? "border-2 border-orange-500 bg-gradient-to-r from-amber-100 via-orange-50 to-amber-100 text-orange-950 shadow-xs ring-2 ring-orange-400/30 font-bold"
                : summary.drops > 0
                  ? "bg-gradient-to-r from-amber-50 via-orange-50/70 to-amber-50 text-amber-950 border-amber-300 hover:border-amber-400 hover:bg-amber-100/80 shadow-2xs font-bold"
                  : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
            }`}
          >
            <Flame size={15} className={summary.drops > 0 ? "text-amber-600 fill-amber-500/30 animate-pulse" : "text-slate-400"} />
            <span>{priceDropOnly ? "Showing Drops Only" : `Price Drops (${summary.drops})`}</span>
          </button>

          {priceAlerts.length > 0 && (
            <button
              onClick={() => setShowAlertsPanel(true)}
              className="ml-auto inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              <Bell size={14} className="text-rose-600 animate-bounce" />
              <span>Price Alerts Feed ({priceAlerts.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main Tagged Cruises List ────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500 font-medium">
            {loading ? "Loading tagged cruises..." : `${pagination?.total ?? rows.length} tagged cruise${(pagination?.total ?? rows.length) === 1 ? "" : "s"}`}
          </div>
          <div className="text-sm text-slate-500 font-medium tabular-nums">
            Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1}
          </div>
        </div>

        {loading ? (
          <TaggedCruisesSkeleton count={4} />
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-12 text-center text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm font-normal text-slate-500">
            No tagged cruises found for the current filters. Tag cruises in "Search Cruise" to monitor price drops here.
          </div>
        ) : (
          <div className="grid gap-4">
            {displayedRows.map((row, index) => {
              const availPrices = (row.cabinCategories || [])
                .filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0) || !c.avlResult)
                .map(c => Number(c.cabinPrice ?? c.price ?? 0))
                .filter(p => Number.isFinite(p) && p > 0)
              const lowest = availPrices.length > 0 ? Math.min(...availPrices) : (row.lowestPrice ? Number(row.lowestPrice) : (row.price ? Number(row.price) : null))

              const trackedLow = (() => {
                const vals = (row.tags || [])
                  .map(t => Number(t.trackedLowestPrice))
                  .filter(v => Number.isFinite(v) && v > 0)
                return vals.length > 0 ? Math.min(...vals) : null
              })()

              const lastSeen = (() => {
                const vals = (row.tags || [])
                  .map(t => Number(t.lastSeenPrice))
                  .filter(v => Number.isFinite(v) && v > 0)
                return vals.length > 0 ? Math.min(...vals) : null
              })()

              const isExpanded = expandedRows.has(row.id)
              const cabinGroups = buildCabinGroups(row.cabinCategories || [])

              // Price Drop Calculations
              const matchingAlert = priceAlerts.find(a => 
                (a.cruiseCode && a.cruiseCode === (row.code || row.id)) || 
                (a.cruiseId && a.cruiseId === row.id)
              )

              const dropTags = (row.tags || []).filter(t => 
                Boolean(t.lastPriceDropAt) || 
                (Number.isFinite(Number(t.trackedLowestPrice)) && Number(t.trackedLowestPrice) > 0 && lowest && lowest < Number(t.trackedLowestPrice)) ||
                (Number.isFinite(Number(t.lastSeenPrice)) && Number(t.lastSeenPrice) > 0 && lowest && lowest < Number(t.lastSeenPrice))
              )
              const hasPriceDrop = dropTags.length > 0 || (trackedLow && lowest && lowest < trackedLow) || Boolean(matchingAlert)
              const primaryDropTag = dropTags[0] || (row.tags || [])[0]

              // Base comparison against tracked price at tag creation or server alert
              const baselinePrice = trackedLow || (matchingAlert?.previousPrice ? Number(matchingAlert.previousPrice) : lastSeen)
              const priceDiff = (baselinePrice && lowest) ? lowest - baselinePrice : null
              const percentDiff = (priceDiff && baselinePrice) ? Math.round((Math.abs(priceDiff) / baselinePrice) * 100) : null

              // Availability Trend Calculations
              const seatsAvailable = Number(row.seatsAvailable ?? 0)
              const totalCapacity = Number(row.totalCapacity ?? 0)
              const loadFactor = getLoadFactor(row)
              const isLowAvailability = seatsAvailable > 0 && seatsAvailable <= 15
              const isSoldOut = seatsAvailable === 0 && totalCapacity > 0

              const shipName = row.ship || row.shipName || "Cruise Ship"

              return (
                <div
                  key={`tagged-${row.id || index}-${row.startDate || row.sailDate || ""}-${index}`}
                  className={`rounded-2xl border transition-all p-4 sm:p-5 duration-200 ${
                    hasPriceDrop
                      ? "border-amber-300/90 bg-gradient-to-br from-amber-50/40 via-white to-orange-50/25 shadow-xs ring-1 ring-amber-400/30"
                      : "border-slate-200/80 bg-slate-50/30 hover:bg-slate-50/70"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-0.5 text-xs font-semibold text-white">
                          {row.vendor?.name || "Vendor"}
                        </span>
                        <span className="rounded-full bg-white border border-slate-200 px-3 py-0.5 text-xs font-semibold text-slate-700">
                          {getCruiseDisplayId(row)}
                        </span>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                          loadFactor >= 85
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : loadFactor >= 60
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-teal-100 text-teal-800 border border-teal-200"
                        }`}>
                          Load {loadFactor}%
                        </span>
                        {hasPriceDrop && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 px-3 py-0.5 text-xs font-bold text-white shadow-xs animate-pulse border border-rose-400/30">
                            <TrendingDown size={13} />
                            <span>Price Drop Active</span>
                          </span>
                        )}
                        {isLowAvailability && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                            <AlertTriangle size={12} />
                            Only {seatsAvailable} cabins left!
                          </span>
                        )}
                      </div>

                      <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-snug">
                          {row.package || row.code}
                        </h2>
                        <div className="text-xs font-medium text-slate-600 mt-1">
                          <span className="text-slate-900 font-bold">{shipName}</span> · {getCruiseRouteLabel(row)} · {row.nights}N
                        </div>
                      </div>

                      {/* Tag badges with Manage Tags action */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {(row.tags || []).map(tag => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold shadow-2xs"
                            style={{
                              background: `${tag.color || "#0d9488"}15`,
                              color: tag.color || "#0d9488",
                              border: `1px solid ${tag.color || "#0d9488"}30`
                            }}
                          >
                            <Tag size={12} />
                            {tag.label}
                            {tag.assignedTo ? (
                              <span className="font-bold opacity-90"> · @{tag.assignedTo}</span>
                            ) : ""}
                          </span>
                        ))}

                        <button
                          onClick={() => setTagModalCruise(row)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 px-2.5 py-0.5 rounded-full transition cursor-pointer"
                        >
                          <Edit2 size={11} />
                          <span>Manage Tags</span>
                        </button>
                      </div>
                    </div>

                    {/* Metric Grid & Comparison Columns */}
                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 md:grid-cols-3 lg:min-w-[480px]">
                      <Metric label="Departure" value={formatDate(row.startDate)} icon={CalendarDays} />
                      <Metric label="Arrival" value={formatDate(row.endDate)} icon={CalendarDays} />

                      {/* Availability Column */}
                      <div className="rounded-xl bg-white px-3.5 py-2 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          <span>Avail. / Total Cabins</span>
                          {isLowAvailability ? (
                            <span className="text-rose-600 font-bold">Tight</span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="font-semibold text-slate-900 text-sm tabular-nums">
                            {seatsAvailable.toLocaleString()} / {totalCapacity.toLocaleString()}
                          </span>
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                            isSoldOut
                              ? "bg-rose-100 text-rose-700"
                              : isLowAvailability
                                ? "bg-rose-50 text-rose-600"
                                : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {isSoldOut ? "Sold Out" : isLowAvailability ? "Low Avail" : "In Stock"}
                          </span>
                        </div>
                      </div>

                      <Metric
                        label="Current Lowest"
                        value={lowest !== null ? formatCurrency(lowest, row.currency) : "WTL"}
                        highlight
                      />

                      <Metric
                        label="Tracked Low (at Tag)"
                        value={baselinePrice !== null ? formatCurrency(baselinePrice, row.currency) : "--"}
                      />

                      {/* Price Comparison Column */}
                      <div className="rounded-xl bg-white px-3.5 py-2 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          <TrendingDown size={12} />
                          <span>Price Comparison</span>
                        </div>
                        <div className="mt-1">
                          {priceDiff !== null ? (
                            priceDiff < 0 ? (
                              <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs tabular-nums">
                                <ArrowDownRight size={14} className="shrink-0 text-rose-600" />
                                <span>-{formatCurrency(Math.abs(priceDiff), row.currency)} ({percentDiff}%)</span>
                              </div>
                            ) : priceDiff > 0 ? (
                              <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs tabular-nums">
                                <TrendingUp size={13} className="shrink-0" />
                                <span>+{formatCurrency(priceDiff, row.currency)} (+{percentDiff}%)</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-teal-700 font-semibold text-xs">
                                <CheckCircle size={13} className="shrink-0" />
                                <span>Steady Low</span>
                              </div>
                            )
                          ) : (
                            <span className="text-xs font-medium text-slate-400">Baseline Set</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Price Drop & Team Mention Notification Banner */}
                  {hasPriceDrop && (
                    <div className="mt-4 rounded-xl border border-amber-300/90 bg-gradient-to-r from-amber-50/95 via-orange-50/70 to-rose-50/50 p-3.5 text-sm text-slate-900 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-xs">
                            <TrendingDown size={18} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5">
                                <Flame size={16} className="text-amber-600 fill-amber-500/30 shrink-0" />
                                <span>Price Drop Confirmed on {shipName}!</span>
                              </span>
                              {priceDiff && priceDiff < 0 ? (
                                <span className="rounded-full bg-rose-100/90 px-2.5 py-0.5 text-xs font-bold text-rose-900 border border-rose-300 shadow-2xs tabular-nums">
                                  Save {formatCurrency(Math.abs(priceDiff), row.currency)} ({percentDiff}% off)
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-700 mt-1 flex flex-wrap items-center gap-2">
                              {primaryDropTag?.assignedTo ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-teal-950 bg-white px-2 py-0.5 rounded-md border border-teal-300 shadow-2xs">
                                  <Bell size={11} className="text-teal-700 shrink-0" />
                                  <span>Mention: @{primaryDropTag.assignedTo}</span>
                                </span>
                              ) : null}
                              <span>
                                Tag <strong>"{primaryDropTag?.label || "Priority"}"</strong> hit a new low of{" "}
                                <strong className="text-rose-700 font-bold tabular-nums">
                                  {formatCurrency(lowest || primaryDropTag?.trackedLowestPrice, row.currency)}
                                </strong>
                              </span>
                              {primaryDropTag?.lastPriceDropAt ? (
                                <span className="text-slate-500 text-[11px]">
                                  · Recorded {formatDate(primaryDropTag.lastPriceDropAt)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes List */}
                  {(row.tags || []).some(tag => tag.note) ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {(row.tags || [])
                        .filter(tag => tag.note)
                        .map(tag => (
                          <div key={`${tag.id}-note`} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-600 shadow-2xs">
                            <span className="font-semibold text-slate-900">{tag.label}</span>
                            {tag.assignedTo ? ` · @${tag.assignedTo}` : ""}: <span className="text-slate-700">{tag.note}</span>
                          </div>
                        ))}
                    </div>
                  ) : null}

                  {/* Refresh live details button */}
                  {(() => {
                    const job = refreshJobs[row.id]
                    const isRunning = job?.status === "started" || job?.status === "in_progress"
                    const isCooldown = job?.status === "cooldown"
                    const isError = job?.status === "error" || job?.status === "rate_limited"
                    const remainingSec = isRunning ? Math.ceil((job.remaining ?? 0) / 1000) : isCooldown ? (job.retryAfter ?? 0) : 0
                    return (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {isRunning ? (
                          <span className="text-xs font-medium text-teal-700 flex items-center gap-1.5 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200">
                            <span className="animate-spin h-3.5 w-3.5 border-2 border-teal-600 border-t-transparent rounded-full" />
                            Scanning live fares on {shipName}… ~{fmtSeconds(remainingSec)} remaining
                          </span>
                        ) : isCooldown ? (
                          <span className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                            Fares up-to-date · next check in {fmtSeconds(remainingSec)}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleGetFullDetails(row)}
                            className="rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 active:scale-95 transition cursor-pointer shadow-2xs flex items-center gap-1.5"
                          >
                            <RefreshCw size={12} />
                            <span>Refresh Live Pricing & Cabins</span>
                          </button>
                        )}
                        {isError && (
                          <span className="text-xs text-rose-600 font-medium">
                            {job.error ?? "Too many requests."}{job.retryAfter ? ` Retry in ${fmtSeconds(job.retryAfter)}.` : ""}
                          </span>
                        )}
                      </div>
                    )
                  })()}

                  {/* Cabin Categories Modal Trigger */}
                  <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCabinModalCruise(row)}
                      className="inline-flex items-center gap-2 text-xs font-bold text-teal-900 bg-gradient-to-r from-teal-50 via-emerald-50/70 to-teal-50 hover:from-teal-100 hover:to-emerald-100 border border-teal-300/90 px-3.5 sm:px-4 py-2 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
                    >
                      <Eye size={14} className="text-teal-700 shrink-0" />
                      <span>View Cabin Categories ({(row.cabinCategories || []).length})</span>
                      {lowest !== null && (
                        <span className="rounded-md bg-white/95 border border-teal-200/80 px-2 py-0.5 text-[11px] font-mono font-bold text-teal-800 shadow-2xs">
                          from {formatCurrency(lowest, row.currency)}
                        </span>
                      )}
                    </button>

                    <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                      <Sparkles size={12} className="text-teal-600 shrink-0" />
                      <span>Click to view live staterooms, availability & fare breakdown in modal</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination Controls */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200/80">
          <div className="text-xs text-slate-500 font-medium">
            Showing page <strong className="text-slate-900 font-semibold">{pagination?.page ?? 1}</strong> of <strong className="text-slate-900 font-semibold">{pagination?.totalPages ?? 1}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={!pagination?.hasPreviousPage || loading}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage(current => current + 1)}
              disabled={!pagination?.hasNextPage || loading}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Slide-Over / Modal: Price Alerts Feed ────────────────────────────── */}
      {showAlertsPanel && (
        <div
          onClick={() => setShowAlertsPanel(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 md:p-6 animate-in fade-in duration-200 font-sans cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85dvh] sm:h-auto max-h-[88dvh] sm:max-h-[85vh] min-w-0 cursor-default"
          >
            <div className="flex items-center justify-between p-3.5 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50/50 gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                  <Flame size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">Dynamic Price Alerts Feed</h3>
                  <p className="text-xs font-normal text-slate-500 truncate">Live database triggers from automated and manual fleet price checks</p>
                </div>
              </div>
              <button
                onClick={() => setShowAlertsPanel(false)}
                className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 sm:p-6 overflow-y-auto overscroll-contain touch-pan-y space-y-3 flex-1 min-w-0">
              {priceAlerts.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <CheckCheck size={36} className="mx-auto text-emerald-500 opacity-80" />
                  <div className="font-semibold text-sm text-slate-800">All Caught Up!</div>
                  <div className="text-xs text-slate-500 font-normal">No unread price drop alerts right now. The radar is actively monitoring.</div>
                </div>
              ) : (
                priceAlerts.map(alert => {
                  const saved = alert.previousPrice && alert.currentPrice ? alert.previousPrice - alert.currentPrice : null
                  const percent = saved && alert.previousPrice ? Math.round((saved / alert.previousPrice) * 100) : null

                  return (
                    <div
                      key={alert.id}
                      className="rounded-xl border border-teal-200/80 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-white p-4 transition shadow-2xs hover:shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 truncate">
                              {alert.ship || alert.cruisePackage || alert.cruiseCode}
                            </span>
                            {percent && percent > 0 ? (
                              <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-950 border border-emerald-300">
                                {percent}% OFF
                              </span>
                            ) : null}
                          </div>

                          <div className="text-xs text-slate-600 font-medium">
                            {alert.vendor?.name || "Vendor"} · {alert.cruisePackage || alert.cruiseCode}
                          </div>

                          <div className="flex items-center gap-2 pt-1 text-xs tabular-nums">
                            <span className="line-through text-slate-400">
                              {formatCurrency(alert.previousPrice, alert.currency)}
                            </span>
                            <ArrowDownRight size={14} className="text-emerald-600" />
                            <span className="font-bold text-emerald-800 text-sm">
                              {formatCurrency(alert.currentPrice, alert.currency)}
                            </span>
                            {saved && saved > 0 && (
                              <span className="font-semibold text-emerald-700">
                                (Save {formatCurrency(saved, alert.currency)})
                              </span>
                            )}
                          </div>

                          {alert.tag?.assignedTo && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-900 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded w-fit mt-1">
                              <Bell size={11} className="text-teal-700 shrink-0" />
                              <span>Mention: @{alert.tag.assignedTo} · Tag: {alert.tag.label}</span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleMarkAlertRead(alert.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs shrink-0 cursor-pointer"
                        >
                          <Check size={13} />
                          <span>Mark Read</span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setShowAlertsPanel(false)}
                className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: View Cabin Categories ────────────────────────────────────── */}
      {cabinModalCruise && (
        <CabinCategoriesModal
          row={rows.find(r => r.id === cabinModalCruise.id) || cabinModalCruise}
          onClose={() => setCabinModalCruise(null)}
          onRefresh={() => handleGetFullDetails(rows.find(r => r.id === cabinModalCruise.id) || cabinModalCruise)}
          refreshJob={refreshJobs[cabinModalCruise.id]}
        />
      )}

      {/* ── Modal: Manage Cruise Tags ───────────────────────────────────────── */}
      {tagModalCruise && (
        <TagManagementModal
          row={tagModalCruise}
          assigneeOptions={tagDirectory.assignees}
          saving={savingTag}
          onClose={() => setTagModalCruise(null)}
          onCreate={payload => handleCreateTag(tagModalCruise.id, payload)}
          onUpdate={(tagId, payload) => handleUpdateTag(tagModalCruise.id, tagId, payload)}
          onDelete={tagId => handleDeleteTag(tagModalCruise.id, tagId)}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, highlight = false, active = false, onClick, subtext, icon: Icon, variant = "teal" }) {
  const isAmber = variant === "amber"

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border backdrop-blur-xs p-4 sm:p-5 shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? "cursor-pointer active:scale-98" : ""
      } ${
        active
          ? isAmber
            ? "border-orange-500 bg-gradient-to-br from-white via-amber-50/90 to-orange-100/70 ring-2 ring-orange-500/40 shadow-xs"
            : "border-emerald-500 bg-gradient-to-br from-white via-emerald-50/70 to-emerald-100/40 ring-2 ring-emerald-500/40 shadow-xs"
          : highlight
            ? isAmber
              ? "border-amber-300 bg-gradient-to-br from-white via-amber-50/50 to-orange-50/40 hover:border-amber-400 hover:shadow-orange-500/10"
              : "border-emerald-300 bg-gradient-to-br from-white via-emerald-50/40 to-teal-50/50 hover:border-emerald-400 hover:shadow-emerald-500/10"
            : "border-teal-200/80 bg-gradient-to-br from-white via-teal-50/30 to-teal-100/20 hover:border-teal-300 hover:shadow-teal-500/10"
      }`}
    >
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-xl ${
        isAmber ? "bg-amber-500/15" : "bg-teal-500/10"
      }`} />

      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className={`text-[11px] font-semibold uppercase tracking-wider truncate flex items-center gap-1.5 ${
          isAmber ? "text-amber-900" : "text-teal-800/90"
        }`}>
          {Icon && <Icon size={13} className={isAmber ? "text-amber-600 fill-amber-500/20" : "text-teal-600"} />}
          <span>{label}</span>
        </div>
        {active && (
          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shadow-2xs ${
            isAmber ? "text-orange-950 bg-amber-200 border border-amber-300" : "text-emerald-800 bg-emerald-200/90"
          }`}>
            Active
          </span>
        )}
      </div>
      <div className={`relative z-10 mt-2 text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${
        isAmber ? "text-slate-950" : "text-teal-950"
      }`}>
        {value}
      </div>
      {subtext && (
        <div className={`relative z-10 mt-1.5 text-[11px] font-semibold truncate ${
          isAmber ? "text-amber-800" : "text-emerald-700"
        }`}>
          {subtext}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, icon: Icon, highlight = false }) {
  return (
    <div className={`rounded-xl px-3.5 py-2 border shadow-2xs flex flex-col justify-between ${
      highlight ? "bg-teal-50/70 border-teal-200/80" : "bg-white border-slate-200/90"
    }`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {Icon ? <Icon size={12} /> : null}
        <span>{label}</span>
      </div>
      <div className={`mt-1 font-semibold text-sm tabular-nums ${highlight ? "text-teal-950 text-base font-bold" : "text-slate-900"}`}>{value}</div>
    </div>
  )
}

function DateField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type="date"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
      />
    </div>
  )
}

function TagManagementModal({
  row,
  assigneeOptions = [],
  saving = false,
  onClose,
  onCreate,
  onUpdate,
  onDelete
}) {
  const defaultColor = "#0d9488"
  const [editingTagId, setEditingTagId] = useState(null)
  const [form, setForm] = useState({
    label: "Employee Booking",
    assignedTo: "",
    note: "",
    color: defaultColor,
    trackedLowestPrice: ""
  })
  const tags = row.tags || []

  const resetForm = () => {
    setEditingTagId(null)
    setForm({
      label: "Employee Booking",
      assignedTo: "",
      note: "",
      color: defaultColor,
      trackedLowestPrice: ""
    })
  }

  const startEdit = (tagItem) => {
    setEditingTagId(tagItem.id)
    setForm({
      label: tagItem.label || "",
      assignedTo: tagItem.assignedTo || "",
      note: tagItem.note || "",
      color: tagItem.color || defaultColor,
      trackedLowestPrice: tagItem.trackedLowestPrice ? String(tagItem.trackedLowestPrice) : ""
    })
  }

  const submit = async () => {
    if (!form.label.trim()) return

    const payload = {
      label: form.label.trim(),
      assignedTo: form.assignedTo.trim(),
      note: form.note.trim(),
      color: form.color,
      ...(form.trackedLowestPrice ? { trackedLowestPrice: Number(form.trackedLowestPrice) } : {})
    }

    if (editingTagId) {
      await onUpdate(editingTagId, payload)
    } else {
      await onCreate(payload)
    }

    resetForm()
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 md:p-6 animate-in fade-in duration-200 font-sans cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[88dvh] sm:h-auto max-h-[92dvh] sm:max-h-[90vh] min-w-0 cursor-default"
      >
        <div className="flex items-start justify-between p-3.5 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50/50 gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] sm:text-[11px] font-semibold text-teal-800 uppercase tracking-wider bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full inline-block">Cruise Tag & Mention Management</div>
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 mt-1 break-words leading-snug">{row.package || row.code}</h2>
            <div className="text-xs text-slate-500 font-medium truncate mt-0.5">{row.ship} · {getCruiseDisplayId(row)}</div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3.5 sm:p-6 overflow-y-auto overscroll-contain touch-pan-y grid md:grid-cols-2 gap-4 sm:gap-6 flex-1 min-w-0">
          {/* Left Column: Existing Tags */}
          <div className="space-y-3 min-w-0">
            <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Active Tags ({tags.length})</div>
            {tags.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 font-normal">
                No tags assigned to this cruise yet.
              </div>
            ) : (
              <div className="space-y-2">
                {tags.map(tagItem => (
                  <div
                    key={tagItem.id}
                    className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50 hover:bg-slate-50 transition shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          background: `${tagItem.color || defaultColor}20`,
                          color: tagItem.color || defaultColor,
                          border: `1px solid ${tagItem.color || defaultColor}40`
                        }}
                      >
                        <Tag size={11} />
                        {tagItem.label}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(tagItem)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200 transition cursor-pointer"
                          title="Edit tag"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => onDelete(tagItem.id)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                          title="Delete tag"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {tagItem.assignedTo && (
                      <div className="text-xs font-semibold text-teal-800 flex items-center gap-1">
                        <Bell size={11} className="text-teal-600" />
                        <span>Mention: @{tagItem.assignedTo}</span>
                      </div>
                    )}

                    {tagItem.note && (
                      <div className="text-xs text-slate-600 font-normal bg-white p-2 rounded-lg border border-slate-100">
                        {tagItem.note}
                      </div>
                    )}

                    {tagItem.trackedLowestPrice && (
                      <div className="text-[11px] text-slate-500 font-medium tabular-nums">
                        Tracked Baseline: <strong>{formatCurrency(tagItem.trackedLowestPrice, row.currency)}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Form */}
          <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                {editingTagId ? "Edit Tag" : "Add New Tag"}
              </span>
              {editingTagId && (
                <button
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tag Label *</label>
              <input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                placeholder="e.g. Employee Booking, VIP"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Assign / Mention User</label>
              <select
                value={form.assignedTo}
                onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              >
                <option value="">No assignee</option>
                {assigneeOptions.map(u => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Baseline Price / Threshold (Optional)</label>
              <input
                type="number"
                value={form.trackedLowestPrice}
                onChange={e => setForm(f => ({ ...f, trackedLowestPrice: e.target.value }))}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 tabular-nums"
                placeholder="e.g. 2600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tag Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="h-8 w-12 rounded cursor-pointer border border-slate-200 bg-white p-0.5"
                />
                <span className="text-xs font-mono text-slate-600">{form.color}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Note / Instructions</label>
              <textarea
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full h-20 rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 resize-none"
                placeholder="Add special booking notes or instructions..."
              />
            </div>

            <button
              onClick={submit}
              disabled={saving || !form.label.trim()}
              className="w-full h-9 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
              ) : editingTagId ? (
                <Check size={14} />
              ) : (
                <Plus size={14} />
              )}
              <span>{editingTagId ? "Update Tag" : "Add Tag"}</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function CabinCategoriesModal({
  row,
  onClose,
  onRefresh,
  refreshJob
}) {
  const [activeGroup, setActiveGroup] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterAvailOnly, setFilterAvailOnly] = useState(false)
  const [filterDropsOnly, setFilterDropsOnly] = useState(false)
  const [localRefreshing, setLocalRefreshing] = useState(false)

  const cabinCategories = useMemo(() => row.cabinCategories || [], [row.cabinCategories])
  const cabinGroups = useMemo(() => buildCabinGroups(cabinCategories), [cabinCategories])

  const availPrices = useMemo(() => {
    return cabinCategories
      .filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0) || !c.avlResult)
      .map(c => Number(c.cabinPrice ?? c.price ?? 0))
      .filter(p => Number.isFinite(p) && p > 0)
  }, [cabinCategories])

  const lowestPrice = availPrices.length > 0 ? Math.min(...availPrices) : (row.lowestPrice ? Number(row.lowestPrice) : null)

  const shipName = row.ship || row.shipName || "Cruise Ship"
  const seatsAvailable = Number(row.seatsAvailable ?? 0)
  const totalCapacity = Number(row.totalCapacity ?? 0)
  const loadFactor = getLoadFactor(row)

  const isRunning = refreshJob?.status === "started" || refreshJob?.status === "in_progress"
  const isCooldown = refreshJob?.status === "cooldown"
  const remainingSec = isRunning ? Math.ceil((refreshJob.remaining ?? 0) / 1000) : isCooldown ? (refreshJob.retryAfter ?? 0) : 0
  const isRefreshingActive = isRunning || localRefreshing

  const handleTriggerRefresh = async () => {
    setLocalRefreshing(true)
    try {
      await onRefresh?.()
    } finally {
      setTimeout(() => setLocalRefreshing(false), 2500)
    }
  }

  // Filter groups and categories
  const filteredGroups = useMemo(() => {
    return cabinGroups
      .map(group => {
        if (activeGroup !== "all" && group.group !== activeGroup) return null

        const filteredCategories = group.categories.filter(cat => {
          const codeMatch = !searchQuery.trim() ||
            (cat.code || "").toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
            (cat.name || cat.description || "").toLowerCase().includes(searchQuery.toLowerCase().trim())
          if (!codeMatch) return false

          const catAvail = Number(cat.avail ?? cat.available ?? 0)
          const isAvail = cat.avlResult === "OK" || cat.status === "Available" || catAvail > 0
          if (filterAvailOnly && !isAvail) return false

          const catPrice = Number(cat.cabinPrice || cat.price || 0)
          const isDrop = catPrice > 0 && lowestPrice !== null && catPrice === lowestPrice
          if (filterDropsOnly && !isDrop) return false

          return true
        })

        if (filteredCategories.length === 0) return null

        const groupPrices = filteredCategories
          .map(c => Number(c.cabinPrice || c.price || 0))
          .filter(p => Number.isFinite(p) && p > 0)
        const groupMin = groupPrices.length > 0 ? Math.min(...groupPrices) : null
        const groupMax = groupPrices.length > 0 ? Math.max(...groupPrices) : null

        return {
          ...group,
          categories: filteredCategories,
          groupMin,
          groupMax
        }
      })
      .filter(Boolean)
  }, [cabinGroups, activeGroup, searchQuery, filterAvailOnly, filterDropsOnly, lowestPrice])

  const totalVisibleCategories = filteredGroups.reduce((acc, g) => acc + g.categories.length, 0)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 md:p-6 animate-in fade-in duration-200 font-sans cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[92dvh] sm:h-[88vh] max-h-[92dvh] sm:max-h-[88vh] min-w-0 cursor-default"
      >
        {/* Live Scanner Banner */}
        {isRefreshingActive && (
          <div className="bg-gradient-to-r from-teal-500/15 via-emerald-500/20 to-teal-500/15 border-b border-teal-200/90 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 text-xs font-semibold text-teal-950 animate-pulse shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              <RefreshCw size={13} className="animate-spin text-teal-700 shrink-0" />
              <span className="truncate">Live Scanner Active: Scraping live cabin rates for {shipName}…</span>
            </div>
            {remainingSec > 0 && (
              <span className="font-mono text-[10.5px] font-bold text-teal-800 bg-white/90 border border-teal-200 px-2 py-0.5 rounded shadow-2xs shrink-0">
                ~{fmtSeconds(remainingSec)}
              </span>
            )}
          </div>
        )}

        {/* Compact Modal Top Bar */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-teal-50 border border-teal-200/80 text-teal-700 shrink-0">
              <Sparkles size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-sm md:text-base font-bold text-slate-900 truncate">
                  {row.package || row.code}
                </h2>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700 shrink-0">
                  {shipName}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium truncate hidden sm:block">
                {row.vendor?.name || "Vendor"} · {getCruiseRouteLabel(row)} · {row.nights}N
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Modal Body Container (Everything scrolls together on mobile & desktop) */}
        <div className="p-3 sm:p-5 overflow-y-auto overscroll-contain touch-pan-y space-y-3.5 flex-1 min-w-0 bg-slate-50/60">
          {/* Cruise Metadata & Badges Card */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-2xs space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-teal-900 bg-teal-100/70 border border-teal-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                <Sparkles size={11} className="text-teal-700 shrink-0" />
                <span>Live Stateroom Inventory</span>
              </span>
              <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10.5px] font-semibold text-white">
                {row.vendor?.name || "Vendor"}
              </span>
              <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-700">
                {getCruiseDisplayId(row)}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
                loadFactor >= 85
                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                  : loadFactor >= 60
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-teal-100 text-teal-800 border border-teal-200"
              }`}>
                Load {loadFactor}% ({seatsAvailable.toLocaleString()} / {totalCapacity.toLocaleString()} avail)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 pt-0.5">
              <span className="font-bold text-slate-900">{shipName}</span>
              <span>·</span>
              <span>{getCruiseRouteLabel(row)}</span>
              <span>·</span>
              <span className="font-semibold">{row.nights} Nights</span>
              <span>·</span>
              <span>{formatDate(row.startDate)} to {formatDate(row.endDate)}</span>
            </div>
          </div>

          {/* Group Tabs & Filter Bar in Body */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs space-y-2.5">
            {/* Group Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveGroup("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeGroup === "all"
                    ? "bg-teal-700 text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                All Groups ({cabinCategories.length})
              </button>
              {cabinGroups.map((group) => {
                const groupPrices = group.categories
                  .map(c => Number(c.cabinPrice || c.price || 0))
                  .filter(p => Number.isFinite(p) && p > 0)
                const minP = groupPrices.length > 0 ? Math.min(...groupPrices) : null
                const isActive = activeGroup === group.group
                return (
                  <button
                    key={group.group}
                    type="button"
                    onClick={() => setActiveGroup(group.group)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-teal-700 text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span>{group.group}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                      isActive ? "bg-teal-800 text-teal-100" : "bg-slate-100 text-slate-500"
                    }`}>
                      {minP ? formatCurrency(minP, row.currency) : "WTL"}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search category code e.g. SL1, BA, IS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterAvailOnly(!filterAvailOnly)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    filterAvailOnly
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-bold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  In Stock Only
                </button>
                <button
                  type="button"
                  onClick={() => setFilterDropsOnly(!filterDropsOnly)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    filterDropsOnly
                      ? "bg-amber-100 text-amber-950 border-amber-400 shadow-2xs font-bold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Lowest / Drop Fare
                </button>
              </div>
            </div>
          </div>

          {/* Categories Cards Grid */}
          {filteredGroups.length === 0 ? (
            <div className="text-center py-10 text-slate-500 space-y-2 bg-white rounded-xl border border-dashed border-slate-200">
              <div className="font-semibold text-sm text-slate-800">No categories found</div>
              <div className="text-xs text-slate-500 font-normal">
                Try resetting your search query or switching category group filter.
              </div>
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGroups.map((group) => (
                <div key={group.group} className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between">
                  <div>
                    {/* Group Header */}
                    <div className="mb-2.5 flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-900">{group.group}</span>
                      {group.groupMin !== null ? (
                        <span className="rounded-full bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 text-xs font-bold text-teal-800 shadow-2xs tabular-nums">
                          {group.groupMax && group.groupMax > group.groupMin
                            ? `from ${formatCurrency(group.groupMin, row.currency)} to ${formatCurrency(group.groupMax, row.currency)}`
                            : `from ${formatCurrency(group.groupMin, row.currency)}`}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 font-medium">WTL</span>
                      )}
                    </div>

                    {/* Table Headers */}
                    <div className="grid grid-cols-12 items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1.5 px-1 border-b border-slate-100 select-none">
                      <span className="col-span-4">Category</span>
                      <span className="col-span-4 text-right pr-2">Live Fare</span>
                      <span className="col-span-4 text-right">Avail</span>
                    </div>

                    {/* Rows */}
                    <div className="space-y-1 mt-1.5">
                      {group.categories.map((cat) => {
                        const catPrice = Number(cat.cabinPrice || cat.price || 0)
                        const catAvail = Number(cat.avail ?? cat.available ?? 0)
                        const isCatSoldOut = catAvail === 0 || cat.avlResult === "WTL"
                        const isCatLow = catAvail > 0 && catAvail <= 2
                        const isLowestInGroup = catPrice > 0 && group.groupMin !== null && catPrice === group.groupMin
                        const isCruiseLowest = catPrice > 0 && lowestPrice !== null && catPrice === lowestPrice

                        return (
                          <div
                            key={cat.code}
                            className={`grid grid-cols-12 items-center text-xs py-1.5 px-1.5 sm:px-2 rounded-lg border transition-colors ${
                              isCruiseLowest
                                ? "bg-amber-50/90 border-amber-300 shadow-xs"
                                : isLowestInGroup
                                  ? "bg-teal-50/50 border-teal-200/80"
                                  : "border-slate-50 hover:bg-slate-50/70"
                            }`}
                          >
                            {/* Col 1: Category */}
                            <div className="col-span-4 flex items-center gap-1 min-w-0">
                              <span className={`font-semibold truncate text-[11px] sm:text-xs ${
                                isCruiseLowest ? "text-amber-950 font-bold" : isLowestInGroup ? "text-teal-950 font-bold" : "text-slate-900"
                              }`}>
                                {cat.code}
                              </span>
                              {isCruiseLowest ? (
                                <span className="inline-flex items-center gap-0.5 text-[8.5px] sm:text-[9px] font-bold text-amber-950 bg-amber-200 border border-amber-400 px-1 py-0.2 rounded shrink-0">
                                  <TrendingDown size={9} className="shrink-0" />
                                  <span>Drop</span>
                                </span>
                              ) : isLowestInGroup ? (
                                <span className="text-[8.5px] sm:text-[9px] font-semibold text-teal-800 bg-teal-100 border border-teal-300 px-1 py-0.2 rounded shrink-0">
                                  Low
                                </span>
                              ) : null}
                            </div>

                            {/* Col 2: Fare */}
                            <div className="col-span-4 text-right pr-2">
                              {catPrice > 0 ? (
                                <span className={`text-xs tabular-nums ${
                                  isCruiseLowest
                                    ? "font-bold text-amber-950 bg-amber-100 px-1.5 py-0.5 rounded"
                                    : isLowestInGroup
                                      ? "font-bold text-teal-900"
                                      : "font-semibold text-slate-800"
                                }`}>
                                  {formatCurrency(catPrice, row.currency)}
                                </span>
                              ) : (
                                <span className="text-[10.5px] text-slate-400 font-medium">
                                  {cat.avlResult === "WTL" ? "WTL" : cat.avlResult || cat.status || "N/A"}
                                </span>
                              )}
                            </div>

                            {/* Col 3: Avail */}
                            <div className="col-span-4 text-right">
                              {isCatSoldOut ? (
                                <span className="inline-flex items-center text-[9.5px] sm:text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 whitespace-nowrap">
                                  0 (WTL)
                                </span>
                              ) : isCatLow ? (
                                <span className="inline-flex items-center gap-0.5 text-[9.5px] sm:text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                                  <Zap size={9} className="text-amber-600 shrink-0" />
                                  <span>{catAvail} left</span>
                                </span>
                              ) : (
                                <span className="text-[10.5px] sm:text-[11px] font-normal text-slate-500 whitespace-nowrap tabular-nums">
                                  {catAvail} avail
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-600 font-medium">
            <span><strong>{totalVisibleCategories}</strong> categories</span>
            <span>·</span>
            <span>Low: <strong className="text-emerald-700 font-bold">{lowestPrice ? formatCurrency(lowestPrice, row.currency) : "WTL"}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh ? (
              <button
                type="button"
                onClick={handleTriggerRefresh}
                disabled={isRefreshingActive}
                className={`h-8.5 sm:h-9.5 px-3 sm:px-4 rounded-xl border transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 sm:gap-2 text-xs font-bold ${
                  isRefreshingActive
                    ? "bg-teal-50 border-teal-300 text-teal-900 ring-2 ring-teal-500/20"
                    : "border-teal-600/90 bg-teal-50 hover:bg-teal-100/90 text-teal-800 hover:text-teal-950 active:scale-95"
                }`}
              >
                <RefreshCw
                  size={13}
                  className={`text-teal-700 transition-transform ${
                    isRefreshingActive ? "animate-spin" : "group-hover:rotate-45"
                  }`}
                />
                <span>
                  {isRefreshingActive
                    ? `Scanning… ${remainingSec > 0 ? `(~${fmtSeconds(remainingSec)})` : ""}`
                    : "Refresh Live Cabins"}
                </span>
              </button>
            ) : null}

            <button
              onClick={onClose}
              className="h-8.5 sm:h-9.5 px-3.5 sm:px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
