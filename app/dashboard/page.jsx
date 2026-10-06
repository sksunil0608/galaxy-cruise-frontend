"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  Database,
  Eye,
  Filter,
  Flame,
  Gauge,
  Layers,
  MapPin,
  Moon,
  Percent,
  Pin,
  RefreshCcw,
  Sailboat,
  Search,
  ServerCrash,
  ShieldCheck,
  Ship,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Users,
  Waves,
  X
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from "recharts"

import { fetchCapacityInsightsData, fetchCruises, fetchCruisePriceAlerts, fetchDashboardOverview, markCruisePriceAlertRead } from "./api"
import { getCruiseRouteLabel, getLoadFactor, getSafeSeatsAvailable } from "./cruise-helpers"
import { DashboardOverviewSkeleton } from "@/components/ui/skeleton-patterns"
import { Skeleton } from "@/components/ui/skeleton"

const formatNumber = value => new Intl.NumberFormat("en-GB").format(value ?? 0)
const formatPercent = value => `${Math.round(value ?? 0)}%`
const calcLoadFactor = cruise => getLoadFactor(cruise)
const loadTone = value => (value >= 85 ? "bg-rose-500" : value >= 65 ? "bg-amber-500" : "bg-teal-500")
const formatCapacityDate = value =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "--"

