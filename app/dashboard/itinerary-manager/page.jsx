"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Compass,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Ship,
  Trash2,
  X
} from "lucide-react"

import {
  fetchItineraries,
  createItinerary,
  updateItinerary,
  deleteItinerary,
  fetchPortAliases,
  createPortAlias,
  updatePortAlias,
  deletePortAlias
} from "../api"

function Modal({ children, onClose, maxWidth = "max-w-xl" }) {
  useEffect(() => {
    const handle = (e) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200/80 bg-white p-6 shadow-2xl transition-all`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// ── Itinerary form modal ────────────────────────────────────────────────────

function ItineraryFormModal({ row, onClose, onSaved }) {
  const isEdit = Boolean(row?.id)
  const [form, setForm] = useState({
    shipName: row?.shipName || "",
    portFrom: row?.portFrom || "",
    portTo: row?.portTo || "",
    nights: row?.nights ?? "",
    stops: (row?.stops || []).join(", "),
    dealsLink: row?.dealsLink || "",
    price: row?.price ?? ""
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e) {
    if (e) e.preventDefault()
    if (!form.shipName.trim() || !form.stops.trim()) {
      setError("Ship name and stops are required")
      return
    }
    setSaving(true)
    setError("")
    try {
      const payload = {
        shipName: form.shipName.trim(),
        portFrom: form.portFrom.trim() || null,
        portTo: form.portTo.trim() || null,
        nights: form.nights === "" ? null : Number(form.nights),
        stops: form.stops.split(",").map((s) => s.trim()).filter(Boolean),
        dealsLink: form.dealsLink.trim() || null,
        price: form.price === "" ? null : Number(form.price)
      }
      if (isEdit) await updateItinerary(row.id, payload)
      else await createItinerary(payload)
      onSaved()
    } catch (err) {
      setError(err.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900">{isEdit ? "Edit Itinerary Blueprint" : "Add Itinerary Blueprint"}</h2>
          <p className="text-xs text-slate-500">Configure ports of call and reference route metadata.</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Ship Name *</label>
          <input
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            value={form.shipName}
            onChange={(e) => set("shipName", e.target.value)}
            placeholder="e.g. Azamara Journey"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Port From</label>
            <input
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              value={form.portFrom}
              onChange={(e) => set("portFrom", e.target.value)}
              placeholder="e.g. Miami"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Port To</label>
            <input
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              value={form.portTo}
              onChange={(e) => set("portTo", e.target.value)}
              placeholder="e.g. Miami"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Stops (comma-separated in sequence) *</label>
          <textarea
            className="w-full h-20 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            value={form.stops}
            onChange={(e) => set("stops", e.target.value)}
            placeholder="Miami, Nassau, Great Stirrup Cay, Miami"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Nights</label>
            <input
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              type="number"
              value={form.nights}
              onChange={(e) => set("nights", e.target.value)}
              placeholder="e.g. 7"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Reference Price (£)</label>
            <input
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              type="number"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="e.g. 899"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Deals Link (URL)</label>
          <input
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            value={form.dealsLink}
            onChange={(e) => set("dealsLink", e.target.value)}
            placeholder="https://..."
          />
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 h-9 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-4 h-9 text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Itinerary"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Port alias form modal ───────────────────────────────────────────────────

function AliasFormModal({ row, onClose, onSaved }) {
  const isEdit = Boolean(row?.id)
  const [form, setForm] = useState({
    aliasKey: row?.aliasKey || "",
    canonical: row?.canonical || "",
    note: row?.note || ""
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function submit(e) {
    if (e) e.preventDefault()
    if (!form.aliasKey.trim() || !form.canonical.trim()) {
      setError("Alias code and canonical port are required")
      return
    }
    setSaving(true)
    setError("")
    try {
      const payload = { aliasKey: form.aliasKey.trim(), canonical: form.canonical.trim(), note: form.note.trim() || null }
      if (isEdit) await updatePortAlias(row.id, payload)
      else await createPortAlias(payload)
      onSaved()
    } catch (err) {
      setError(err.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900">{isEdit ? "Edit Port Alias" : "Add Port Alias"}</h2>
          <p className="text-xs text-slate-500">Map vendor port codes to canonical names.</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Vendor Code / Alias *</label>
          <input
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:bg-slate-50 font-mono"
            value={form.aliasKey}
            onChange={(e) => setForm((f) => ({ ...f, aliasKey: e.target.value }))}
            placeholder="e.g. MIA"
            disabled={isEdit}
            required
          />
          {isEdit && <p className="mt-1 text-[11px] text-slate-400">Alias code cannot be altered. Delete and recreate if needed.</p>}
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Maps To (Canonical Port Name) *</label>
          <input
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            value={form.canonical}
            onChange={(e) => setForm((f) => ({ ...f, canonical: e.target.value }))}
            placeholder="e.g. Miami"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Note (Optional)</label>
          <input
            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="e.g. Carnival / GOCCL 3-letter abbreviation"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3.5 h-9 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-4 h-9 text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Alias"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ItineraryManagerPage() {
  const [tab, setTab] = useState("itineraries") // "itineraries" | "aliases"

  // itineraries state
  const [itineraries, setItineraries] = useState([])
  const [itinTotal, setItinTotal] = useState(0)
  const [itinPage, setItinPage] = useState(1)
  const [itinSearch, setItinSearch] = useState("")
  const [itinLoading, setItinLoading] = useState(true)
  const [itinEditing, setItinEditing] = useState(null)
  const PAGE_SIZE = 20

  // aliases state
  const [aliases, setAliases] = useState([])
  const [aliasSearch, setAliasSearch] = useState("")
  const [aliasLoading, setAliasLoading] = useState(true)
  const [aliasEditing, setAliasEditing] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)

  async function loadItineraries() {
    setItinLoading(true)
    try {
      const res = await fetchItineraries({ page: itinPage, limit: PAGE_SIZE, search: itinSearch || undefined })
      setItineraries(res.data || [])
      setItinTotal(res.pagination?.total ?? 0)
    } catch (err) {
      console.error(err)
    } finally {
      setItinLoading(false)
    }
  }

  async function loadAliases() {
    setAliasLoading(true)
    try {
      const res = await fetchPortAliases({ search: aliasSearch || undefined })
      setAliases(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setAliasLoading(false)
    }
  }

  useEffect(() => { loadItineraries() }, [itinPage, itinSearch])
  useEffect(() => { loadAliases() }, [aliasSearch])

  const totalPages = Math.max(1, Math.ceil(itinTotal / PAGE_SIZE))

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      if (deleteTarget.kind === "itinerary") {
        await deleteItinerary(deleteTarget.id)
        loadItineraries()
      } else {
        await deletePortAlias(deleteTarget.id)
        loadAliases()
      }
    } catch (err) {
      alert(err.message || "Delete failed")
    } finally {
      setDeleteTarget(null)
    }
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
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
              </span>
              <span>Reference Data · Ship Route Blueprints</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Itinerary Manager & Port Aliases
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">
              Manage static route-stop blueprints matched during ingestion, and configure port-name aliases to normalize vendor codes into standard port locations.
            </p>
          </div>

          {/* Segmented Tab Selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 backdrop-blur-xs p-1 shadow-2xs">
            {[
              { key: "itineraries", label: `Itineraries (${itinTotal})` },
              { key: "aliases", label: `Port Aliases (${aliases.length})` }
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3.5 h-8 text-xs font-bold transition-all cursor-pointer ${
                  tab === t.key
                    ? "bg-teal-700 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "itineraries" ? (
        <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          {/* Action & Search Bar */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                placeholder="Search ship or port…"
                value={itinSearch}
                onChange={(e) => { setItinSearch(e.target.value); setItinPage(1) }}
              />
            </div>
            <button
              onClick={() => setItinEditing({})}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-4 h-9 text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Itinerary</span>
            </button>
          </div>

          {/* Itineraries Mobile List View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {itinLoading ? (
              <div className="px-4 py-12 text-center text-xs text-slate-400 font-medium">
                Loading itineraries…
              </div>
            ) : itineraries.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-slate-400 font-medium">
                No itineraries found.
              </div>
            ) : (
              itineraries.map((row) => (
                <div key={row.id} className="p-4 bg-white hover:bg-slate-50/70 transition space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">{row.shipName}</div>
                      <div className="mt-0.5 text-xs font-semibold text-teal-700">
                        {row.portFrom || "--"} → {row.portTo || "--"}
                      </div>
                    </div>
                    <span className="font-bold text-slate-900 font-mono text-sm bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md shrink-0">
                      {row.price != null ? `£${row.price}` : "--"}
                    </span>
                  </div>

                  {/* Stops info & Nights */}
                  <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-500 uppercase">Duration</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        {row.nights != null ? `${row.nights} Nights` : "--"}
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        Stops ({row.stops?.length || 0})
                      </div>
                      <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {row.stops?.join(", ") || "--"}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => setItinEditing(row)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                    >
                      <Pencil size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ kind: "itinerary", id: row.id, label: row.shipName })}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition shadow-2xs cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Itineraries Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ship</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Nights</th>
                  <th className="px-4 py-3">Stops</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {itinLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      Loading itineraries…
                    </td>
                  </tr>
                ) : itineraries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      No itineraries found.
                    </td>
                  </tr>
                ) : (
                  itineraries.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {row.shipName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.portFrom || "--"} → {row.portTo || "--"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {row.nights ?? "--"}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={row.stops?.join(", ")}>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            {row.stops?.length || 0} stops
                          </span>
                          <span className="truncate text-slate-500">
                            {row.stops?.join(", ")}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 font-mono">
                        {row.price != null ? `£${row.price}` : "--"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setItinEditing(row)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ kind: "itinerary", id: row.id, label: row.shipName })}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <div className="text-center sm:text-left">
              Showing page <span className="font-bold text-slate-800">{itinPage}</span> of <span className="font-bold text-slate-800">{totalPages}</span> · {itinTotal} total blueprints
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={itinPage <= 1}
                onClick={() => setItinPage((p) => Math.max(1, p - 1))}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-bold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={itinPage >= totalPages}
                onClick={() => setItinPage((p) => p + 1)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-bold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          {/* Action & Search Bar */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                placeholder="Search alias code or port…"
                value={aliasSearch}
                onChange={(e) => setAliasSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setAliasEditing({})}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-4 h-9 text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Port Alias</span>
            </button>
          </div>

          {/* Port Aliases Mobile List View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {aliasLoading ? (
              <div className="px-4 py-12 text-center text-xs text-slate-400 font-medium">
                Loading port aliases…
              </div>
            ) : aliases.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-slate-400 font-medium">
                No port aliases found.
              </div>
            ) : (
              aliases.map((row) => (
                <div key={row.id} className="p-4 bg-white hover:bg-slate-50/70 transition space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <span className="inline-block rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 font-mono">
                        {row.aliasKey}
                      </span>
                      <div className="font-bold text-slate-900 text-sm truncate">{row.canonical}</div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setAliasEditing(row)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ kind: "alias", id: row.id, label: row.aliasKey })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:text-rose-700 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {row.note && (
                    <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {row.note}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Port Aliases Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Vendor Code / Alias</th>
                  <th className="px-4 py-3">Canonical Port Name</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {aliasLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                      Loading port aliases…
                    </td>
                  </tr>
                ) : aliases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                      No port aliases found.
                    </td>
                  </tr>
                ) : (
                  aliases.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3">
                        <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 font-mono">
                          {row.aliasKey}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {row.canonical}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {row.note || "--"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setAliasEditing(row)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ kind: "alias", id: row.id, label: row.aliasKey })}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {itinEditing !== null && (
        <ItineraryFormModal
          row={itinEditing.id ? itinEditing : null}
          onClose={() => setItinEditing(null)}
          onSaved={() => { setItinEditing(null); loadItineraries() }}
        />
      )}

      {aliasEditing !== null && (
        <AliasFormModal
          row={aliasEditing.id ? aliasEditing : null}
          onClose={() => setAliasEditing(null)}
          onSaved={() => { setAliasEditing(null); loadAliases() }}
        />
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} maxWidth="max-w-sm">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Delete {deleteTarget.kind === "itinerary" ? "Itinerary Blueprint" : "Port Alias"}?
            </h3>
            <p className="text-xs text-slate-600">
              &quot;{deleteTarget.label}&quot; will be permanently deleted from the database.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 h-8.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3.5 h-8.5 text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
