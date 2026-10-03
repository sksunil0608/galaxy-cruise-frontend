"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  BarChart3,
  BellRing,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Layers,
  RefreshCcw,
  Sailboat,
  ServerCrash,
  ShieldCheck,
  Ship,
  TrendingDown,
  Users
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts"

import { fetchCapacityInsightsData, fetchCruisePriceAlerts, fetchDashboardOverview, markCruisePriceAlertRead } from "./api"
import { getCruiseRouteLabel, getLoadFactor, getSafeSeatsAvailable } from "./cruise-helpers"

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
      console.error(err)
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

      const [res, alertsRes] = await Promise.all([
        fetchDashboardOverview(),
        fetchCruisePriceAlerts({ status: "unread", limit: 8 })
      ])

      if (res?.success) {
        setOverview(res.overview)
        setVendorFleet(res.vendor_fleet || [])
        setPriceAlerts(alertsRes.data || [])
        setLastSyncedAt(new Date())
        setRefreshState("success")
      }
    } catch (err) {
      console.error(err)
      setRefreshState("error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOverview()
  }, [])

  const cards = useMemo(() => {
    if (!overview) {
      return []
    }

    return [
      {
        title: "Active Vendors",
        value: overview.active_vendors,
        hint: "Vendors with live runs or inventory",
        icon: Activity,
        accent: "border-teal-200/80 bg-gradient-to-br from-white via-teal-50/20 to-teal-50/40",
        iconBg: "bg-teal-100 text-teal-700",
        textVal: "text-teal-950"
      },
      {
        title: "Fleet Health",
        value: `${overview.fleet_health_score}%`,
        hint: overview.fleet_health_label,
        icon: ShieldCheck,
        accent: "border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-50/40",
        iconBg: "bg-emerald-100 text-emerald-700",
        textVal: "text-emerald-950"
      },
      {
        title: "Total Runs",
        value: overview.total_runs,
        hint: "Historical extraction cycles stored",
        icon: RefreshCcw,
        accent: "border-sky-200/80 bg-gradient-to-br from-white via-sky-50/20 to-sky-50/40",
        iconBg: "bg-sky-100 text-sky-700",
        textVal: "text-sky-950"
      },
      {
        title: "Avg Response Time",
        value: formatResponseTime(overview.average_response_time_ms),
        hint: "Average runtime across vendors",
        icon: Clock3,
        accent: "border-amber-200/80 bg-gradient-to-br from-white via-amber-50/20 to-amber-50/40",
        iconBg: "bg-amber-100 text-amber-700",
        textVal: "text-amber-950"
      },
      {
        title: "Price Alerts",
        value: priceAlerts.length,
        hint: "New lowest fares detected",
        icon: BellRing,
        accent: "border-rose-200/80 bg-gradient-to-br from-white via-rose-50/20 to-rose-50/40",
        iconBg: "bg-rose-100 text-rose-700",
        textVal: "text-rose-950"
      }
    ]
  }, [overview, priceAlerts])

  const capacityOverviewCards = useMemo(() => {
    const totalCapacity = capacityCruises.reduce((sum, cruise) => sum + (cruise.totalCapacity ?? 0), 0)
    const totalSailings = capacityCruises.length
    const seatsAvailable = capacityCruises.reduce((sum, cruise) => sum + getSafeSeatsAvailable(cruise), 0)
    const avgLoadFactor = capacityCruises.length > 0
      ? capacityCruises.reduce((sum, cruise) => sum + calcLoadFactor(cruise), 0) / capacityCruises.length
      : 0
    const fleetUtilization = totalCapacity > 0 ? ((totalCapacity - seatsAvailable) / totalCapacity) * 100 : 0

    return [
      { title: "Total Capacity", value: formatNumber(totalCapacity), hint: "Seats across all active sailings", icon: Users },
      { title: "Total Sailings", value: formatNumber(totalSailings), hint: "Cruises currently in database", icon: Sailboat },
      { title: "Seats Available", value: formatNumber(seatsAvailable), hint: "Remaining seats open for booking", icon: CalendarRange },
      { title: "Avg Load Factor", value: formatPercent(avgLoadFactor), hint: "Average sold capacity per cruise", icon: BarChart3 },
      { title: "Fleet Utilization", value: formatPercent(fleetUtilization), hint: "Used capacity across whole fleet", icon: Gauge }
    ]
  }, [capacityCruises])

  const demandDistribution = useMemo(() => {
    return capacityVendorFleet.map(vendor => {
      const vendorCruises = capacityCruises.filter(cruise => cruise.vendor?.id === vendor.vendor_id)
      const totalCapacity = vendorCruises.reduce((sum, cruise) => sum + (cruise.totalCapacity ?? 0), 0)
      const seatsAvailable = vendorCruises.reduce((sum, cruise) => sum + getSafeSeatsAvailable(cruise), 0)
      const soldSeats = totalCapacity - seatsAvailable
      const avgLoad = vendorCruises.length > 0
        ? vendorCruises.reduce((sum, cruise) => sum + calcLoadFactor(cruise), 0) / vendorCruises.length
        : 0
      return { vendor: vendor.vendor_name, soldSeats, seatsAvailable, avgLoad: Math.round(avgLoad) }
    })
  }, [capacityCruises, capacityVendorFleet])

  const highDemandSailings = useMemo(() => {
    return [...capacityCruises]
      .map(cruise => ({ ...cruise, loadFactor: calcLoadFactor(cruise), safeSeatsAvailable: getSafeSeatsAvailable(cruise) }))
      .sort((a, b) => b.loadFactor - a.loadFactor)
      .slice(0, 6)
  }, [capacityCruises])

  const capacityOpportunities = useMemo(() => {
    return [...capacityCruises]
      .map(cruise => ({ ...cruise, loadFactor: calcLoadFactor(cruise), safeSeatsAvailable: getSafeSeatsAvailable(cruise) }))
      .sort((a, b) => (b.safeSeatsAvailable !== a.safeSeatsAvailable ? b.safeSeatsAvailable - a.safeSeatsAvailable : a.loadFactor - b.loadFactor))
      .slice(0, 6)
  }, [capacityCruises])

  const handleMarkAlertRead = async alertId => {
    try {
      await markCruisePriceAlertRead(alertId)
      setPriceAlerts(current => current.filter(alert => alert.id !== alertId))
    } catch (error) {
      console.error(error)
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
          <RefreshCcw size={16} className="animate-spin text-teal-600" />
          <span>Loading Cruise Saga Dashboard…</span>
        </div>
      </div>
    )
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(card => {
            const Icon = card.icon

            return (
              <div
                key={card.title}
                className={`rounded-xl border p-4 shadow-2xs transition-all hover:shadow-xs ${card.accent}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {card.title}
                    </p>
                    <p className={`mt-1 text-2xl font-black font-mono tracking-tight ${card.textVal}`}>
                      {card.value}
                    </p>
                  </div>
                  <div className={`rounded-lg p-2 shadow-2xs ${card.iconBg}`}>
                    <Icon size={16} />
                  </div>
                </div>
                <p className="mt-2 text-[11px] font-medium text-slate-500 line-clamp-1">
                  {card.hint}
                </p>
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

            <div className="mt-3.5 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {priceAlerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-xs font-medium text-slate-500">
                  No unread price alerts at this moment.
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
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-800">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-pulse" />
              <span>Fleet Utilization & Capacity Insights</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Seat & Demand Visibility Across Fleet
            </h2>
            <p className="text-xs text-slate-500">
              Real-time calculation from live vendor inventory runs and scheduled sailings.
            </p>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {capacityOverviewCards.map(card => {
            const Icon = card.icon
            return (
              <div key={card.title} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{card.title}</div>
                    <div className="mt-1 text-xl font-extrabold text-slate-900 font-mono">{card.value}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200/80 p-2 text-slate-700 shadow-2xs">
                    <Icon size={15} />
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-medium text-slate-500 line-clamp-1">{card.hint}</div>
              </div>
            )
          })}
        </div>

        {/* Demand Distribution Bar */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-4">
          <div className="text-sm font-bold text-slate-900">Vendor Demand Distribution</div>
          <div className="text-xs text-slate-500">Sold seats vs open seats across vendors.</div>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demandDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="vendor" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="soldSeats" name="Sold Seats" fill="#0f766e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="seatsAvailable" name="Seats Open" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* High Demand vs Opportunities */}
        <div className="grid gap-4 xl:grid-cols-2">
          <InsightPanelV2
            title="High Demand Sailings"
            subtitle="Cruises with highest load factor."
            items={highDemandSailings}
          />
          <OpportunityPanelV2
            title="Capacity Opportunities"
            subtitle="Sailings with most open seats available."
            items={capacityOpportunities}
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

function CapacityMetric({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 font-bold text-slate-900 font-mono text-xs">{value}</div>
    </div>
  )
}

function InsightPanelV2({ title, subtitle, items }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="text-xs text-slate-500">{subtitle}</div>
      <div className="mt-3.5 space-y-2.5">
        {items.map(item => (
          <div key={item.id} className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">{item.package}</div>
                <div className="mt-0.5 text-[11px] font-medium text-slate-500 truncate">
                  {item.vendor?.name} · {getCruiseRouteLabel(item)}
                </div>
                <div className="mt-0.5 text-[10px] font-semibold text-slate-400">{formatCapacityDate(item.startDate)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Load factor</div>
                <div className="mt-0.5 text-sm font-extrabold text-slate-900 font-mono">{formatPercent(item.loadFactor)}</div>
              </div>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full ${loadTone(item.loadFactor)}`} style={{ width: `${Math.min(100, item.loadFactor)}%` }} />
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-200/60 pt-2 text-xs">
              <CapacityMetric label="Seats Open" value={formatNumber(item.safeSeatsAvailable ?? getSafeSeatsAvailable(item))} />
              <CapacityMetric label="Capacity" value={formatNumber(item.totalCapacity ?? 0)} />
              <CapacityMetric label="Nights" value={item.nights ?? "--"} />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="py-6 text-center text-xs text-slate-400">No sailings found.</div>
        )}
      </div>
    </div>
  )
}

function OpportunityPanelV2({ title, subtitle, items }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="text-xs text-slate-500">{subtitle}</div>
      <div className="mt-3.5 space-y-2.5">
        {items.map(item => (
          <div key={item.id} className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">{item.package}</div>
                <div className="mt-0.5 text-[11px] font-medium text-slate-500 truncate">
                  {item.vendor?.name} · {getCruiseRouteLabel(item)}
                </div>
                <div className="mt-0.5 text-[10px] font-semibold text-slate-400">{formatCapacityDate(item.startDate)}</div>
              </div>
              <div className="rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-800 shrink-0">
                Open
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-200/60 pt-2 text-xs">
              <CapacityMetric label="Seats Open" value={formatNumber(item.safeSeatsAvailable ?? getSafeSeatsAvailable(item))} />
              <CapacityMetric label="Load factor" value={formatPercent(item.loadFactor)} />
              <CapacityMetric label="Capacity" value={formatNumber(item.totalCapacity ?? 0)} />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="py-6 text-center text-xs text-slate-400">No sailings found.</div>
        )}
      </div>
    </div>
  )
}