const formatResponseTime = value => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--"
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`
  }

  return `${value}ms`
}

const formatLastUpdated = value => {
  if (!value) {
    return "Never"
  }

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

const healthStyles = {
  Healthy: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  Attention: "bg-amber-50 text-amber-700 border-amber-200/80",
  Critical: "bg-rose-50 text-rose-700 border-rose-200/80"
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState(null)
  const [vendorFleet, setVendorFleet] = useState([])
  const [priceAlerts, setPriceAlerts] = useState([])
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [refreshState, setRefreshState] = useState("idle")

  // Capacity insights
  const [capacityLoading, setCapacityLoading] = useState(true)
  const [capacityCruises, setCapacityCruises] = useState([])
  const [capacityVendorFleet, setCapacityVendorFleet] = useState([])

  const loadCapacityData = async () => {
    try {
      setCapacityLoading(true)
      const response = await fetchCapacityInsightsData()
      setCapacityCruises(response.cruises?.data ?? [])
      setCapacityVendorFleet(response.dashboard?.vendor_fleet ?? [])
    } catch (err) {
      console.warn("Unable to load full capacity insights:", err?.message || err)
    } finally {
      setCapacityLoading(false)
    }
  }

  useEffect(() => {
    loadCapacityData()
  }, [])

  const fetchOverview = async () => {
    try {
      setLoading(true)
      setRefreshState("refreshing")

      const [resResult, alertsResult, taggedResult] = await Promise.allSettled([
        fetchDashboardOverview(),
        fetchCruisePriceAlerts({ status: "unread", limit: 12 }),
        fetchCruises({ tagged: true, limit: 50, detail: "full" })
      ])

      const res = resResult.status === "fulfilled" ? resResult.value : null
      const alertsRes = alertsResult.status === "fulfilled" ? alertsResult.value : null
      const formalAlerts = Array.isArray(alertsRes?.data)
        ? alertsRes.data
        : Array.isArray(alertsRes)
          ? alertsRes
          : alertsRes?.alerts || []

      const taggedCruises = taggedResult.status === "fulfilled" ? (taggedResult.value?.data || []) : []

      // Generate alerts from tagged cruises with active drops
      const detectedDrops = []
      taggedCruises.forEach((row) => {
        const availPrices = (row.cabinCategories || [])
          .filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0) || !c.avlResult)
          .map(c => Number(c.cabinPrice ?? c.price ?? 0))
          .filter(p => Number.isFinite(p) && p > 0)
        const currentLowest = availPrices.length > 0 ? Math.min(...availPrices) : (row.lowestPrice ? Number(row.lowestPrice) : (row.price ? Number(row.price) : null))

        const tags = row.tags || []
        tags.forEach((tag) => {
          const trackedLow = Number(tag.trackedLowestPrice)
          const lastSeen = Number(tag.lastSeenPrice)
          const isDrop = Boolean(tag.lastPriceDropAt) ||
            (Number.isFinite(trackedLow) && trackedLow > 0 && currentLowest && currentLowest < trackedLow) ||
            (Number.isFinite(lastSeen) && lastSeen > 0 && currentLowest && currentLowest < lastSeen)

          if (isDrop && currentLowest) {
            const basePrice = (Number.isFinite(trackedLow) && trackedLow > 0) ? trackedLow : (lastSeen || currentLowest + 200)
            detectedDrops.push({
              id: `tag-drop-${row.id}-${tag.id}`,
              cruiseId: row.id,
              cruiseCode: row.code || row.id,
              cruisePackage: row.package || row.name || row.code,
              ship: row.ship || row.shipName || "--",
              vendor: row.vendor || { name: row.source || "Vendor" },
              tag: { label: tag.label || "Priority", assignedTo: tag.assignedTo },
              previousPrice: basePrice,
              currentPrice: currentLowest,
              currency: row.currency || "GBP",
              lastPriceDropAt: tag.lastPriceDropAt || new Date().toISOString()
            })
          }
        })
      })

      // Combine formal alerts and detected drops without duplicates
      const alertMap = new Map()
      formalAlerts.forEach((a) => {
        const key = a.id || `${a.cruiseCode}-${a.currentPrice}`
        alertMap.set(key, a)
      })
      detectedDrops.forEach((d) => {
        const key = d.id || `${d.cruiseCode}-${d.currentPrice}`
        if (!alertMap.has(key)) {
          alertMap.set(key, d)
        }
      })

      const combinedAlerts = Array.from(alertMap.values())

      if (res?.success || res?.overview) {
        setOverview(res.overview)
        setVendorFleet(res.vendor_fleet || [])
        setPriceAlerts(combinedAlerts)
        setLastSyncedAt(new Date())
        setRefreshState("success")
      } else if (combinedAlerts.length > 0) {
        setPriceAlerts(combinedAlerts)
      }
    } catch (err) {
      console.error(err)
      setRefreshState("error")
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAlertRead = async (alertId) => {
    setPriceAlerts(prev => prev.filter(a => a.id !== alertId))
    try {
      if (typeof alertId === "number" || (!String(alertId).startsWith("tag-drop-") && !isNaN(Number(alertId)))) {
        await markCruisePriceAlertRead(alertId)
      }
    } catch (err) {
      console.warn("Failed to mark alert read:", err)
    }
  }

  useEffect(() => {
    fetchOverview()
  }, [])

  const cards = useMemo(() => {
    if (!overview) {
      return []
    }

    const healthScore = Number(overview.fleet_health_score ?? 0)
    const isHealthCritical = healthScore < 65
    const isHealthAttention = healthScore >= 65 && healthScore < 85

    return [
      {
        title: "Active Vendors",
        value: overview.active_vendors,
        hint: "Connected & monitored lines",
        badge: "Live Portals",
        badgeStyle: "bg-teal-50 text-teal-700 border-teal-200/80",
        icon: Activity,
        accent: "border-teal-200/80 bg-gradient-to-br from-white via-teal-50/25 to-teal-50/50 hover:border-teal-400 hover:shadow-teal-500/10",
        iconBg: "bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-sm shadow-teal-700/25",
        textVal: "text-teal-950",
        progress: 100,
        progressColor: "bg-teal-600",
        glow: "bg-teal-500/15"
      },
      {
        title: "Fleet Health",
        value: `${healthScore}%`,
        hint: overview.fleet_health_label || "Fleet Status",
        badge: overview.fleet_health_label || "Integrity",
        badgeStyle: isHealthCritical
          ? "bg-rose-50 text-rose-700 border-rose-200/80"
          : isHealthAttention
            ? "bg-amber-50 text-amber-700 border-amber-200/80"
            : "bg-emerald-50 text-emerald-700 border-emerald-200/80",
        icon: ShieldCheck,
        accent: isHealthCritical
          ? "border-rose-200/80 bg-gradient-to-br from-white via-rose-50/25 to-rose-50/50 hover:border-rose-400 hover:shadow-rose-500/10"
          : isHealthAttention
            ? "border-amber-200/80 bg-gradient-to-br from-white via-amber-50/25 to-amber-50/50 hover:border-amber-400 hover:shadow-amber-500/10"
            : "border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/25 to-emerald-50/50 hover:border-emerald-400 hover:shadow-emerald-500/10",
        iconBg: isHealthCritical
          ? "bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-sm shadow-rose-700/25"
          : isHealthAttention
            ? "bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm shadow-amber-700/25"
            : "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm shadow-emerald-700/25",
        textVal: isHealthCritical ? "text-rose-950" : isHealthAttention ? "text-amber-950" : "text-emerald-950",
        progress: Math.min(100, Math.max(5, healthScore)),
        progressColor: isHealthCritical ? "bg-rose-500" : isHealthAttention ? "bg-amber-500" : "bg-emerald-500",
        glow: isHealthCritical ? "bg-rose-500/15" : "bg-emerald-500/15"
      },
      {
        title: "Total Runs",
        value: formatNumber(overview.total_runs),
        hint: "Historical extraction cycles",
        badge: "Ingestion",
        badgeStyle: "bg-sky-50 text-sky-700 border-sky-200/80",
        icon: RefreshCcw,
        accent: "border-sky-200/80 bg-gradient-to-br from-white via-sky-50/25 to-sky-50/50 hover:border-sky-400 hover:shadow-sky-500/10",
        iconBg: "bg-gradient-to-br from-sky-600 to-indigo-700 text-white shadow-sm shadow-sky-700/25",
        textVal: "text-sky-950",
        progress: Math.min(100, Math.max(10, ((overview.total_runs ?? 0) / 1000) * 100)),
        progressColor: "bg-sky-600",
        glow: "bg-sky-500/15"
      },
      {
        title: "Avg Response",
        value: formatResponseTime(overview.average_response_time_ms),
        hint: "Average runtime across vendors",
        badge: "Speed Metric",
        badgeStyle: "bg-amber-50 text-amber-700 border-amber-200/80",
        icon: Clock3,
        accent: "border-amber-200/80 bg-gradient-to-br from-white via-amber-50/25 to-amber-50/50 hover:border-amber-400 hover:shadow-amber-500/10",
        iconBg: "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-600/25",
        textVal: "text-amber-950",
        progress: 85,
        progressColor: "bg-amber-500",
        glow: "bg-amber-500/15"
      },
      {
        title: "Price Alerts",
        value: priceAlerts.length,
        hint: priceAlerts.length > 0 ? "Fares dropped on pinned cruises" : "No unread fare drops",
        badge: priceAlerts.length > 0 ? `${priceAlerts.length} Unread` : "Radar Active",
        badgeStyle: priceAlerts.length > 0
          ? "bg-rose-50 text-rose-700 border-rose-200/80 animate-pulse"
          : "bg-rose-50 text-rose-700 border-rose-200/80",
        icon: BellRing,
        accent: "border-rose-200/80 bg-gradient-to-br from-white via-rose-50/25 to-rose-50/50 hover:border-rose-400 hover:shadow-rose-500/10",
        iconBg: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-sm shadow-rose-600/25",
        textVal: "text-rose-950",
        progress: priceAlerts.length > 0 ? 100 : 20,
        progressColor: priceAlerts.length > 0 ? "bg-rose-500" : "bg-slate-300",
        glow: "bg-rose-500/15"
      }
    ]
  }, [overview, priceAlerts])


  const [capacityMetricView, setCapacityMetricView] = useState("volume") // 'volume' | 'loadFactor'
  const [highDemandQuery, setHighDemandQuery] = useState("")
  const [opportunityQuery, setOpportunityQuery] = useState("")
  const [selectedVendorFilter, setSelectedVendorFilter] = useState("all")

  const capacityOverviewCards = useMemo(() => {
    const totalCapacity = capacityCruises.reduce((sum, cruise) => sum + (cruise.totalCapacity ?? 0), 0)
    const totalSailings = capacityCruises.length
    const seatsAvailable = capacityCruises.reduce((sum, cruise) => sum + getSafeSeatsAvailable(cruise), 0)
    const soldSeats = Math.max(0, totalCapacity - seatsAvailable)
    const avgLoadFactor = capacityCruises.length > 0
      ? capacityCruises.reduce((sum, cruise) => sum + calcLoadFactor(cruise), 0) / capacityCruises.length
      : 0
    const fleetUtilization = totalCapacity > 0 ? (soldSeats / totalCapacity) * 100 : 0

    return [
      {
        title: "Total Capacity",
        value: formatNumber(totalCapacity),
        hint: "Total seats across active voyages",
        icon: Users,
        accent: "border-teal-200/80 bg-gradient-to-br from-white via-teal-50/20 to-teal-50/40",
        iconBg: "bg-teal-100 text-teal-700",
        textVal: "text-teal-950",
        badge: "Total Inventory",
        badgeStyle: "bg-teal-50 text-teal-700 border-teal-200/80",
        progress: 100,
        progressColor: "bg-teal-600"
      },
      {
        title: "Total Sailings",
        value: formatNumber(totalSailings),
        hint: "Cruises currently in inventory",
        icon: Sailboat,
        accent: "border-sky-200/80 bg-gradient-to-br from-white via-sky-50/20 to-sky-50/40",
        iconBg: "bg-sky-100 text-sky-700",
        textVal: "text-sky-950",
        badge: "Live Schedules",
        badgeStyle: "bg-sky-50 text-sky-700 border-sky-200/80",
        progress: Math.min(100, (totalSailings / 50) * 100),
        progressColor: "bg-sky-600"
      },
      {
        title: "Seats Available",
        value: formatNumber(seatsAvailable),
        hint: "Open seats ready for booking",
        icon: CalendarRange,
        accent: "border-indigo-200/80 bg-gradient-to-br from-white via-indigo-50/20 to-indigo-50/40",
        iconBg: "bg-indigo-100 text-indigo-700",
        textVal: "text-indigo-950",
        badge: "Open Seats",
        badgeStyle: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
        progress: totalCapacity > 0 ? (seatsAvailable / totalCapacity) * 100 : 0,
        progressColor: "bg-indigo-600"
      },
      {
        title: "Avg Load Factor",
        value: formatPercent(avgLoadFactor),
        hint: "Average sold capacity per cruise",
        icon: BarChart3,
        accent: "border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-50/40",
        iconBg: "bg-emerald-100 text-emerald-700",
        textVal: "text-emerald-950",
        badge: "Fleet Fill Rate",
        badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
        progress: Math.min(100, Math.round(avgLoadFactor)),
        progressColor: avgLoadFactor >= 80 ? "bg-rose-500" : avgLoadFactor >= 60 ? "bg-amber-500" : "bg-emerald-500"
      },
      {
        title: "Fleet Utilization",
        value: formatPercent(fleetUtilization),
        hint: "Overall sold capacity depth",
        icon: Gauge,
        accent: "border-violet-200/80 bg-gradient-to-br from-white via-violet-50/20 to-violet-50/40",
        iconBg: "bg-violet-100 text-violet-700",
        textVal: "text-violet-950",
        badge: "Utilization",
        badgeStyle: "bg-violet-50 text-violet-700 border-violet-200/80",
        progress: Math.min(100, Math.round(fleetUtilization)),
        progressColor: "bg-violet-600"
      }
    ]
  }, [capacityCruises])

  const demandDistribution = useMemo(() => {
    return capacityVendorFleet.map(vendor => {
      const vendorCruises = capacityCruises.filter(cruise => {
        const cId = cruise.vendor?.id != null ? String(cruise.vendor.id).trim().toLowerCase() : ""
        const vId = vendor.vendor_id != null ? String(vendor.vendor_id).trim().toLowerCase() : ""
        const cName = (cruise.vendor?.name || "").trim().toLowerCase()
        const vName = (vendor.vendor_name || "").trim().toLowerCase()

        if (cId && vId && cId === vId) return true
        if (cName && vName && (cName === vName || cName.includes(vName) || vName.includes(cName))) return true
        return false
      })

      const totalCapacity = vendorCruises.reduce((sum, cruise) => sum + (cruise.totalCapacity ?? 0), 0)
      const seatsAvailable = vendorCruises.reduce((sum, cruise) => sum + getSafeSeatsAvailable(cruise), 0)
      const effectiveCapacity = Math.max(totalCapacity, seatsAvailable)
      const soldSeats = Math.max(0, totalCapacity - seatsAvailable)
      const avgLoad = vendorCruises.length > 0
        ? Math.round(vendorCruises.reduce((sum, cruise) => sum + calcLoadFactor(cruise), 0) / vendorCruises.length)
        : 0

      return {
        vendor: vendor.vendor_name,
        cruisesCount: vendorCruises.length,
        soldSeats,
        seatsAvailable,
        totalCapacity: effectiveCapacity,
        avgLoad
      }
    })
  }, [capacityCruises, capacityVendorFleet])

  const uniqueCapacityVendors = useMemo(() => {
    const map = new Map()
    capacityCruises.forEach(c => {
      if (c.vendor?.id && c.vendor?.name) {
        map.set(String(c.vendor.id), c.vendor.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [capacityCruises])

  const highDemandSailings = useMemo(() => {
    return [...capacityCruises]
      .map(cruise => ({ ...cruise, loadFactor: calcLoadFactor(cruise), safeSeatsAvailable: getSafeSeatsAvailable(cruise) }))
      .sort((a, b) => b.loadFactor - a.loadFactor)
  }, [capacityCruises])

  const capacityOpportunities = useMemo(() => {
    return [...capacityCruises]
      .map(cruise => ({ ...cruise, loadFactor: calcLoadFactor(cruise), safeSeatsAvailable: getSafeSeatsAvailable(cruise) }))
      .sort((a, b) => (b.safeSeatsAvailable !== a.safeSeatsAvailable ? b.safeSeatsAvailable - a.safeSeatsAvailable : a.loadFactor - b.loadFactor))
  }, [capacityCruises])

  const filteredHighDemand = useMemo(() => {
    return highDemandSailings.filter(item => {
      const matchesVendor = selectedVendorFilter === "all" || String(item.vendor?.id) === selectedVendorFilter || item.vendor?.name === selectedVendorFilter
      const text = `${item.package || ""} ${item.vendor?.name || ""} ${getCruiseRouteLabel(item)} ${item.code || ""}`.toLowerCase()
      const matchesQuery = !highDemandQuery.trim() || text.includes(highDemandQuery.toLowerCase())
      return matchesVendor && matchesQuery
    }).slice(0, 6)
  }, [highDemandSailings, selectedVendorFilter, highDemandQuery])

  const filteredOpportunities = useMemo(() => {
    return capacityOpportunities.filter(item => {
      const matchesVendor = selectedVendorFilter === "all" || String(item.vendor?.id) === selectedVendorFilter || item.vendor?.name === selectedVendorFilter
      const text = `${item.package || ""} ${item.vendor?.name || ""} ${getCruiseRouteLabel(item)} ${item.code || ""}`.toLowerCase()
      const matchesQuery = !opportunityQuery.trim() || text.includes(opportunityQuery.toLowerCase())
      return matchesVendor && matchesQuery
    }).slice(0, 6)
  }, [capacityOpportunities, selectedVendorFilter, opportunityQuery])

  const capacityStats = useMemo(() => {
    const totalSold = demandDistribution.reduce((acc, v) => acc + (v.soldSeats || 0), 0)
    const totalOpen = demandDistribution.reduce((acc, v) => acc + (v.seatsAvailable || 0), 0)
    const totalCap = totalSold + totalOpen
    const activeWithSeats = demandDistribution.filter(v => v.seatsAvailable > 0 || v.soldSeats > 0)
    const topVendorWithLoad = [...activeWithSeats].filter(v => v.avgLoad > 0).sort((a, b) => b.avgLoad - a.avgLoad)[0]
    const topVendorWithVol = [...activeWithSeats].sort((a, b) => (b.seatsAvailable + b.soldSeats) - (a.seatsAvailable + a.soldSeats))[0]
    const topVendor = topVendorWithLoad || topVendorWithVol || demandDistribution[0]

    return {
      totalSold,
      totalOpen,
      totalCap,
      topVendor: topVendor?.vendor || "None",
      topVendorLoad: topVendor?.avgLoad || 0,
      topVendorOpen: topVendor?.seatsAvailable || 0,
      activeVendorCount: activeWithSeats.length
    }
  }, [demandDistribution])

  if (loading && !overview) {
    return <DashboardOverviewSkeleton />
  }

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
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  refreshState === "refreshing" ? "bg-sky-400" : refreshState === "error" ? "bg-rose-400" : "bg-teal-400"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  refreshState === "refreshing" ? "bg-sky-600" : refreshState === "error" ? "bg-rose-600" : "bg-teal-600"
                }`}></span>
              </span>
              <span>
                {refreshState === "refreshing"
                  ? "Refreshing live telemetry…"
                  : refreshState === "error"
                    ? "Sync issue detected"
                    : `Live Fleet Telemetry · Synced ${formatLastUpdated(lastSyncedAt)}`}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Vendor Extraction & Fleet Overview
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">
              Real-time synchronization metrics across cruise lines, database coverage depth, and active price alert monitors.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchOverview}
              disabled={loading}
              className={`inline-flex items-center gap-2 rounded-lg px-4 h-9 text-xs font-bold text-white shadow-xs transition active:scale-95 cursor-pointer ${
                loading
                  ? "bg-slate-700 cursor-wait opacity-80"
                  : refreshState === "success"
                    ? "bg-teal-700 hover:bg-teal-800"
                    : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              <RefreshCcw
                size={13}
                className={loading ? "animate-spin" : ""}
              />
              <span>{loading ? "Refreshing…" : refreshState === "success" ? "Refreshed" : "Refresh Overview"}</span>
            </button>
          </div>
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map(card => {
            const Icon = card.icon

            return (
              <div
                key={card.title}
                className={`group relative overflow-hidden rounded-2xl border p-4 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${card.accent}`}
              >
                {/* Decorative ambient subtle glow */}
                <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl ${card.glow}`} />

                <div className="relative z-10 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
                      {card.title}
                    </p>
                    <p className={`mt-1 text-2xl font-black font-mono tracking-tight ${card.textVal}`}>
                      {card.value}
                    </p>
                  </div>
                  <div className={`rounded-xl p-2.5 shadow-2xs transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${card.iconBg}`}>
                    <Icon size={16} />
                  </div>
                </div>

                {/* Progress bar track */}
                {card.progress !== undefined && (
                  <div className="relative z-10 mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${card.progressColor}`}
                        style={{ width: `${card.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="relative z-10 mt-2.5 flex items-center justify-between text-[11px] font-medium text-slate-500 gap-2">
                  <span className="line-clamp-1 truncate">{card.hint}</span>
                  <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold shrink-0 shadow-2xs ${card.badgeStyle}`}>
                    {card.badge}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}


      {/* ── Main Fleet & Alerts Grid ───────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Vendor Fleet
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Health score, extraction cycle times, coverage range, and inventory volume.
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
              {vendorFleet.length} vendor{vendorFleet.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-4 space-y-3.5">
            {vendorFleet.map(vendor => (
              <div
                key={vendor.vendor_id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:bg-slate-50"
              >
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        {vendor.vendor_name}
                      </h3>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${healthStyles[vendor.health_label] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
                      >
                        {vendor.health_label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Last updated {formatLastUpdated(vendor.last_updated_at)}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Health Score
                    </div>
                    <div className="mt-0.5 text-xl font-extrabold text-slate-900 font-mono">
                      {vendor.health_score}%
                    </div>
                  </div>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      vendor.health_score >= 85
                        ? "bg-teal-600"
                        : vendor.health_score >= 65
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.min(vendor.health_score, 100)}%` }}
                  />
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-2.5 text-xs text-slate-600 sm:grid-cols-4">
                  <MetricItem
                    label="Total runs"
                    value={vendor.total_runs}
                    icon={RefreshCcw}
                  />
                  <MetricItem
                    label="Coverage"
                    value={vendor.coverage_label}
                    icon={Database}
                  />
                  <MetricItem
                    label="Response"
                    value={formatResponseTime(vendor.average_response_time_ms)}
                    icon={Clock3}
                  />
                  <MetricItem
                    label="Errors"
                    value={vendor.error_count}
                    icon={ServerCrash}
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-200/70 bg-white p-2.5 text-xs">
                  <div className="text-center sm:text-left">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Cruises</div>
                    <div className="mt-0.5 font-bold text-slate-900 font-mono">
                      {vendor.cruise_count}
                    </div>
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Ships</div>
                    <div className="mt-0.5 font-bold text-slate-900 font-mono">
                      {vendor.ship_count}
                    </div>
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Cabin Categories</div>
                    <div className="mt-0.5 font-bold text-slate-900 font-mono">
                      {vendor.cabin_category_count}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!loading && vendorFleet.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-xs text-slate-500">
                No vendor fleet telemetry recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* ── Price Alerts & Distribution ─────────────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between gap-4 pb-3.5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Tagged Cruise Price Alerts
                </h2>
                <p className="text-xs font-medium text-slate-500">
                  Recent price drops detected on your pinned cruises.
                </p>
              </div>
              <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                {priceAlerts.length} unread
              </div>
            </div>

            <div className="mt-3.5 space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {priceAlerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                    <BellRing size={18} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-800">No Active Price Drops Detected</div>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Price alerts trigger automatically when fares drop below the tracked baseline on your pinned/tagged cruises.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <Link
                      href="/dashboard/tagged-cruises"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      <Tag size={12} />
                      <span>View Tagged Cruises</span>
                    </Link>
                    <Link
                      href="/dashboard/search-cruise"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      <Pin size={12} className="text-amber-500" />
                      <span>Pin a Cruise</span>
                    </Link>
                  </div>
                </div>
              ) : (
                priceAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className="rounded-xl border border-teal-200/80 bg-teal-50/30 p-3.5 transition hover:bg-teal-50/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {alert.cruisePackage || alert.cruiseCode}
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                          {alert.vendor?.name || "Vendor"} · {alert.ship || "--"} · {alert.tag?.label || "Tag"}
                        </div>
                        <div className="mt-2 text-xs text-slate-700 flex items-center gap-1.5">
                          <span className="line-through text-slate-400 font-mono">
                            {alert.previousPrice !== null && alert.previousPrice !== undefined
                              ? new Intl.NumberFormat("en-GB", {
                                  style: "currency",
                                  currency: alert.currency || "GBP"
                                }).format(alert.previousPrice)
                              : "--"}
                          </span>
                          <span className="font-bold text-teal-700 font-mono text-sm">
                            {new Intl.NumberFormat("en-GB", {
                              style: "currency",
                              currency: alert.currency || "GBP"
                            }).format(alert.currentPrice)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkAlertRead(alert.id)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 shrink-0 cursor-pointer"
                      >
                        Mark read
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900">
              Vendor Cruise Distribution
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Total active cruises per vendor line.
            </p>

            <div className="mt-4 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorFleet}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="vendor_name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(value, _name, item) => {
                      if (item.dataKey === "health_score") {
                        return [`${value}%`, "Health score"]
                      }
                      return [value, "Cruises"]
                    }}
                  />
                  <Bar
                    dataKey="cruise_count"
                    fill="#0f766e"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Capacity Insights Section ───────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-6">
        {/* Decorative Ambient Background Glows */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-sky-500/5 blur-3xl" />

        {/* ── Section Header ────────────────────────────────────────────── */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50/90 px-3 py-0.5 text-[11px] font-bold text-teal-900 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600" />
                </span>
                <span>Fleet Utilization & Capacity Intelligence</span>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                {capacityCruises.length} active sailings
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
              Seat & Demand Visibility Across Fleet
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
              Real-time seat occupancy calculations from live vendor inventory runs and scheduled sailings.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* Vendor Filter Pill selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-1 text-xs">
              <button
                onClick={() => setSelectedVendorFilter("all")}
                className={`rounded-md px-2.5 py-1 font-bold text-[11px] transition cursor-pointer ${
                  selectedVendorFilter === "all"
                    ? "bg-white text-teal-900 shadow-2xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Lines
              </button>
              {uniqueCapacityVendors.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVendorFilter(v.id)}
                  className={`rounded-md px-2.5 py-1 font-bold text-[11px] transition cursor-pointer ${
                    selectedVendorFilter === v.id
                      ? "bg-white text-teal-900 shadow-2xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>

            <button
              onClick={loadCapacityData}
              disabled={capacityLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer disabled:opacity-60"
            >
              <RefreshCcw size={12} className={capacityLoading ? "animate-spin text-teal-600" : "text-slate-500"} />
              <span>{capacityLoading ? "Syncing…" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* ── 5 Executive KPI Metric Cards ─────────────────────────────────── */}
        {capacityLoading && capacityCruises.length === 0 ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-20 bg-slate-200" />
                    <Skeleton className="h-7 w-24 bg-slate-300" />
                  </div>
                  <Skeleton className="h-9 w-9 rounded-lg bg-teal-100/60" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full bg-slate-200" />
                <div className="flex justify-between items-center pt-1">
                  <Skeleton className="h-3 w-28 bg-slate-100" />
                  <Skeleton className="h-4 w-16 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {capacityOverviewCards.map(card => {
              const Icon = card.icon

              return (
                <div
                  key={card.title}
                  className={`group relative overflow-hidden rounded-xl border p-4 shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${card.accent}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {card.title}
                      </div>
                      <div className={`mt-1 text-2xl font-black font-mono tracking-tight ${card.textVal}`}>
                        {card.value}
                      </div>
                    </div>
                    <div className={`rounded-lg p-2.5 shadow-2xs transition-transform group-hover:scale-105 ${card.iconBg}`}>
                      <Icon size={16} />
                    </div>
                  </div>

                  {/* Progress Visual Track */}
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${card.progressColor}`}
                        style={{ width: `${card.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span className="line-clamp-1">{card.hint}</span>
                    <span className={`rounded-md border px-1.5 py-0.2 text-[10px] font-bold shrink-0 ${card.badgeStyle}`}>
                      {card.badge}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}


        {/* ── Vendor Demand Distribution Chart ────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 border border-teal-100">
                <BarChart3 size={17} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Vendor Demand & Seat Occupancy Distribution
                </h3>
                <p className="text-xs font-medium text-slate-500">
                  Comparison of booked versus open cabin inventory across vendor fleets.
                </p>
              </div>
            </div>

            {/* View Mode Toggle Switch & Legend */}
            <div className="flex flex-wrap items-center gap-3">
              {capacityMetricView === "volume" && (
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-teal-600" />
                    <span>Booked</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-sky-500" />
                    <span>Available</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/70 p-1 text-xs font-bold shadow-2xs">
                <button
                  onClick={() => setCapacityMetricView("volume")}
                  className={`rounded-lg px-3 py-1.5 transition cursor-pointer text-xs ${
                    capacityMetricView === "volume"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white"
                  }`}
                >
                  Seats Volume
                </button>
                <button
                  onClick={() => setCapacityMetricView("loadFactor")}
                  className={`rounded-lg px-3 py-1.5 transition cursor-pointer text-xs ${
                    capacityMetricView === "loadFactor"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white"
                  }`}
                >
                  Load Factor %
                </button>
              </div>
            </div>
          </div>

          {/* Chart Graphic Area */}
          <div className="h-[270px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demandDistribution} margin={{ top: 12, right: 16, left: 4, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="vendor"
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }}
                  tickFormatter={v => (v && v.length > 15 ? `${v.slice(0, 13)}…` : v)}
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={38}
                  allowDecimals={false}
                  unit={capacityMetricView === "loadFactor" ? "%" : ""}
                />
                <Tooltip content={<DemandChartTooltip />} />
                {capacityMetricView === "volume" ? (
                  <>
                    <Bar
                      dataKey="soldSeats"
                      name="Sold Seats"
                      fill="#0d9488"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="seatsAvailable"
                      name="Seats Open"
                      fill="#0ea5e9"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  </>
                ) : (
                  <Bar
                    dataKey="avgLoad"
                    name="Avg Load Factor %"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Demand Summary Ribbon under chart */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-slate-50/70 border border-slate-200/70 px-4 py-3">
              <span className="text-slate-500 font-semibold">Total Sold Seats:</span>
              <span className="font-bold text-teal-700 font-mono text-sm">{formatNumber(capacityStats.totalSold)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50/70 border border-slate-200/70 px-4 py-3">
              <span className="text-slate-500 font-semibold">Total Open Seats:</span>
              <span className="font-bold text-sky-700 font-mono text-sm">{formatNumber(capacityStats.totalOpen)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50/70 border border-slate-200/70 px-4 py-3">
              <span className="text-slate-500 font-semibold">
                {capacityStats.topVendorLoad > 0 ? "Highest Demand Line:" : "Active Inventory Line:"}
              </span>
              <span className="font-bold text-indigo-700 font-mono text-sm">
                {capacityStats.topVendor} {capacityStats.topVendorLoad > 0 ? `(${capacityStats.topVendorLoad}%)` : `(${formatNumber(capacityStats.totalOpen)} seats)`}
              </span>
            </div>
          </div>
        </div>

        {/* ── High Demand vs Capacity Opportunities Panels ─────────────────── */}
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Panel 1: High Demand Sailings */}
          <EnhancedSailingPanel
            title="High Demand Sailings"
            subtitle="Voyages with highest booking load factor needing yield management."
            icon={Flame}
            iconBg="bg-rose-100 text-rose-700 border-rose-200"
            badge="Yield Alert"
            badgeStyle="bg-rose-50 text-rose-700 border-rose-200"
            items={filteredHighDemand}
            totalCount={highDemandSailings.length}
            searchQuery={highDemandQuery}
            onSearchChange={setHighDemandQuery}
            mode="demand"
          />

          {/* Panel 2: Capacity Opportunities */}
          <EnhancedSailingPanel
            title="Capacity Opportunities"
            subtitle="Sailings with most unsold seats available to drive promotional campaigns."
            icon={Sparkles}
            iconBg="bg-teal-100 text-teal-700 border-teal-200"
            badge="Open Inventory"
            badgeStyle="bg-teal-50 text-teal-700 border-teal-200"
            items={filteredOpportunities}
            totalCount={capacityOpportunities.length}
            searchQuery={opportunityQuery}
            onSearchChange={setOpportunityQuery}
            mode="opportunity"
          />
        </div>
      </div>
    </div>
  )
}

function MetricItem({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-2xs">
      <div className="flex items-center gap-1.5 text-slate-400">
        <Icon size={13} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
      <div className="mt-1 font-bold text-slate-900 font-mono text-xs">
        {value}
      </div>
    </div>
  )
}

function DemandChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]?.payload
  if (!data) return null
  const total = (data.soldSeats ?? 0) + (data.seatsAvailable ?? 0)
  const loadPct = total > 0 ? Math.round((data.soldSeats / total) * 100) : (data.avgLoad ?? 0)

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-md text-white text-xs min-w-[220px] space-y-2">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-100 text-sm">
          <Ship size={14} className="text-teal-400" />
          <span>{data.vendor}</span>
        </div>
        <span className="rounded-md bg-teal-950/90 border border-teal-500/40 px-2 py-0.5 text-[10px] font-bold text-teal-300 font-mono">
          {loadPct}% Sold
        </span>
      </div>

      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-400" />
            Sold Seats
          </span>
          <span className="font-mono font-bold text-teal-300">{formatNumber(data.soldSeats)}</span>
        </div>

        <div className="flex items-center justify-between text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Available Seats
          </span>
          <span className="font-mono font-bold text-sky-300">{formatNumber(data.seatsAvailable)}</span>
        </div>

        <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/80 text-[11px]">
          <span>Total Capacity</span>
          <span className="font-mono font-semibold text-slate-200">{formatNumber(total)} seats</span>
        </div>
      </div>

      <div className="pt-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
            style={{ width: `${Math.min(100, loadPct)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function EnhancedSailingPanel({
  title,
  subtitle,
  icon: Icon,
  iconBg,
  badge,
  badgeStyle,
  items,
  totalCount,
  searchQuery,
  onSearchChange,
  mode
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-xl p-2.5 border ${iconBg}`}>
            <Icon size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <span className={`rounded-md border px-2 py-0.2 text-[10px] font-bold ${badgeStyle}`}>
                {badge}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 line-clamp-1">{subtitle}</p>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md shrink-0 self-start sm:self-auto">
          {items.length} of {totalCount}
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={`Search ${title.toLowerCase()} by route, package, port…`}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-500/30 transition shadow-2xs"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Sailings List */}
      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {items.map(item => (
          <EnhancedSailingCard key={item.id} item={item} mode={mode} />
        ))}

        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-8 px-4 text-center space-y-1.5">
            <div className="inline-flex rounded-full bg-slate-100 p-2 text-slate-400">
              <Search size={16} />
            </div>
            <p className="text-xs font-bold text-slate-600">No matching sailings found</p>
            <p className="text-[11px] text-slate-400">
              {searchQuery ? "Try refining your search filter terms." : "No sailings currently available in this category."}
            </p>
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer underline"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EnhancedSailingCard({ item, mode = "demand" }) {
  const loadFactor = item.loadFactor ?? calcLoadFactor(item)
  const seatsOpen = item.safeSeatsAvailable ?? getSafeSeatsAvailable(item)
  const totalSeats = item.totalCapacity ?? 0
  const routeLabel = getCruiseRouteLabel(item)

  const statusBadge =
    loadFactor >= 85
      ? {
          text: "Critical High",
          bg: "bg-rose-50 text-rose-700 border-rose-200/80",
          icon: Flame,
          progressBg: "bg-gradient-to-r from-rose-500 to-red-600",
        }
      : loadFactor >= 65
        ? {
            text: "Filling Fast",
            bg: "bg-amber-50 text-amber-700 border-amber-200/80",
            icon: TrendingUp,
            progressBg: "bg-gradient-to-r from-amber-500 to-orange-500",
          }
        : {
            text: "High Availability",
            bg: "bg-teal-50 text-teal-700 border-teal-200/80",
            icon: Sparkles,
            progressBg: "bg-gradient-to-r from-teal-500 to-emerald-500",
          }

  const StatusIcon = statusBadge.icon

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      <div className="space-y-3">
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                <Ship size={11} className="text-slate-500" />
                <span>{item.vendor?.name || "Vendor"}</span>
              </span>
              {item.nights && (
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  <Moon size={10} className="text-slate-400" />
                  <span>{item.nights} Nights</span>
                </span>
              )}
            </div>
            <h4
              className="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-teal-700 transition-colors font-mono"
              title={item.package || item.code}
            >
              {item.code || item.package || "Cruise Package"}
            </h4>
          </div>

          <div className="text-right shrink-0">
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusBadge.bg}`}>
              <StatusIcon size={11} />
              <span>{statusBadge.text}</span>
            </span>
            <div className="mt-1 font-mono text-sm font-black text-slate-900">
              {formatPercent(loadFactor)}
            </div>
          </div>
        </div>

        {/* Route & Date */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 flex-wrap pt-0.5">
          <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
            <MapPin size={12} className="text-teal-600 shrink-0" />
            <span className="truncate font-medium text-[11px]">{routeLabel}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 shrink-0">
            <Calendar size={11} className="text-slate-400" />
            <span>{formatCapacityDate(item.startDate)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${statusBadge.progressBg}`}
              style={{ width: `${Math.min(100, loadFactor)}%` }}
            />
          </div>
        </div>

        {/* 3-Column Stats Ribbon */}
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-center text-xs">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Seats Open</div>
            <div className={`mt-0.5 font-mono font-bold ${seatsOpen <= 5 ? "text-rose-600" : "text-teal-700"}`}>
              {formatNumber(seatsOpen)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Capacity</div>
            <div className="mt-0.5 font-mono font-bold text-slate-800">
              {formatNumber(totalSeats)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Load Factor</div>
            <div className="mt-0.5 font-mono font-bold text-slate-800">
              {formatPercent(loadFactor)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
