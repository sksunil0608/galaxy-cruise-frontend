"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  BarChart3,
  BellRing,
  CalendarRange,
  Clock3,
  Database,
  Gauge,
  RefreshCcw,
  Sailboat,
  ServerCrash,
  ShieldCheck,
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
const loadTone = value => (value >= 85 ? "bg-rose-500" : value >= 65 ? "bg-amber-500" : "bg-emerald-500")
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
  Healthy: "bg-emerald-100 text-emerald-700",
  Attention: "bg-amber-100 text-amber-700",
  Critical: "bg-rose-100 text-rose-700"
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState(null)
  const [vendorFleet, setVendorFleet] = useState([])
  const [priceAlerts, setPriceAlerts] = useState([])
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [refreshState, setRefreshState] = useState("idle")

  // Capacity insights (merged from the former standalone page)
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
        hint: "Vendors with live runs or extracted cruise data",
        icon: Activity
      },
      {
        title: "Fleet Health",
        value: `${overview.fleet_health_score}%`,
        hint: overview.fleet_health_label,
        icon: ShieldCheck
      },
      {
        title: "Total Runs",
        value: overview.total_runs,
        hint: "Historical extraction runs stored in the database",
        icon: RefreshCcw
      },
      {
        title: "Average Response Time",
        value: formatResponseTime(overview.average_response_time_ms),
        hint: "Average runtime across recorded vendor runs",
        icon: Clock3
      },
      {
        title: "Unread Price Alerts",
        value: priceAlerts.length,
        hint: "Tagged cruises that hit a new lowest fare",
        icon: BellRing
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
      { title: "Total Capacity", value: formatNumber(totalCapacity), hint: "All vendor seats across active sailings", icon: Users },
      { title: "Sailings", value: formatNumber(totalSailings), hint: "Live cruises in the current database", icon: Sailboat },
      { title: "Seats Available", value: formatNumber(seatsAvailable), hint: "Remaining seats open for sale", icon: CalendarRange },
      { title: "Avg Load Factor", value: formatPercent(avgLoadFactor), hint: "Average sold capacity per sailing", icon: BarChart3 },
      { title: "Fleet Utilization", value: formatPercent(fleetUtilization), hint: "Used capacity across the whole fleet", icon: Gauge }
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
    return <div className="p-6">Loading dashboard...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Fleet Overview
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Vendor extraction health
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Every card below is fed from the backend database: vendor runs,
              cruise coverage, last updated time, and response time history.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <span
                className={`h-2 w-2 rounded-full ${
                  refreshState === "refreshing"
                    ? "bg-sky-500"
                    : refreshState === "success"
                      ? "bg-emerald-500"
                      : refreshState === "error"
                        ? "bg-rose-500"
                        : "bg-slate-400"
                }`}
              />
              {refreshState === "refreshing"
                ? "Refreshing dashboard..."
                : refreshState === "error"
                  ? "Refresh failed"
                  : `Last synced ${formatLastUpdated(lastSyncedAt)}`}
            </div>
          </div>
          <button
            onClick={fetchOverview}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium text-white transition ${
              loading
                ? "cursor-wait border-slate-700 bg-slate-700"
                : refreshState === "success"
                  ? "border-emerald-600 bg-emerald-600 hover:bg-emerald-500"
                  : "border-slate-200 bg-slate-900 hover:bg-slate-800"
            }`}
          >
            <RefreshCcw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            {loading
              ? "Refreshing..."
              : refreshState === "success"
                ? "Refreshed"
                : "Refresh"}
          </button>
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
          {cards.map(card => {
            const Icon = card.icon

            return (
              <div
                key={card.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {card.title}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-900">
                      {card.value}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                    <Icon size={18} />
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-500">
                  {card.hint}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Vendor Fleet
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Health score, last successful extraction, coverage range, and
                total inventory volume per vendor.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {vendorFleet.length} vendor{vendorFleet.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {vendorFleet.map(vendor => (
              <div
                key={vendor.vendor_id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {vendor.vendor_name}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${healthStyles[vendor.health_label] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {vendor.health_label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      Last updated {formatLastUpdated(vendor.last_updated_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Health score
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {vendor.health_score}%
                    </div>
                  </div>
                </div>

                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      vendor.health_score >= 85
                        ? "bg-emerald-500"
                        : vendor.health_score >= 65
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.min(vendor.health_score, 100)}%` }}
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 text-sm text-slate-600 xl:grid-cols-4">
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

                <div className="mt-5 grid grid-cols-3 gap-4 rounded-2xl bg-white p-4 text-sm">
                  <div>
                    <div className="text-slate-400">Cruises</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {vendor.cruise_count}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Ships</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {vendor.ship_count}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Cabin categories</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {vendor.cabin_category_count}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!loading && vendorFleet.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No vendor fleet data found yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Tagged Cruise Price Alerts
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  New lows found during recent vendor runs for your tagged cruises.
                </p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {priceAlerts.length} unread
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {priceAlerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  No unread price alerts right now.
                </div>
              ) : (
                priceAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className="rounded-2xl border border-emerald-200 bg-white px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {alert.cruisePackage || alert.cruiseCode}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {alert.vendor?.name || "Vendor"} · {alert.ship || "--"} · {alert.tag?.label || "Tag"}
                        </div>
                        <div className="mt-3 text-sm text-slate-700">
                          Dropped from{" "}
                          <span className="font-semibold">
                            {alert.previousPrice !== null && alert.previousPrice !== undefined
                              ? new Intl.NumberFormat("en-GB", {
                                  style: "currency",
                                  currency: alert.currency || "GBP"
                                }).format(alert.previousPrice)
                              : "--"}
                          </span>{" "}
                          to{" "}
                          <span className="font-semibold text-emerald-700">
                            {new Intl.NumberFormat("en-GB", {
                              style: "currency",
                              currency: alert.currency || "GBP"
                            }).format(alert.currentPrice)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkAlertRead(alert.id)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Mark read
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <h2 className="text-xl font-semibold text-slate-900">
            Vendor Cruise Distribution
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Cruise count in the database, grouped by vendor.
          </p>

          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorFleet}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="vendor_name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  formatter={(value, _name, item) => {
                    if (item.dataKey === "health_score") {
                      return [`${value}%`, "Health score"]
                    }

                    return [value, "Cruises"]
                  }}
                />
                <Bar
                  dataKey="cruise_count"
                  fill="#0f172a"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Snapshot
            </div>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Fleet health</span>
                <span className="font-semibold text-slate-900">
                  {overview ? `${overview.fleet_health_score}%` : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total runs stored</span>
                <span className="font-semibold text-slate-900">
                  {overview?.total_runs ?? "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Average response time</span>
                <span className="font-semibold text-slate-900">
                  {formatResponseTime(overview?.average_response_time_ms)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Capacity Insights (merged from the former standalone page) ──────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Capacity Insights</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-900">Seat and demand visibility across all vendors</h2>
        <p className="mt-2 text-sm text-slate-500">
          Capacity, sailing mix, seats available, demand distribution, and utilization are all calculated from the live cruise data in the database.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        {capacityOverviewCards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-500">{card.title}</div>
                  <div className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</div>
                </div>
                <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                  <Icon size={18} />
                </div>
              </div>
              <div className="mt-4 text-sm text-slate-500">{card.hint}</div>
            </div>
          )
        })}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-semibold text-slate-900">Demand distribution</div>
        <div className="mt-1 text-sm text-slate-500">Vendor-wise seat demand and average load factor from live inventory.</div>
        <div className="mt-6 h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={demandDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="vendor" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="soldSeats" fill="#0f172a" radius={[8, 8, 0, 0]} />
              <Bar dataKey="seatsAvailable" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <InsightPanelV2
          title="High demand sailings"
          subtitle="Sailings with the strongest load factor right now."
          items={highDemandSailings}
        />
        <OpportunityPanelV2
          title="Capacity opportunities"
          subtitle="Sailings with the most open seats and lower load factor."
          items={capacityOpportunities}
        />
      </div>

      {capacityLoading && (
        <div className="text-sm text-slate-500">Loading capacity insights...</div>
      )}
    </div>
  )
}

