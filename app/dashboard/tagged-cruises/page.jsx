"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronDown, ChevronUp, Tag, TrendingDown } from "lucide-react"

import { fetchCruises, fetchCruiseTags, fetchShips, fetchUsers, fetchVendors, refreshCruiseCabins, getCruiseRefreshStatus } from "../api"
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
  const [filters, setFilters] = useState({
    tag: "",
    assignedTo: "",
    vendorName: "",
    ship: "",
    startDateFrom: "",
    endDateTo: ""
  })
  const [appliedFilters, setAppliedFilters] = useState({
    tag: "",
    assignedTo: "",
    vendorName: "",
    ship: "",
    startDateFrom: "",
    endDateTo: ""
  })

  useEffect(() => {
    let active = true

    const loadDirectory = async () => {
      try {
        const [tagResponse, vendorResponse, shipResponse, userResponse] = await Promise.all([
          fetchCruiseTags(),
          fetchVendors({ limit: 100 }),
          fetchShips({ limit: 100 }),
          fetchUsers()
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
          vendors: vendorResponse.data?.map(vendor => vendor.name).filter(Boolean) || [],
          ships: shipResponse.data?.map(ship => ship.name).filter(Boolean) || [],
          users: userResponse.data?.map(user => user.name).filter(Boolean) || []
        })
      } catch (err) {
        if (active) {
          console.error(err)
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

      setRows(response.data || [])
      setPagination(response.pagination || null)
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
    const drops = rows.reduce(
      (count, row) =>
        count +
        (row.tags || []).filter(tag => tag.lastPriceDropAt).length,
      0
    )

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
    <div className="min-h-screen bg-slate-50 px-6 py-2">
      <div className="mx-auto max-w-[1240px] space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Employee Booking Queue
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">
            Tagged Cruises
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Saved tags from cruise search, persisted in the database for team follow-up and booking review.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tagged cruises" value={summary.totalTagged} />
            <StatCard label="Assigned employees" value={summary.employees} />
            <StatCard label="Ships covered" value={summary.ships} />
            <StatCard label="Price drops tracked" value={summary.drops} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Tag</span>
              <input
                list="tagged-tag-options"
                value={filters.tag}
                onChange={event => setFilters(current => ({ ...current, tag: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="Employee Booking"
              />
              <datalist id="tagged-tag-options">
                {tagDirectory.tags.map(item => (
                  <option key={item.label} value={item.label} />
                ))}
              </datalist>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Assigned to</span>
              <select
                value={filters.assignedTo}
                onChange={event => setFilters(current => ({ ...current, assignedTo: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
              >
                <option value="">All assignees</option>
                {lookupOptions.users.map(item => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Vendor</span>
              <select
                value={filters.vendorName}
                onChange={event => setFilters(current => ({ ...current, vendorName: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
              >
                <option value="">All vendors</option>
                {vendorOptions.map(item => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Ship</span>
              <select
                value={filters.ship}
                onChange={event => setFilters(current => ({ ...current, ship: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
              >
                <option value="">All ships</option>
                {shipOptions.map(item => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <DateField
              label="Departure from"
              value={filters.startDateFrom}
              onChange={value => setFilters(current => ({ ...current, startDateFrom: value }))}
            />

            <DateField
              label="Departure to"
              value={filters.endDateTo}
              onChange={value => setFilters(current => ({ ...current, endDateTo: value }))}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={applyFilters}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Apply filters
            </button>
            <button
              onClick={resetFilters}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              {loading ? "Loading tagged cruises..." : `${pagination?.total ?? rows.length} tagged cruise${(pagination?.total ?? rows.length) === 1 ? "" : "s"}`}
            </div>
            <div className="text-sm text-slate-500">
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
              {rows.map(row => {
                const availPrices = (row.cabinCategories || [])
                  .filter(c => c.avlResult === "OK")
                  .map(c => Number(c.cabinPrice ?? 0))
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
                const hasPriceDrop = (row.tags || []).some(t => t.lastPriceDropAt)

                return (
                  <div
                    key={row.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                            {row.vendor?.name || "Vendor"}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                            {getCruiseDisplayId(row)}
                          </span>
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            Load {getLoadFactor(row)}%
                          </span>
                          {hasPriceDrop && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              <TrendingDown size={12} />
                              Price drop
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900">{row.package}</h2>
                        <div className="text-sm text-slate-500">
                          {row.ship} · {getCruiseRouteLabel(row)} · {row.nights}N
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(row.tags || []).map(tag => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                              style={{
                                background: `${tag.color || "#2563eb"}18`,
                                color: tag.color || "#2563eb"
                              }}
                            >
                              <Tag size={12} />
                              {tag.label}
                              {tag.assignedTo ? ` · ${tag.assignedTo}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2 lg:min-w-[320px]">
                        <Metric label="Departure" value={formatDate(row.startDate)} icon={CalendarDays} />
                        <Metric label="Arrival" value={formatDate(row.endDate)} icon={CalendarDays} />
                        <Metric label="Avail. / Total cabins" value={`${Number(row.seatsAvailable ?? 0).toLocaleString()} / ${Number(row.totalCapacity ?? 0).toLocaleString()}`} />
                        <Metric label="Current lowest" value={lowest !== null ? formatCurrency(lowest, row.currency) : "WTL"} />
                        <Metric
                          label="Tracked low (at tag)"
                          value={trackedLow !== null ? formatCurrency(trackedLow, row.currency) : "--"}
                        />
                        <Metric
                          label="Last seen"
                          value={lastSeen !== null ? formatCurrency(lastSeen, row.currency) : "--"}
                        />
                      </div>
                    </div>

                    {hasPriceDrop ? (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {(row.tags || [])
                          .filter(tag => tag.lastPriceDropAt)
                          .map(tag => (
                            <div key={`${tag.id}-drop`}>
                              <span className="font-semibold">{tag.label}</span>
                              {tag.assignedTo ? ` · ${tag.assignedTo}` : ""} hit a new low of{" "}
                              <span className="font-semibold">
                                {tag.trackedLowestPrice !== null && tag.trackedLowestPrice !== undefined
                                  ? formatCurrency(tag.trackedLowestPrice, row.currency)
                                  : "--"}
                              </span>{" "}
                              on {formatDate(tag.lastPriceDropAt)}
                            </div>
                          ))}
                      </div>
                    ) : null}

                    {(row.tags || []).some(tag => tag.note) ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {(row.tags || [])
                          .filter(tag => tag.note)
                          .map(tag => (
                            <div key={`${tag.id}-note`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                              <span className="font-semibold text-slate-900">{tag.label}</span>
                              {tag.assignedTo ? ` · ${tag.assignedTo}` : ""}: {tag.note}
                            </div>
                          ))}
                      </div>
                    ) : null}

                    {(() => {
                      const job = refreshJobs[row.id]
                      const isRunning = job?.status === "started" || job?.status === "in_progress"
                      const isCooldown = job?.status === "cooldown"
                      const isError = job?.status === "error" || job?.status === "rate_limited"
                      const remainingSec = isRunning ? Math.ceil((job.remaining ?? 0) / 1000) : isCooldown ? (job.retryAfter ?? 0) : 0
                      return (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          {isRunning ? (
                            <span className="text-sm text-slate-500">
                              Fetching live data… ~{fmtSeconds(remainingSec)} remaining
                            </span>
                          ) : isCooldown ? (
                            <span className="text-sm text-slate-500">Data fetched — next refresh in {fmtSeconds(remainingSec)}</span>
                          ) : (
                            <button
                              onClick={() => handleGetFullDetails(row)}
                              className="rounded-xl border border-blue-700 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Get Full Details
                            </button>
                          )}
                          {isError && (
                            <span className="text-xs text-red-600">
                              {job.error ?? "Too many requests."}{job.retryAfter ? ` Retry in ${fmtSeconds(job.retryAfter)}.` : ""}
                            </span>
                          )}
                        </div>
                      )
                    })()}

                    {cabinGroups.length > 0 && (
                      <div className="mt-4">
                        <button
                          onClick={() => toggleExpand(row.id)}
                          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          {isExpanded ? "Hide" : "Show"} cabin categories ({(row.cabinCategories || []).length})
                        </button>

                        {isExpanded && (
                          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {cabinGroups.map(group => (
                              <div key={group.group} className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-3 flex items-center justify-between">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.group}</span>
                                  {group.minPrice !== null ? (
                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                      from {formatCurrency(group.minPrice, row.currency)}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">WTL</span>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {group.categories.map(cat => (
                                    <div key={cat.code} className="flex items-center justify-between gap-2 text-sm">
                                      <div>
                                        <span className="font-medium text-slate-800">{cat.code}</span>
                                        {cat.name && cat.name !== cat.code && (
                                          <span className="ml-1 text-xs text-slate-400">{cat.name}</span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        {cat.avlResult === "OK" && cat.cabinPrice > 0 ? (
                                          <span className="font-semibold text-slate-900">
                                            {formatCurrency(cat.cabinPrice, row.currency)}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-slate-400">
                                            {cat.avlResult === "OK" ? "WTL" : cat.avlResult || "N/A"}
                                          </span>
                                        )}
                                        {cat.avail != null && (
                                          <div className="text-xs text-slate-400">{cat.avail} avail.</div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={!pagination?.hasPreviousPage || loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(current => current + 1)}
              disabled={!pagination?.hasNextPage || loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {Icon ? <Icon size={14} /> : null}
        <span>{label}</span>
      </div>
      <div className="mt-2 font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function DateField({ label, value, onChange }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="date"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
      />
    </label>
  )
}
