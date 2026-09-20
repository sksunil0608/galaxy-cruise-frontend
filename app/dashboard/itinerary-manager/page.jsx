"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Pencil, Trash2, X, Search } from "lucide-react"

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

const T = {
  border: "#e2e8f0",
  muted: "#f8fafc",
  textPrimary: "#0f172a",
  textMuted: "#94a3b8",
  textSlate: "#64748b",
  blue: "#1d4ed8",
  blueBg: "#eff6ff",
  red: "#ef4444",
  redBg: "#fef2f2",
  shadowCard: "0 2px 8px rgba(0,0,0,0.04)",
}

function Modal({ children, onClose, width = "min(96vw, 640px)" }) {
  useEffect(() => {
    const handle = (e) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [onClose])

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ width, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 32px 80px rgba(15,23,42,0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const inputStyle = {
  width: "100%", height: 38, borderRadius: 8, border: `1px solid ${T.border}`,
  padding: "8px 12px", fontSize: 13, outline: "none"
}
const labelStyle = { fontSize: 12, fontWeight: 600, color: T.textSlate, marginBottom: 4, display: "block" }

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

  async function submit() {
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
    <Modal onClose={onClose}>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isEdit ? "Edit Itinerary" : "Add Itinerary"}</h2>
        <button onClick={onClose} style={{ border: "none", background: T.muted, borderRadius: "50%", width: 32, height: 32, cursor: "pointer" }}><X size={14} /></button>
      </div>

      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Ship Name *</label>
          <input style={inputStyle} value={form.shipName} onChange={(e) => set("shipName", e.target.value)} placeholder="e.g. Azamara Journey" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Port From</label>
            <input style={inputStyle} value={form.portFrom} onChange={(e) => set("portFrom", e.target.value)} placeholder="e.g. Miami" />
          </div>
          <div>
            <label style={labelStyle}>Port To</label>
            <input style={inputStyle} value={form.portTo} onChange={(e) => set("portTo", e.target.value)} placeholder="e.g. Miami" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Stops (comma-separated, in order) *</label>
          <textarea
            style={{ ...inputStyle, height: 80, resize: "vertical", paddingTop: 8 }}
            value={form.stops}
            onChange={(e) => set("stops", e.target.value)}
            placeholder="Miami, Nassau, Great Stirrup Cay, Miami"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Nights</label>
            <input style={inputStyle} type="number" value={form.nights} onChange={(e) => set("nights", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Price</label>
            <input style={inputStyle} type="number" value={form.price} onChange={(e) => set("price", e.target.value)} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Deals Link</label>
          <input style={inputStyle} value={form.dealsLink} onChange={(e) => set("dealsLink", e.target.value)} placeholder="https://..." />
        </div>

        {error && <div style={{ fontSize: 12, color: T.red, background: T.redBg, borderRadius: 8, padding: "8px 12px" }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={{ border: `1px solid ${T.border}`, background: "#fff", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            style={{ border: "none", background: T.blue, color: "#fff", borderRadius: 8, padding: "9px 18px", cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Itinerary"}
          </button>
        </div>
      </div>
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

  async function submit() {
    if (!form.aliasKey.trim() || !form.canonical.trim()) {
      setError("Alias and canonical port are required")
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
    <Modal onClose={onClose} width="min(96vw, 460px)">
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isEdit ? "Edit Port Alias" : "Add Port Alias"}</h2>
        <button onClick={onClose} style={{ border: "none", background: T.muted, borderRadius: "50%", width: 32, height: 32, cursor: "pointer" }}><X size={14} /></button>
      </div>

      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Vendor Code / Alias *</label>
          <input style={inputStyle} value={form.aliasKey} onChange={(e) => setForm((f) => ({ ...f, aliasKey: e.target.value }))} placeholder="e.g. MIA" disabled={isEdit} />
          {isEdit && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>Alias key can&apos;t be changed — delete and re-add instead.</div>}
        </div>
        <div>
          <label style={labelStyle}>Maps To (canonical port name) *</label>
          <input style={inputStyle} value={form.canonical} onChange={(e) => setForm((f) => ({ ...f, canonical: e.target.value }))} placeholder="e.g. Miami" />
        </div>
        <div>
          <label style={labelStyle}>Note</label>
          <input style={inputStyle} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. GOCCL 3-letter code" />
        </div>

        {error && <div style={{ fontSize: 12, color: T.red, background: T.redBg, borderRadius: 8, padding: "8px 12px" }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={{ border: `1px solid ${T.border}`, background: "#fff", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            style={{ border: "none", background: T.blue, color: "#fff", borderRadius: 8, padding: "9px 18px", cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Alias"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ItineraryManagerPage() {
  const [tab, setTab] = useState("itineraries") // "itineraries" | "aliases"

  // itineraries state
  const [itineraries, setItineraries] = useState([])
  const [itinTotal, setItinTotal] = useState(0)
  const [itinPage, setItinPage] = useState(1)
  const [itinSearch, setItinSearch] = useState("")
  const [itinLoading, setItinLoading] = useState(true)
  const [itinEditing, setItinEditing] = useState(null) // null=closed, {}=new, {...row}=edit
  const PAGE_SIZE = 20

  // aliases state
  const [aliases, setAliases] = useState([])
  const [aliasSearch, setAliasSearch] = useState("")
  const [aliasLoading, setAliasLoading] = useState(true)
  const [aliasEditing, setAliasEditing] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null) // { kind: "itinerary"|"alias", id, label }

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
    <>
      <div style={{ padding: "0 32px 32px", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: T.textMuted, textTransform: "uppercase" }}>Reference Data</div>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, color: T.textPrimary }}>Itinerary Manager</h1>
          <div style={{ marginTop: 6, fontSize: 13, color: T.textSlate, maxWidth: 720 }}>
            Manage the static ship-route-stops reference data (originally imported from Book1.xlsx) that new cruises are
            automatically matched against at ingestion time, plus the port-name aliases used to reconcile vendor codes
            (e.g. &quot;MIA&quot;) with plain port names (e.g. &quot;Miami&quot;).
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { key: "itineraries", label: `Itineraries (${itinTotal})` },
            { key: "aliases", label: `Port Aliases (${aliases.length})` }
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${tab === t.key ? T.blue : T.border}`,
                background: tab === t.key ? T.blueBg : "#fff",
                color: tab === t.key ? T.blue : T.textSlate,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "itineraries" ? (
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, boxShadow: T.shadowCard, overflow: "hidden" }}>
            <div style={{ padding: 16, display: "flex", gap: 10, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
                <Search size={14} color={T.textMuted} style={{ position: "absolute", left: 12, top: 12 }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  placeholder="Search ship or port..."
                  value={itinSearch}
                  onChange={(e) => { setItinSearch(e.target.value); setItinPage(1) }}
                />
              </div>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setItinEditing({})}
                style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: T.blue, color: "#fff", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
              >
                <Plus size={14} /> Add Itinerary
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead style={{ background: T.muted }}>
                  <tr>
                    {["Ship", "Route", "Nights", "Stops", "Price", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: T.textSlate, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itinLoading ? (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Loading...</td></tr>
                  ) : itineraries.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: T.textMuted }}>No itineraries found.</td></tr>
                  ) : itineraries.map((row, i) => (
                    <tr key={row.id} style={{ background: i % 2 === 0 ? "#fff" : T.muted, borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>{row.shipName}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: T.textSlate }}>{row.portFrom} → {row.portTo}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "monospace" }}>{row.nights ?? "-"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: T.textMuted, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.stops.join(", ")}>
                        {row.stops.length} stop{row.stops.length !== 1 ? "s" : ""}: {row.stops.join(", ")}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "monospace" }}>{row.price != null ? `£${row.price}` : "-"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => setItinEditing(row)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6 }}><Pencil size={14} color={T.textSlate} /></button>
                        <button onClick={() => setDeleteTarget({ kind: "itinerary", id: row.id, label: row.shipName })} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6 }}><Trash2 size={14} color={T.red} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.textMuted }}>Page {itinPage} of {totalPages} · {itinTotal} total</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={itinPage <= 1} onClick={() => setItinPage((p) => p - 1)} style={{ border: `1px solid ${T.border}`, background: "#fff", borderRadius: 6, padding: "5px 12px", cursor: itinPage <= 1 ? "not-allowed" : "pointer", opacity: itinPage <= 1 ? 0.5 : 1, fontSize: 12 }}>Prev</button>
                <button disabled={itinPage >= totalPages} onClick={() => setItinPage((p) => p + 1)} style={{ border: `1px solid ${T.border}`, background: "#fff", borderRadius: 6, padding: "5px 12px", cursor: itinPage >= totalPages ? "not-allowed" : "pointer", opacity: itinPage >= totalPages ? 0.5 : 1, fontSize: 12 }}>Next</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, boxShadow: T.shadowCard, overflow: "hidden" }}>
            <div style={{ padding: 16, display: "flex", gap: 10, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
                <Search size={14} color={T.textMuted} style={{ position: "absolute", left: 12, top: 12 }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  placeholder="Search alias or port..."
                  value={aliasSearch}
                  onChange={(e) => setAliasSearch(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setAliasEditing({})}
                style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: T.blue, color: "#fff", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
              >
                <Plus size={14} /> Add Alias
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead style={{ background: T.muted }}>
                  <tr>
                    {["Vendor Code", "Maps To", "Note", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: T.textSlate, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aliasLoading ? (
                    <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Loading...</td></tr>
                  ) : aliases.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: T.textMuted }}>No aliases found.</td></tr>
                  ) : aliases.map((row, i) => (
                    <tr key={row.id} style={{ background: i % 2 === 0 ? "#fff" : T.muted, borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{row.aliasKey}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13 }}>{row.canonical}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: T.textMuted }}>{row.note || "-"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => setAliasEditing(row)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6 }}><Pencil size={14} color={T.textSlate} /></button>
                        <button onClick={() => setDeleteTarget({ kind: "alias", id: row.id, label: row.aliasKey })} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6 }}><Trash2 size={14} color={T.red} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
        <Modal onClose={() => setDeleteTarget(null)} width="min(94vw, 380px)">
          <div style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>Delete {deleteTarget.kind === "itinerary" ? "itinerary" : "alias"}?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: T.textSlate }}>
              &quot;{deleteTarget.label}&quot; will be permanently removed. This won&apos;t affect cruises that already have stops assigned.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} style={{ border: `1px solid ${T.border}`, background: "#fff", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button onClick={confirmDelete} style={{ border: "none", background: T.red, color: "#fff", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