function MetricItem({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon size={14} />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-2 font-semibold text-slate-900">
        {value}
      </div>
    </div>
  )
}

function CapacityMetric({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function InsightPanelV2({ title, subtitle, items }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
      <div className="mt-6 space-y-4">
        {items.map(item => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-slate-900">{item.package}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {item.vendor?.name} · {getCruiseRouteLabel(item)}
                </div>
                <div className="mt-1 text-xs text-slate-400">{formatCapacityDate(item.startDate)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Load factor</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{formatPercent(item.loadFactor)}</div>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full ${loadTone(item.loadFactor)}`} style={{ width: `${Math.min(100, item.loadFactor)}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <CapacityMetric label="Seats available" value={formatNumber(item.safeSeatsAvailable ?? getSafeSeatsAvailable(item))} />
              <CapacityMetric label="Capacity" value={formatNumber(item.totalCapacity ?? 0)} />
              <CapacityMetric label="Nights" value={item.nights ?? "--"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OpportunityPanelV2({ title, subtitle, items }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
      <div className="mt-6 space-y-4">
        {items.map(item => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-slate-900">{item.package}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {item.vendor?.name} · {getCruiseRouteLabel(item)}
                </div>
                <div className="mt-1 text-xs text-slate-400">{formatCapacityDate(item.startDate)}</div>
              </div>
              <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Opportunity</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <CapacityMetric label="Seats open" value={formatNumber(item.safeSeatsAvailable ?? getSafeSeatsAvailable(item))} />
              <CapacityMetric label="Load factor" value={formatPercent(item.loadFactor)} />
              <CapacityMetric label="Capacity" value={formatNumber(item.totalCapacity ?? 0)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
