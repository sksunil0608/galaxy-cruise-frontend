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
  Flame
} from "lucide-react"
import { toast } from "sonner"

import {
  fetchCruises,
  fetchCruiseTags,
  fetchCruisePriceAlerts,
  fetchShips,
  fetchUsers,
  fetchVendors,
  refreshCruiseCabins,
  getCruiseRefreshStatus
} from "../api"
import { buildCabinGroups, getCruiseDisplayId, getCruiseRouteLabel, getLoadFactor } from "../cruise-helpers"

function fmtSeconds(sec) {
  const s = Math.max(0, Math.ceil(sec))
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

const PAGE_SIZE = 20

function formatDate(value) {
  if (!value) {
    return "--"
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })
}

function formatCurrency(amount, currency = "GBP") {
  return `${currency === "GBP" ? "\u00A3" : "$"}${Number(amount ?? 0).toLocaleString()}`
}

export default function TaggedCruisesPage() {
  const [loading, setLoading] = useState(true)
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

  // Debounce tag input changes so typing doesn't spam fetchCruises requests
  useEffect(() => {
    setAppliedFilters(current => {
      if (current.tag === debouncedTag) return current
      return { ...current, tag: debouncedTag }
    })
    setPage(1)
  }, [debouncedTag])

  // Ref to track notified price drops to prevent duplicate toasts
  const notifiedDropsRef = useRef(new Set())

  useEffect(() => {
    let active = true

    const loadDirectory = async () => {
      try {
        const [tagResponse, vendorResponse, shipResponse, userResponse] = await Promise.all([
          fetchCruiseTags().catch(() => ({ data: {} })),
          fetchVendors({ limit: 100 }).catch(() => ({ data: [] })),
          fetchShips({ limit: 100 }).catch(() => ({ data: [] })),
          fetchUsers().catch(() => ({ data: [] }))
        ])

        if (!active) {
          return
        }

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
        if (active) {
          console.warn("Failed to load tagged cruise lookups:", err?.message || err)
        }
      }
    }

    loadDirectory()

    return () => {
      active = false
    }
  }, [])

  const loadCruises = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setError("")

      const response = await fetchCruises({
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
      })

      const data = response.data || []
      setRows(data)
      setPagination(response.pagination || null)

      // ── Scan & Trigger Toast Notifications for Price Drops with Team Mentions ──
      data.forEach(row => {
        const availPrices = (row.cabinCategories || [])
          .filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0) || !c.avlResult)
          .map(c => Number(c.cabinPrice ?? c.price ?? 0))
          .filter(p => Number.isFinite(p) && p > 0)
        const currentLowest = availPrices.length > 0 ? Math.min(...availPrices) : null

        const tags = row.tags || []
        tags.forEach(tag => {
          const trackedLow = Number(tag.trackedLowestPrice)
          const lastSeen = Number(tag.lastSeenPrice)
          const isDrop = tag.lastPriceDropAt || (Number.isFinite(trackedLow) && currentLowest && currentLowest < trackedLow) || (Number.isFinite(lastSeen) && currentLowest && currentLowest < lastSeen)
          const dropKey = `${row.id}-${tag.id}-${currentLowest}`

          if (isDrop && !notifiedDropsRef.current.has(dropKey)) {
            notifiedDropsRef.current.add(dropKey)
            const basePrice = Number.isFinite(trackedLow) ? trackedLow : lastSeen
            const savedAmount = basePrice && currentLowest ? basePrice - currentLowest : null
            const savedPercent = savedAmount && basePrice ? Math.round((savedAmount / basePrice) * 100) : null

            toast.success(
              <div className="flex flex-col gap-1 py-0.5">
                <div className="flex items-center gap-1.5 font-bold text-sm text-emerald-900">
                  <TrendingDown size={16} className="text-emerald-600 shrink-0" />
                  <span>Price Drop Alert!</span>
                  {savedPercent && savedPercent > 0 ? (
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                      {savedPercent}% OFF
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-700 leading-snug">
                  <strong>{row.ship || row.package}</strong> dropped to <strong className="text-emerald-800">{formatCurrency(currentLowest, row.currency)}</strong>
                  {savedAmount && savedAmount > 0 ? ` (Save ${formatCurrency(savedAmount, row.currency)})` : ""}!
                </div>
                {tag.assignedTo && (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-md mt-1 w-fit">
                    <Bell size={11} className="shrink-0" />
                    <span>Mention: @{tag.assignedTo} · Tag: {tag.label}</span>
                  </div>
                )}
              </div>,
              {
                duration: 9000,
                id: `price-drop-${row.id}-${tag.id}`
              }
            )
          }
        })
      })
    } catch (err) {
      setError(err.message || "Failed to load tagged cruises")
      setRows([])
      setPagination(null)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [appliedFilters, page])

  useEffect(() => {
    loadCruises()
  }, [loadCruises])

  // rowId -> { status, estimatedMs, remaining, error, retryAfter }
  const [refreshJobs, setRefreshJobs] = useState({})
  const pollRefs = useRef({})

  useEffect(() => {
    return () => {
      Object.values(pollRefs.current).forEach(clearInterval)
    }
  }, [])

  function startPolling(rowId, cruiseCode) {
    if (pollRefs.current[rowId]) clearInterval(pollRefs.current[rowId])
    pollRefs.current[rowId] = setInterval(async () => {
      try {
        const s = await getCruiseRefreshStatus(cruiseCode)
        setRefreshJobs(prev => ({ ...prev, [rowId]: s }))
        if (s.status === "cooldown" || s.status === "idle") {
          clearInterval(pollRefs.current[rowId])
          delete pollRefs.current[rowId]
          if (s.success) loadCruises({ silent: true })
        }
      } catch { /* network hiccup — keep polling */ }
    }, 3000)
  }

  async function handleGetFullDetails(row) {
    const cruiseCode = row.code ?? row.id
    const vendorKey = row.vendor?.slug ?? row.vendorKey ?? row.source
    if (!vendorKey) {
      setRefreshJobs(prev => ({ ...prev, [row.id]: { status: "error", error: "Vendor unknown — cannot refresh." } }))
      return
    }
    try {
      const result = await refreshCruiseCabins(cruiseCode, vendorKey)
      setRefreshJobs(prev => ({ ...prev, [row.id]: { status: result.status, estimatedMs: result.estimatedMs, remaining: result.estimatedMs } }))
      if (result.status === "started" || result.status === "in_progress") startPolling(row.id, cruiseCode)
    } catch (err) {
      const offline = err.message?.toLowerCase().includes("fetch") || err.message?.toLowerCase().includes("network")
      setRefreshJobs(prev => ({ ...prev, [row.id]: { status: "error", error: offline ? "Scraper server is offline." : err.message, retryAfter: err.retryAfter } }))
    }
  }

  const summary = useMemo(() => {
    const totalTagged = pagination?.total ?? rows.length
    const employees = new Set(
      rows.flatMap(row => (row.tags || []).map(tag => tag.assignedTo).filter(Boolean))
    ).size
    const ships = new Set(rows.map(row => row.shipCode || row.ship).filter(Boolean)).size
    const drops = rows.reduce((count, row) => {
      const availPrices = (row.cabinCategories || [])
        .filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0) || !c.avlResult)
        .map(c => Number(c.cabinPrice ?? c.price ?? 0))
        .filter(p => Number.isFinite(p) && p > 0)
      const lowest = availPrices.length > 0 ? Math.min(...availPrices) : null

      const hasDrop = (row.tags || []).some(tag => {
        const trackedLow = Number(tag.trackedLowestPrice)
        const lastSeen = Number(tag.lastSeenPrice)
        return Boolean(tag.lastPriceDropAt) ||
          (Number.isFinite(trackedLow) && lowest && lowest < trackedLow) ||
          (Number.isFinite(lastSeen) && lowest && lowest < lastSeen)
      })

      return count + (hasDrop ? 1 : 0)
    }, 0)

    return { totalTagged, employees, ships, drops }
  }, [pagination, rows])

  const vendorOptions = useMemo(
    () => lookupOptions.vendors,
    [lookupOptions]
  )

  const shipOptions = useMemo(
    () => lookupOptions.ships,
    [lookupOptions]
  )

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
      const droppedIds = rows.filter(row => {
        const availPrices = (row.cabinCategories || [])
          .filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0) || !c.avlResult)
          .map(c => Number(c.cabinPrice ?? c.price ?? 0))
          .filter(p => Number.isFinite(p) && p > 0)
        const lowest = availPrices.length > 0 ? Math.min(...availPrices) : null
        return (row.tags || []).some(tag => {
          const trackedLow = Number(tag.trackedLowestPrice)
          const lastSeen = Number(tag.lastSeenPrice)
          return Boolean(tag.lastPriceDropAt) ||
            (Number.isFinite(trackedLow) && lowest && lowest < trackedLow) ||
            (Number.isFinite(lastSeen) && lowest && lowest < lastSeen)
        })
      }).map(r => r.id)
      setExpandedRows(new Set(droppedIds))
    }
  }

  const displayedRows = useMemo(() => {
    if (!priceDropOnly) return rows
    return rows.filter(row => {
      const availPrices = (row.cabinCategories || [])
        .filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0) || !c.avlResult)
        .map(c => Number(c.cabinPrice ?? c.price ?? 0))
        .filter(p => Number.isFinite(p) && p > 0)
      const lowest = availPrices.length > 0 ? Math.min(...availPrices) : null

      return (row.tags || []).some(tag => {
        const trackedLow = Number(tag.trackedLowestPrice)
        const lastSeen = Number(tag.lastSeenPrice)
        return Boolean(tag.lastPriceDropAt) ||
          (Number.isFinite(trackedLow) && lowest && lowest < trackedLow) ||
          (Number.isFinite(lastSeen) && lowest && lowest < lastSeen)
      })
    })
  }, [rows, priceDropOnly])

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
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4">
      {/* ── Top Header Banner ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/80 backdrop-blur-xs px-3.5 py-1 text-[11px] font-bold text-teal-800 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
            </span>
            <span>Employee Booking Queue · Tagged Inventory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Tagged Cruises & Price Drop Radar
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-600 max-w-3xl leading-relaxed">
            Saved tags from cruise search, persisted in the database for team follow-up, price drop monitoring, and booking review.
          </p>
        </div>

        <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tagged Cruises" value={summary.totalTagged} />
          <StatCard label="Assigned Employees" value={summary.employees} />
          <StatCard label="Ships Covered" value={summary.ships} />
          <StatCard
            label="Price Drops Tracked"
            value={summary.drops}
            highlight={summary.drops > 0}
            active={priceDropOnly}
            onClick={togglePriceDropFilter}
            subtext={summary.drops > 0 ? (priceDropOnly ? "Filtering drops (click to reset)" : "Click to view & expand drops") : null}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tag</label>
            <input
              list="tagged-tag-options"
              value={filters.tag}
              onChange={event => setF("tag", event.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              placeholder="e.g. Priority"
            />
            <datalist id="tagged-tag-options">
              {tagDirectory.tags.map(item => (
                <option key={item.label} value={item.label} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assigned to</label>
            <select
              value={filters.assignedTo}
              onChange={event => setF("assignedTo", event.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
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
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Vendor</label>
            <select
              value={filters.vendorName}
              onChange={event => setF("vendorName", event.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
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
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ship</label>
            <select
              value={filters.ship}
              onChange={event => setF("ship", event.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
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
            className="inline-flex items-center gap-2 h-10 px-6 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold shadow-sm shadow-emerald-700/20 active:scale-95 transition cursor-pointer"
          >
            <Filter size={15} />
            <span>Apply Filters</span>
          </button>
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold active:scale-95 transition cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <button
            onClick={togglePriceDropFilter}
            className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border text-xs sm:text-sm font-bold active:scale-95 transition cursor-pointer ${priceDropOnly
                ? "bg-emerald-700 text-white border-emerald-800 shadow-sm"
                : summary.drops > 0
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
              }`}
          >
            <Flame size={14} className={summary.drops > 0 ? "text-amber-500" : ""} />
            <span>{priceDropOnly ? "Showing Drops Only" : `Price Drops (${summary.drops})`}</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500 font-medium">
            {loading ? "Loading tagged cruises..." : `${pagination?.total ?? rows.length} tagged cruise${(pagination?.total ?? rows.length) === 1 ? "" : "s"}`}
          </div>
          <div className="text-sm text-slate-500 font-medium">
            Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            Loading tagged cruises...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-12 text-center text-sm text-rose-700">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            No tagged cruises found for the current filters.
          </div>
        ) : (
          <div className="grid gap-4">
            {displayedRows.map(row => {
              const availPrices = (row.cabinCategories || [])
                .filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0) || !c.avlResult)
                .map(c => Number(c.cabinPrice ?? c.price ?? 0))
                .filter(p => Number.isFinite(p) && p > 0)
              const lowest = availPrices.length > 0 ? Math.min(...availPrices) : null

              const trackedLow = (() => {
                const vals = (row.tags || [])
                  .map(t => Number(t.trackedLowestPrice))
                  .filter(v => Number.isFinite(v))
                return vals.length > 0 ? Math.min(...vals) : null
              })()

              const lastSeen = (() => {
                const vals = (row.tags || [])
                  .map(t => Number(t.lastSeenPrice))
                  .filter(v => Number.isFinite(v))
                return vals.length > 0 ? Math.min(...vals) : null
              })()

              const isExpanded = expandedRows.has(row.id)
              const cabinGroups = buildCabinGroups(row.cabinCategories || [])

              // ── Price Drop Calculations ──
              const dropTags = (row.tags || []).filter(t => t.lastPriceDropAt || (trackedLow && lowest && lowest < trackedLow))
              const hasPriceDrop = dropTags.length > 0 || (trackedLow && lowest && lowest < trackedLow)
              const primaryDropTag = dropTags[0] || (row.tags || [])[0]

              const priceDiff = (trackedLow && lowest) ? lowest - trackedLow : null
              const percentDiff = (priceDiff && trackedLow) ? Math.round((Math.abs(priceDiff) / trackedLow) * 100) : null

              // ── Availability Trend Calculations ──
              const seatsAvailable = Number(row.seatsAvailable ?? 0)
              const totalCapacity = Number(row.totalCapacity ?? 0)
              const loadFactor = getLoadFactor(row)
              const isLowAvailability = seatsAvailable > 0 && seatsAvailable <= 15
              const isSoldOut = seatsAvailable === 0 && totalCapacity > 0

              return (
                <div
                  key={row.id}
                  className={`rounded-2xl border transition p-4.5 ${hasPriceDrop
                    ? "border-emerald-300 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20 shadow-xs"
                    : "border-slate-200/80 bg-slate-50/40 hover:bg-slate-50"
                    }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                          {row.vendor?.name || "Vendor"}
                        </span>
                        <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                          {getCruiseDisplayId(row)}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${loadFactor >= 85
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : loadFactor >= 60
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-teal-100 text-teal-800 border border-teal-200"
                          }`}>
                          Load {loadFactor}%
                        </span>
                        {hasPriceDrop && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs animate-pulse">
                            <TrendingDown size={13} />
                            Price Drop Active
                          </span>
                        )}
                        {isLowAvailability && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-200 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                            <AlertTriangle size={12} />
                            Only {seatsAvailable} cabins left!
                          </span>
                        )}
                      </div>

                      <h2 className="text-xl font-bold text-slate-900 leading-snug">{row.package}</h2>
                      <div className="text-sm font-medium text-slate-500">
                        {row.ship} · {getCruiseRouteLabel(row)} · {row.nights}N
                      </div>

                      {/* Tag badges */}
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {(row.tags || []).map(tag => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-2xs"
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
                      </div>
                    </div>

                    {/* ── Metric Grid & Comparison Columns ── */}
                    <div className="grid gap-2.5 text-sm text-slate-600 sm:grid-cols-2 md:grid-cols-3 lg:min-w-[480px]">
                      <Metric label="Departure" value={formatDate(row.startDate)} icon={CalendarDays} />
                      <Metric label="Arrival" value={formatDate(row.endDate)} icon={CalendarDays} />

                      {/* Availability Trend Column */}
                      <div className="rounded-xl bg-white px-3.5 py-2.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <span>Avail. / Total Cabins</span>
                          {isLowAvailability ? (
                            <span className="text-rose-600 font-extrabold">Tight</span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="font-bold text-slate-900 text-sm">
                            {seatsAvailable.toLocaleString()} / {totalCapacity.toLocaleString()}
                          </span>
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${isSoldOut
                            ? "bg-rose-100 text-rose-700"
                            : isLowAvailability
                              ? "bg-rose-50 text-rose-600"
                              : "bg-emerald-50 text-emerald-700"
                            }`}>
                            {isSoldOut ? "Sold Out" : isLowAvailability ? "Low Avail" : "In Stock"}
                          </span>
                        </div>
                      </div>

                      <Metric label="Current Lowest" value={lowest !== null ? formatCurrency(lowest, row.currency) : "WTL"} highlight />

                      <Metric
                        label="Tracked Low (at Tag)"
                        value={trackedLow !== null ? formatCurrency(trackedLow, row.currency) : "--"}
                      />

                      {/* ── Price Comparison Column ── */}
                      <div className="rounded-xl bg-white px-3.5 py-2.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <TrendingDown size={12} />
                          <span>Price Comparison</span>
                        </div>
                        <div className="mt-1">
                          {priceDiff !== null ? (
                            priceDiff < 0 ? (
                              <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-xs">
                                <ArrowDownRight size={14} className="shrink-0" />
                                <span>-{formatCurrency(Math.abs(priceDiff), row.currency)} ({percentDiff}%)</span>
                              </div>
                            ) : priceDiff > 0 ? (
                              <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs">
                                <TrendingUp size={13} className="shrink-0" />
                                <span>+{formatCurrency(priceDiff, row.currency)} (+{percentDiff}%)</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-teal-700 font-bold text-xs">
                                <CheckCircle size={13} className="shrink-0" />
                                <span>Steady Low</span>
                              </div>
                            )
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">Baseline Set</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Prominent Price Drop & Team Mention Banner ── */}
                  {hasPriceDrop && (
                    <div className="mt-4 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 p-3.5 text-sm text-emerald-950 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                            <TrendingDown size={18} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                              <span>🔥 Price Drop Confirmed!</span>
                              {priceDiff && priceDiff < 0 ? (
                                <span className="rounded-full bg-emerald-200/90 px-2.5 py-0.5 text-xs font-black text-emerald-900">
                                  Save {formatCurrency(Math.abs(priceDiff), row.currency)} ({percentDiff}% off)
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-700 mt-0.5">
                              {primaryDropTag?.assignedTo ? (
                                <span className="font-bold text-teal-900 bg-white/80 px-2 py-0.5 rounded border border-teal-200/60 mr-2">
                                  🔔 Mention: @{primaryDropTag.assignedTo}
                                </span>
                              ) : null}
                              <span>
                                Tag <strong>"{primaryDropTag?.label || "Priority"}"</strong> hit a new low of{" "}
                                <strong className="text-emerald-800 font-bold">
                                  {formatCurrency(lowest || primaryDropTag?.trackedLowestPrice, row.currency)}
                                </strong>
                              </span>
                              {primaryDropTag?.lastPriceDropAt ? (
                                <span className="text-slate-500 text-[11px] ml-1.5">
                                  (Recorded on {formatDate(primaryDropTag.lastPriceDropAt)})
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(row.tags || []).some(tag => tag.note) ? (
                    <div className="mt-3.5 grid gap-2.5 md:grid-cols-2">
                      {(row.tags || [])
                        .filter(tag => tag.note)
                        .map(tag => (
                          <div key={`${tag.id}-note`} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-600 shadow-2xs">
                            <span className="font-bold text-slate-900">{tag.label}</span>
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
                      <div className="mt-3.5 flex flex-wrap items-center gap-3">
                        {isRunning ? (
                          <span className="text-xs font-semibold text-teal-700 flex items-center gap-1.5">
                            <span className="animate-spin h-3.5 w-3.5 border-2 border-teal-600 border-t-transparent rounded-full" />
                            Fetching live data… ~{fmtSeconds(remainingSec)} remaining
                          </span>
                        ) : isCooldown ? (
                          <span className="text-xs text-slate-500 font-medium">Data refreshed — next check in {fmtSeconds(remainingSec)}</span>
                        ) : (
                          <button
                            onClick={() => handleGetFullDetails(row)}
                            className="rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 active:scale-95 transition cursor-pointer shadow-2xs"
                          >
                            Refresh Live Pricing & Cabins
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

                  {/* ── Cabin Categories Expanded Grid with Availability & Price Comparison ── */}
                  {cabinGroups.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200/80">
                      <button
                        onClick={() => toggleExpand(row.id)}
                        className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        <span>{isExpanded ? "Hide" : "Show"} cabin categories ({(row.cabinCategories || []).length})</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                          {cabinGroups.map(group => {
                            const groupPrices = group.categories
                              .map(c => Number(c.cabinPrice || c.price || 0))
                              .filter(p => Number.isFinite(p) && p > 0)
                            const groupMin = groupPrices.length > 0 ? Math.min(...groupPrices) : null
                            const groupMax = groupPrices.length > 0 ? Math.max(...groupPrices) : null

                            return (
                              <div key={group.group} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                                {/* Header with From - To Range */}
                                <div className="mb-2.5 flex items-center justify-between pb-2 border-b border-slate-100">
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">{group.group}</span>
                                  {groupMin !== null ? (
                                    <span className="rounded-full bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 text-xs font-bold text-teal-800 shadow-2xs">
                                      {groupMax && groupMax > groupMin
                                        ? `from ${formatCurrency(groupMin, row.currency)} to ${formatCurrency(groupMax, row.currency)}`
                                        : `from ${formatCurrency(groupMin, row.currency)}`}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 font-medium">WTL</span>
                                  )}
                                </div>

                                {/* 3 Distinct Column Headers */}
                                <div className="grid grid-cols-12 items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-2 px-1.5 border-b border-slate-100 select-none">
                                  <span className="col-span-4">Category</span>
                                  <span className="col-span-4 text-right pr-2">New Price</span>
                                  <span className="col-span-4 text-right">Avail</span>
                                </div>

                                <div className="space-y-1 mt-1.5">
                                  {group.categories.map(cat => {
                                    const catPrice = Number(cat.cabinPrice || cat.price || 0)
                                    const catAvail = Number(cat.avail ?? cat.available ?? 0)
                                    const isCatSoldOut = catAvail === 0 || cat.avlResult === "WTL"
                                    const isCatLow = catAvail > 0 && catAvail <= 2
                                    const isLowestInGroup = catPrice > 0 && groupMin !== null && catPrice === groupMin
                                    const isCruiseDroppedPrice = catPrice > 0 && lowest !== null && catPrice === lowest && hasPriceDrop

                                    return (
                                      <div
                                        key={cat.code}
                                        className={`grid grid-cols-12 items-center text-xs py-2 px-1.5 border-b border-slate-50 last:border-0 rounded-lg transition-colors ${isCruiseDroppedPrice
                                            ? "bg-emerald-100/90 border-emerald-400 shadow-xs ring-1 ring-emerald-400/60"
                                            : isLowestInGroup
                                              ? "bg-emerald-50/70 border-emerald-200/80 shadow-2xs"
                                              : "hover:bg-slate-50/70"
                                          }`}
                                      >
                                        {/* Col 1: Category */}
                                        <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                                          <span className={`font-bold truncate ${isCruiseDroppedPrice
                                              ? "text-emerald-950 font-black"
                                              : isLowestInGroup
                                                ? "text-emerald-950 font-black"
                                                : "text-slate-900"
                                            }`}>
                                            {cat.code}
                                          </span>
                                          {isCruiseDroppedPrice ? (
                                            <span className="text-[9px] font-black text-emerald-950 bg-emerald-300/90 border border-emerald-500 px-1.5 py-0.2 rounded shrink-0 animate-pulse">
                                              🔥 Drop
                                            </span>
                                          ) : isLowestInGroup ? (
                                            <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1 py-0.2 rounded shrink-0">
                                              Lowest
                                            </span>
                                          ) : null}
                                        </div>

                                        {/* Col 2: Dedicated New Price Column */}
                                        <div className="col-span-4 text-right pr-2">
                                          {catPrice > 0 ? (
                                            <span className={`text-xs ${isCruiseDroppedPrice
                                                ? "font-black text-emerald-950 bg-emerald-200/90 px-1.5 py-0.5 rounded border border-emerald-400"
                                                : isLowestInGroup
                                                  ? "font-black text-emerald-800"
                                                  : "font-bold text-slate-900"
                                              }`}>
                                              {formatCurrency(catPrice, row.currency)}
                                            </span>
                                          ) : (
                                            <span className="text-[11px] text-slate-400 font-semibold">
                                              {cat.avlResult === "WTL" ? "WTL" : cat.avlResult || cat.status || "N/A"}
                                            </span>
                                          )}
                                        </div>

                                        {/* Col 3: Availability Column */}
                                        <div className="col-span-4 text-right">
                                          {isCatSoldOut ? (
                                            <span className="inline-flex items-center text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/80 whitespace-nowrap">
                                              0 avail (WTL)
                                            </span>
                                          ) : isCatLow ? (
                                            <span className="inline-flex items-center text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 whitespace-nowrap">
                                              ⚡ {catAvail} left
                                            </span>
                                          ) : (
                                            <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                                              {catAvail} avail.
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200/80">
          <div className="text-xs text-slate-500 font-medium">
            Showing page <strong className="text-slate-900 font-bold">{pagination?.page ?? 1}</strong> of <strong className="text-slate-900 font-bold">{pagination?.totalPages ?? 1}</strong>
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
    </div>
  )
}

function StatCard({ label, value, highlight = false, active = false, onClick, subtext }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border backdrop-blur-xs p-4 sm:p-5 shadow-2xs transition-all ${onClick ? "cursor-pointer active:scale-98" : ""
        } ${active
          ? "border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500/40 shadow-xs"
          : highlight
            ? "border-emerald-300 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 hover:border-emerald-400 hover:shadow-xs"
            : "border-teal-200/80 bg-gradient-to-br from-white via-teal-50/40 to-teal-100/30 hover:border-teal-300 hover:shadow-xs"
        }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700/80">{label}</div>
        {active && (
          <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-200/90 px-1.5 py-0.2 rounded-full">
            Active
          </span>
        )}
      </div>
      <div className="mt-1.5 text-2xl font-black text-teal-950 font-mono tracking-tight">{value}</div>
      {subtext && (
        <div className="mt-1 text-[10px] font-bold text-emerald-700 truncate">{subtext}</div>
      )}
    </div>
  )
}

function Metric({ label, value, icon: Icon, highlight = false }) {
  return (
    <div className={`rounded-xl px-3.5 py-2.5 border shadow-2xs flex flex-col justify-between ${highlight ? "bg-teal-50/70 border-teal-200/80" : "bg-white border-slate-200/90"
      }`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {Icon ? <Icon size={12} /> : null}
        <span>{label}</span>
      </div>
      <div className={`mt-1 font-bold text-sm ${highlight ? "text-teal-950 text-base" : "text-slate-900"}`}>{value}</div>
    </div>
  )
}

function DateField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type="date"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
      />
    </div>
  )
}
