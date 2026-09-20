"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Pin, Minus, Tag, TrendingDown, TrendingUp, X, ImageIcon } from "lucide-react";

import {
  createCruiseTag,
  deleteCruiseTag,
  fetchCruises,
  fetchCruiseTags,
  fetchShips,
  fetchShip,
  fetchUsers,
  fetchVendors,
  updateCruiseTag
} from "../api";
import {
  buildCabinGroups,
  getCruiseDisplayId,
  getCruiseRouteLabel,
  normalizeCabinCategory
} from "../cruise-helpers";
import { fetchCategoryDecks, refreshCruiseCabins, getCruiseRefreshStatus, logActivity, fetchCruise } from "../api";

const PAGE_SIZE = 20;

// Some vendors (e.g. CompleteCruiseSolution A/B) serve multiple cruise-line
// brands through the same backend, tagged on each cruise as cruiseLine.
const CRUISE_LINE_LABELS = {
  PO: "P&O Cruises",
  CUNARD: "Cunard Line",
  PRINCESS: "Princess Cruises",
};

const T = {
  bg: "#f8fafc",
  surface: "#ffffff",
  muted: "#f8fafc",
  border: "#e2e8f0",
  textPrimary: "#0f172a",
  textMuted: "#94a3b8",
  textSlate: "#64748b",
  blue: "#1d4ed8",
  blueBg: "#eff6ff",
  amberBg: "#fef9c3",
  amberDk: "#854d0e",
  green: "#16a34a",
  red: "#ef4444",
  shadowCard: "0 2px 8px rgba(0,0,0,0.04)",
  shadowModal: "0 32px 80px rgba(0,0,0,0.22)",
  fontBase: "'DM Sans', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
};

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "-";

const safeCurrency = (amount, currency = "GBP") =>
  `${currency === "GBP" ? "\u00A3" : "$"}${Number(amount ?? 0).toLocaleString()}`;

// Type-to-filter combobox \u2014 replaces native <select>/<datalist> (unstyled,
// browser-controlled popup) with a fully styled dropdown that filters as you type.
function SearchableSelect({ placeholder, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef(null);

  useEffect(() => {
    function onClickOutside(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        style={{ width: "100%", height: 38, borderRadius: 8, border: `1px solid ${T.border}`, padding: "8px 12px" }}
        placeholder={placeholder}
        value={open ? query : value || ""}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(event) => setQuery(event.target.value)}
      />
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30,
            maxHeight: 260, overflowY: "auto", background: "#fff", borderRadius: 10,
            border: `1px solid ${T.border}`, boxShadow: "0 12px 32px rgba(15,23,42,0.14)",
          }}
        >
          <div
            onMouseDown={(event) => { event.preventDefault(); onChange(""); setOpen(false); setQuery(""); }}
            style={{ padding: "9px 12px", fontSize: 13, fontWeight: 600, color: T.textSlate, cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
          >
            {placeholder} (all)
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: "9px 12px", fontSize: 13, color: T.textMuted }}>No matches</div>
          )}
          {filtered.map((opt) => (
            <div
              key={opt}
              onMouseDown={(event) => { event.preventDefault(); onChange(opt); setOpen(false); setQuery(""); }}
              style={{
                padding: "9px 12px", fontSize: 13, cursor: "pointer",
                background: opt === value ? T.blueBg : "transparent",
                color: opt === value ? T.blue : T.textPrimary,
              }}
              onMouseEnter={(event) => { if (opt !== value) event.currentTarget.style.background = T.muted; }}
              onMouseLeave={(event) => { if (opt !== value) event.currentTarget.style.background = "transparent"; }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const lfColor = (pct) => (pct >= 85 ? "#ef4444" : pct >= 60 ? "#d97706" : "#16a34a");

const typeColor = (type) =>
  ({
    Interior: { bg: "#f1f5f9", color: "#475569" },
    Exterior: { bg: "#f0f9ff", color: "#0284c7" },
    Balcony:  { bg: "#ecfeff", color: "#0f766e" },
    Suite:    { bg: "#ede9fe", color: "#6d28d9" },
  })[type] || { bg: "#f1f5f9", color: "#475569" };

const getVisiblePages = (currentPage, totalPages) => {
  if (!totalPages || totalPages <= 1) {
    return [1];
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
  }

  return [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
};

function Modal({ children, onClose, width = "min(96vw, 920px)" }) {
  useEffect(() => {
    const handle = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ width, maxHeight: "94vh", overflowY: "auto", background: T.surface, borderRadius: 20, boxShadow: T.shadowModal }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ShipModal({ row, onClose }) {
  const shipCode = row.shipCode || row.shipDetails?.code || row.ship;
  const [shipData, setShipData] = useState(null);
  const [loadingShip, setLoadingShip] = useState(Boolean(shipCode));
  const [shipError, setShipError] = useState("");
  const [imageSrc, setImageSrc] = useState(row.shipDetails?.image || null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const ship = shipData || row.shipDetails || {};
  const decks = shipData?.decks || [];
  const selectedDeck =
    decks.find(deck => deck.id === selectedDeckId) || decks[0] || null;
  const stats = [
    ["Cabins", ship.cabins],
    ["Guests", ship.guests],
    ["Restaurants", ship.restaurants],
    ["Bars", ship.bars],
    ["Pools", ship.pools],
    ["Crew", ship.crew],
    ["Spa", ship.spa],
  ].filter(([, value]) => value !== undefined && value !== null);

  useEffect(() => {
    setImageSrc(ship.image || null);
  }, [ship.image]);

  useEffect(() => {
    let active = true;

    const loadShip = async () => {
      if (!shipCode) {
        setLoadingShip(false);
        return;
      }

      try {
        setLoadingShip(true);
        setShipError("");
        const response = await fetchShip(shipCode);

        if (!active) {
          return;
        }

        const nextShip = response.data || null;
        setShipData(nextShip);
        setSelectedDeckId(current => current ?? nextShip?.decks?.[0]?.id ?? null);
      } catch (error) {
        if (!active) {
          return;
        }

        setShipError(error.message || "Failed to load ship details");
      } finally {
        if (active) {
          setLoadingShip(false);
        }
      }
    };

    loadShip();

    return () => {
      active = false;
    };
  }, [shipCode]);

  return (
    <Modal onClose={onClose} width="min(96vw, 1080px)">
      <div style={{ padding: 24, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Ship Details</div>
          <h2 style={{ margin: "6px 0 0", fontSize: 24 }}>{ship.name || row.ship}</h2>
          <div style={{ marginTop: 6, fontSize: 12, color: T.textMuted, fontFamily: T.fontMono }}>{shipCode || "--"}</div>
        </div>
        <button onClick={onClose} style={{ border: "none", background: T.muted, borderRadius: "50%", width: 36, height: 36, cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: "18px 24px 0", display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { key: "overview", label: "Overview" },
          { key: "decks", label: `Deck Plans (${decks.length})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              border: `1px solid ${activeTab === tab.key ? T.blue : T.border}`,
              background: activeTab === tab.key ? T.blueBg : "#fff",
              color: activeTab === tab.key ? T.blue : T.textSlate,
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        {loadingShip ? (
          <div style={{ padding: 32, textAlign: "center", color: T.textMuted }}>Loading ship details...</div>
        ) : shipError ? (
          <div style={{ padding: 20, borderRadius: 14, background: "#fef2f2", color: T.red }}>{shipError}</div>
        ) : null}

        {activeTab === "overview" ? (
          <>
            {imageSrc && (
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", background: T.muted, height: 260, position: "relative" }}>
                <Image
                  src={imageSrc}
                  alt={ship.name || row.ship}
                  fill
                  sizes="(max-width: 768px) 96vw, 1080px"
                  style={{ objectFit: "cover" }}
                  onError={() => setImageSrc(null)}
                />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {stats.map(([label, value]) => (
                <div key={label} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, background: T.muted }}>
                  <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ marginTop: 4, fontWeight: 700, color: T.textPrimary }}>{value}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {activeTab === "decks" ? (
          decks.length === 0 ? (
            <div style={{ padding: 32, border: `1px dashed ${T.border}`, borderRadius: 16, textAlign: "center", color: T.textMuted }}>
              No deck plans saved for this ship yet.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr)", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {decks.map(deck => (
                  <button
                    key={deck.id}
                    onClick={() => setSelectedDeckId(deck.id)}
                    style={{
                      textAlign: "left",
                      border: `1px solid ${selectedDeck?.id === deck.id ? T.blue : T.border}`,
                      background: selectedDeck?.id === deck.id ? T.blueBg : "#fff",
                      color: selectedDeck?.id === deck.id ? T.blue : T.textPrimary,
                      borderRadius: 14,
                      padding: 14,
                      cursor: "pointer"
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{deck.name}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: T.textMuted }}>
                      {deck.deckNumber ? `Deck ${deck.deckNumber}` : "Unnumbered deck"} · {deck.sections?.length || 0} sections
                    </div>
                  </button>
                ))}
              </div>

              {selectedDeck ? (
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "#fff", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 22 }}>{selectedDeck.name}</h3>
                      <div style={{ marginTop: 6, color: T.textMuted }}>
                        {selectedDeck.deckNumber ? `Deck ${selectedDeck.deckNumber}` : "Deck plan"}
                      </div>
                      {selectedDeck.description ? (
                        <div style={{ marginTop: 10, color: T.textSlate }}>{selectedDeck.description}</div>
                      ) : null}
                    </div>
                  </div>

                  {selectedDeck.image ? (
                    <div style={{ position: "relative", minHeight: 320, borderRadius: 16, overflow: "hidden", background: T.muted }}>
                      <Image
                        src={selectedDeck.image}
                        alt={selectedDeck.name}
                        fill
                        sizes="(max-width: 768px) 96vw, 720px"
                        style={{ objectFit: "contain" }}
                      />
                    </div>
                  ) : null}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    {(selectedDeck.sections || []).map(section => (
                      <div key={section.id} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, background: T.muted }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                          <div style={{ fontWeight: 700, color: T.textPrimary }}>{section.title}</div>
                          {section.sectionType ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: T.blue, background: T.blueBg, borderRadius: 999, padding: "3px 8px" }}>
                              {section.sectionType}
                            </span>
                          ) : null}
                        </div>
                        {section.description ? (
                          <div style={{ marginTop: 8, color: T.textSlate, fontSize: 13 }}>{section.description}</div>
                        ) : null}
                        {section.cabinCodes?.length ? (
                          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {section.cabinCodes.map(code => (
                              <span key={`${section.id}-${code}`} style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 700 }}>
                                {code}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </Modal>
  );
}

const STATUS_STYLE = {
  Available: { bg: "#dcfce7", color: "#16a34a" },
  Guarantee: { bg: "#dbeafe", color: "#1d4ed8" },
  "Sold Out": { bg: "#f1f5f9", color: "#94a3b8" },
};

function statusStyle(status) {
  return STATUS_STYLE[status] ?? STATUS_STYLE["Sold Out"];
}

function fmtSeconds(sec) {
  if (!sec || sec <= 0) return "0s";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const fmtFetchedAt = (ts) => {
  if (!ts) return null;
  const d = new Date(ts);
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) +
    " " + d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

function DataRefreshStrip({ job, row, onRefresh }) {
  const status       = job?.status;
  const isRunning    = status === "in_progress" || status === "started";
  const isCooldown   = status === "cooldown";
  const isBlocked    = isRunning || isCooldown;
  const remainingSec = isRunning
    ? Math.ceil((job?.remaining ?? 0) / 1000)
    : isCooldown ? (job?.retryAfter ?? 0) : 0;
  const stillFetching = isRunning && remainingSec <= 0;
  const fetchedTs = !isRunning
    ? (job?.completedAt ?? (row?.cabinsUpdatedAt ? new Date(row.cabinsUpdatedAt).getTime() : null))
    : null;
  const fetchedLabel = isRunning ? null : fetchedTs ? `Fetched ${fmtFetchedAt(fetchedTs)}` : "Not available";

  return (
    <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, borderTop: `1px solid ${T.border}` }}>
      {isRunning && (
        <span style={{ fontSize: 12, color: T.textMuted }}>
          {stillFetching ? "Still fetching, almost done…" : `Refreshing… ~${fmtSeconds(remainingSec)} remaining`}
        </span>
      )}
      {isCooldown && (
        <span style={{ fontSize: 12, color: T.textMuted }}>
          Next refresh in {fmtSeconds(remainingSec)}
        </span>
      )}
      {fetchedLabel && (
        <span style={{ fontSize: 11, color: T.textMuted }}>
          {fetchedLabel}
        </span>
      )}
      <button
        onClick={onRefresh}
        disabled={isBlocked}
        style={{
          padding: "4px 12px", border: `1px solid ${T.border}`, borderRadius: 6,
          background: isBlocked ? T.muted : T.surface,
          color: isBlocked ? T.textMuted : T.textSlate,
          fontSize: 11, fontWeight: 600,
          cursor: isBlocked ? "not-allowed" : "pointer",
          opacity: isBlocked ? 0.6 : 1,
        }}
      >
        Refresh Data
      </button>
    </div>
  );
}

function RefreshBanner({ job, onRefresh }) {
  const status     = job?.status;
  const isRunning  = status === "in_progress" || status === "started";
  const isCooldown = status === "cooldown";
  const isError    = status === "error" || status === "rate_limited";
  const isBlocked  = isRunning || isCooldown;

  const remainingSec = isRunning
    ? Math.ceil((job?.remaining ?? 0) / 1000)
    : isCooldown ? (job?.retryAfter ?? 0) : 0;
  const stillFetching = isRunning && remainingSec <= 0;

  return (
    <div style={{ padding: "12px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderTop: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 13, color: "#64748b" }}>
        {isRunning
          ? stillFetching
            ? "Still fetching, almost done…"
            : `Fetching live data… ~${fmtSeconds(remainingSec)} remaining`
          : isCooldown  ? `Data fetched — next refresh in ${fmtSeconds(remainingSec)}`
          : job?.success ? "No cabin-level data available for this vendor."
          : isError     ? null
          : "No detailed cabin data yet."}
      </span>
      {isError && (
        <span style={{ fontSize: 12, color: "#ef4444" }}>
          {job.error ?? "Too many requests."}{job.retryAfter ? ` Retry in ${fmtSeconds(job.retryAfter)}.` : ""}
        </span>
      )}
      {!isBlocked && (
        <button
          onClick={onRefresh}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 14px", border: "1px solid #1d4ed8",
            borderRadius: 6, background: "#eff6ff",
            color: "#1d4ed8", fontSize: 12, fontWeight: 600, cursor: "pointer"
          }}
        >
          Get Full Details
        </button>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const ss = STATUS_STYLE[status] ?? STATUS_STYLE["Sold Out"];
  return (
    <span style={{ background: ss.bg, color: ss.color, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {status ?? "—"}
    </span>
  );
}

const ACTIVITY_COLOR = {
  DEPART:         { bg: "#fee2e2", color: "#b91c1c" },
  "ARRIVE-DOCK":  { bg: "#dcfce7", color: "#15803d" },
  "ARRIVE-TENDER":{ bg: "#d1fae5", color: "#065f46" },
  "AT SEA":       { bg: "#e0f2fe", color: "#0369a1" },
};

function activityStyle(activity = "") {
  const key = Object.keys(ACTIVITY_COLOR).find(k => activity.toUpperCase().includes(k));
  return ACTIVITY_COLOR[key] ?? { bg: "#f1f5f9", color: "#475569" };
}

function ItineraryModal({ row, onClose }) {
  const stops = Array.isArray(row.itineraryStops) ? row.itineraryStops : [];

  return (
    <Modal onClose={onClose} width="min(96vw, 780px)">
      {/* Header */}
      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Itinerary</div>
          <h2 style={{ margin: "4px 0 2px", fontSize: 19, fontWeight: 700 }}>{row.package}</h2>
          <div style={{ fontSize: 13, color: T.textSlate }}>
            {row.ship && <span style={{ fontWeight: 600 }}>{row.ship}</span>}
            {row.nights && <span style={{ color: T.textMuted }}> &middot; {row.nights} nights</span>}
          </div>
        </div>
        <button onClick={onClose} style={{ border: "none", background: T.muted, borderRadius: "50%", width: 34, height: 34, cursor: "pointer", flexShrink: 0 }}>
          <X size={15} />
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowY: "auto", maxHeight: "65vh" }}>
        {stops.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: T.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🗺️</div>
            <div style={{ fontWeight: 600 }}>Detailed itinerary not yet loaded</div>
            <div style={{ fontSize: 13, marginTop: 6, color: T.textMuted }}>Port-by-port data will appear here once fetched from the carrier.</div>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "44px 96px 76px 1fr 1fr 100px", gap: "0 12px", padding: "8px 20px", background: T.muted, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0 }}>
              {["Day", "Date", "Time", "Activity", "Port of Call", "Country"].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
              ))}
            </div>
            {stops.map((stop, i) => {
              const as = activityStyle(stop.activity ?? "");
              return (
                <div
                  key={i}
                  style={{ display: "grid", gridTemplateColumns: "44px 96px 76px 1fr 1fr 100px", gap: "0 12px", padding: "11px 20px", borderBottom: `1px solid ${T.border}`, alignItems: "center", background: i % 2 === 0 ? "#fff" : T.muted }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textSlate }}>{stop.day}</span>
                  <span style={{ fontSize: 12, color: T.textPrimary, fontFamily: T.fontMono }}>{stop.date}</span>
                  <span style={{ fontSize: 12, color: T.textSlate, fontFamily: T.fontMono }}>{stop.time}</span>
                  <span>
                    <span style={{ background: as.bg, color: as.color, borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {stop.activity}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{stop.port}</span>
                  <span style={{ fontSize: 12, color: T.textSlate }}>{stop.country}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </Modal>
  );
}

function LeadInDetailsPanel({ job, minPrice, currency, onGetDetails }) {
  const isRunning  = job?.status === "in_progress" || job?.status === "started";
  const isCooldown = job?.status === "cooldown";
  const isError    = job?.status === "error" || job?.status === "rate_limited";
  const remainingSec = isRunning ? Math.ceil((job.remaining ?? 0) / 1000) : isCooldown ? (job.retryAfter ?? 0) : 0;

  return (
    <div style={{ padding: "48px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 26 }}>🔍</span>
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: T.textPrimary }}>Live cabin data not yet fetched</div>
        {minPrice != null && Number.isFinite(minPrice) && (
          <div style={{ marginTop: 8, fontSize: 14, color: T.textSlate }}>
            Estimated lead-in price from&nbsp;
            <span style={{ fontWeight: 700, fontFamily: T.fontMono }}>{safeCurrency(minPrice, currency)}</span>
          </div>
        )}
        <div style={{ marginTop: 6, fontSize: 13, color: T.textMuted }}>
          Fetch real-time cabin categories, availability, and deck data from the vendor.
        </div>
      </div>

      {isError && (
        <div style={{ fontSize: 12, color: T.red, background: "#fef2f2", borderRadius: 8, padding: "8px 16px" }}>
          {job.error ?? "Request failed."}{job.retryAfter ? ` Retry in ${fmtSeconds(job.retryAfter)}.` : ""}
        </div>
      )}

      {isRunning ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 13, color: T.textSlate }}>Fetching live data… ~{fmtSeconds(remainingSec)} remaining</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>Est. {fmtSeconds(Math.ceil((job.estimatedMs ?? 180000) / 1000))} total</div>
        </div>
      ) : isCooldown ? (
        <div style={{ fontSize: 13, color: T.textSlate }}>Data fetched — reloading…</div>
      ) : (
        <button
          onClick={onGetDetails}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 32px",
            border: "none", borderRadius: 12,
            background: "linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(79,70,229,0.3)"
          }}
        >
          Get Full Details
        </button>
      )}
    </div>
  );
}

function PricingModal({ row, onClose, onRefreshComplete }) {
  const cabinCategories = useMemo(
    () => (row.cabinCategories || []).map(normalizeCabinCategory),
    [row.cabinCategories]
  );
  const cabinGroups = useMemo(
    () => row.cabinGroups ?? buildCabinGroups(cabinCategories),
    [row.cabinGroups, cabinCategories]
  );

  const isLeadInOnly = cabinGroups.length > 0 && cabinCategories.every(c => c.confidence === "Low");
  const leadInMinPrice = isLeadInOnly
    ? Math.min(...cabinCategories.filter(c => c.cabinPrice != null).map(c => Number(c.cabinPrice)))
    : null;

  const [activeGroup, setActiveGroup] = useState(() => cabinGroups[0]?.group ?? null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedDecks, setExpandedDecks] = useState(new Set());
  // { [code]: { loading, decks: [{deckNumber, deckName, deckImage, cabins}], error } }
  const [cabinCache, setCabinCache] = useState({});
  const [deckImageUrl, setDeckImageUrl] = useState(null);
  // refreshJob: null | { status, estimatedMs, elapsed, remaining, retryAfter, error, count }
  const [refreshJob, setRefreshJob] = useState(null);
  const refreshPollRef = useRef(null);

  const activeData = cabinGroups.find((g) => g.group === activeGroup) ?? null;

  function handleGroupChange(group) {
    setActiveGroup(group);
    setExpandedCategory(null);
    setExpandedDecks(new Set());
  }

  async function handleCategoryClick(cat) {
    const { code } = cat;
    if (expandedCategory === code) {
      setExpandedCategory(null);
      return;
    }
    setExpandedCategory(code);
    setExpandedDecks(new Set());

    // GTY = no cabin list; WTL/non-OK = no cabins available
    if (cat.avlResult === "GTY" || cat.status === "Guarantee") return;
    if (cat.avlResult !== "OK") return;
    // Already cached
    if (cabinCache[code]) return;

    setCabinCache(prev => ({ ...prev, [code]: { loading: true, decks: [] } }));
    try {
      const result = await fetchCategoryDecks(row.id ?? row.code, code);
      const decks = result?.data?.decks ?? [];
      setCabinCache(prev => ({ ...prev, [code]: { loading: false, decks } }));
      if (decks[0]?.deckNumber != null) {
        setExpandedDecks(new Set([String(decks[0].deckNumber)]));
      }
    } catch {
      setCabinCache(prev => ({ ...prev, [code]: { loading: false, decks: [], error: true } }));
    }
  }

  const cruiseCode = row.code ?? row.id;

  function stopPolling() {
    if (refreshPollRef.current) { clearInterval(refreshPollRef.current); refreshPollRef.current = null; }
  }

  async function reloadCategoryDecks(catCode) {
    setCabinCache({});
    if (!catCode) return;
    setCabinCache(prev => ({ ...prev, [catCode]: { loading: true, decks: [] } }));
    try {
      const result = await fetchCategoryDecks(cruiseCode, catCode);
      const decks = result?.data?.decks ?? [];
      setCabinCache(prev => ({ ...prev, [catCode]: { loading: false, decks } }));
      if (decks[0]?.deckNumber != null) setExpandedDecks(new Set([String(decks[0].deckNumber)]));
    } catch {
      setCabinCache(prev => ({ ...prev, [catCode]: { loading: false, decks: [], error: true } }));
    }
  }

  function startPolling(catCode, onComplete = null) {
    stopPolling();
    refreshPollRef.current = setInterval(async () => {
      try {
        const s = await getCruiseRefreshStatus(cruiseCode);
        setRefreshJob(s);
        if (s.status === "cooldown" || s.status === "idle") {
          stopPolling();
          if (s.success) {
            if (catCode) reloadCategoryDecks(catCode);
            if (onComplete) onComplete();
          }
        }
      } catch { /* network hiccup — keep polling */ }
    }, 3000);
  }

  // Check status on modal mount in case a job is already running
  useEffect(() => {
    getCruiseRefreshStatus(cruiseCode).then(s => {
      setRefreshJob(s);
      if (s.status === "in_progress") startPolling(null);
    }).catch(() => {});
    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cruiseCode]);

  async function handleRefresh(catCode) {
    const vendorKey = row.vendor?.slug ?? row.vendorKey ?? row.source;
    if (!vendorKey) { setRefreshJob({ status: "error", error: "Vendor unknown — cannot refresh." }); return; }
    try {
      const result = await refreshCruiseCabins(cruiseCode, vendorKey);
      logActivity("refresh_cabin", { cruiseCode, vendorKey, status: result.status });
      setRefreshJob({ status: result.status, estimatedMs: result.estimatedMs, remaining: result.estimatedMs });
      if (result.status === "started" || result.status === "in_progress") startPolling(catCode);
    } catch (err) {
      const offline = err.message?.toLowerCase().includes("fetch") || err.message?.toLowerCase().includes("network");
      setRefreshJob({ status: "error", error: offline ? "Scraper server is offline." : err.message, retryAfter: err.retryAfter });
    }
  }

  async function handleGetFullDetails() {
    const vendorKey = row.vendor?.slug ?? row.vendorKey ?? row.source;
    if (!vendorKey) { setRefreshJob({ status: "error", error: "Vendor unknown — cannot refresh." }); return; }
    try {
      const result = await refreshCruiseCabins(cruiseCode, vendorKey);
      logActivity("refresh_cabin", { cruiseCode, vendorKey, status: result.status });
      setRefreshJob({ status: result.status, estimatedMs: result.estimatedMs, remaining: result.estimatedMs });
      if (result.status === "started" || result.status === "in_progress") startPolling(null, onRefreshComplete);
    } catch (err) {
      const offline = err.message?.toLowerCase().includes("fetch") || err.message?.toLowerCase().includes("network");
      setRefreshJob({ status: "error", error: offline ? "Scraper server is offline." : err.message, retryAfter: err.retryAfter });
    }
  }

  function toggleDeck(deckKey) {
    setExpandedDecks(prev => {
      const next = new Set(prev);
      next.has(deckKey) ? next.delete(deckKey) : next.add(deckKey);
      return next;
    });
  }

  return (
    <Modal onClose={onClose} width="min(96vw, 680px)">
      {/* Header + tabs */}
      <div style={{ padding: "20px 24px 0", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Cabin Selection</div>
            <h2 style={{ margin: "4px 0 0", fontSize: 19, fontWeight: 700 }}>{row.package}</h2>
            <div style={{ marginTop: 4, fontSize: 12, color: T.textSlate, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontWeight: 500 }}>{row.ship}</span>
              {row.vendor?.name && <span style={{ color: T.textMuted }}>· {row.vendor.name}</span>}
              {row.cruiseLine && <span style={{ color: T.textMuted }}>· {CRUISE_LINE_LABELS[row.cruiseLine] ?? row.cruiseLine}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: T.muted, borderRadius: "50%", width: 34, height: 34, cursor: "pointer", flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
          {cabinGroups.map(({ group, minPrice }) => {
            const isActive = group === activeGroup;
            const tc = typeColor(group);
            return (
              <button
                key={group}
                onClick={() => handleGroupChange(group)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                  padding: "10px 16px", border: "none", cursor: "pointer",
                  borderBottom: isActive ? `2px solid ${tc.color}` : "2px solid transparent",
                  background: isActive ? tc.bg : "transparent",
                  borderRadius: "6px 6px 0 0", minWidth: 84,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: isActive ? tc.color : T.textSlate }}>{group}</span>
                {minPrice != null && (
                  <span style={{ fontSize: 11, fontFamily: T.fontMono, color: isActive ? tc.color : T.textMuted, marginTop: 1 }}>
                    from {safeCurrency(minPrice, row.currency)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Deck plan lightbox */}
      {deckImageUrl !== null && (
        <div
          onClick={() => setDeckImageUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <button
            onClick={() => setDeckImageUrl(null)}
            style={{
              position: "absolute", top: 18, right: 18,
              background: "rgba(255,255,255,0.15)", border: "none",
              borderRadius: "50%", width: 36, height: 36,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={18} color="#fff" />
          </button>
          {deckImageUrl ? (
            <img
              src={deckImageUrl}
              alt="Deck plan"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }}
            />
          ) : (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "#1e293b", borderRadius: 12, padding: "48px 64px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
              }}
            >
              <ImageIcon size={48} color="#475569" />
              <p style={{ color: "#94a3b8", fontSize: 15, margin: 0, fontWeight: 500 }}>No deck image available</p>
              <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>Upload a deck plan via Ship Decks management</p>
            </div>
          )}
        </div>
      )}

      {/* Category + cabin list */}
      <div style={{ overflowY: "auto", maxHeight: "62vh" }}>
        {cabinGroups.length === 0 && (
          <LeadInDetailsPanel
            job={refreshJob}
            minPrice={null}
            currency={row.currency}
            onGetDetails={handleGetFullDetails}
          />
        )}
        {isLeadInOnly && (
          <LeadInDetailsPanel
            job={refreshJob}
            minPrice={leadInMinPrice}
            currency={row.currency}
            onGetDetails={handleGetFullDetails}
          />
        )}
        {!isLeadInOnly && activeData?.categories.map((cat) => {
          const isExpanded = expandedCategory === cat.code;
          const isGTY = cat.avlResult === "GTY" || cat.status === "Guarantee";
          const cache = cabinCache[cat.code];
          // Prefer the real per-cabin count once it's been fetched — the
          // list-level `avail`/`available` field is a summary number from the
          // vendor's search API that's captured before detail-fetch and never
          // reconciled afterward, so it can disagree with the real cabin rows
          // (e.g. showing "1 avail" when 24 real cabins were actually found).
          const hasRealCabinData = (cat.cabins ?? []).length > 0;
          const realCabinCount = (cat.cabins ?? []).length;
          const avail = hasRealCabinData ? realCabinCount : (cat.avail ?? cat.available ?? 0);
          // The vendor's `status` field (e.g. GoHal) can say "Available" even
          // when the real fetched cabin list is empty for that specific
          // sailing — a stale/disconnected summary flag, same class of issue
          // as the avail-count mismatch above. Once real cabin data exists,
          // let the actual count be the source of truth for the pill too.
          const effectiveStatus = hasRealCabinData
            ? (realCabinCount > 0 ? "Available" : "Sold Out")
            : cat.status;

          return (
            <div key={cat.code} style={{ borderBottom: `1px solid ${T.border}` }}>
              {/* Category row */}
              <button
                onClick={() => handleCategoryClick(cat)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 20px", border: "none", background: isExpanded ? T.muted : T.surface,
                  cursor: "pointer", textAlign: "left", gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontFamily: T.fontMono, fontWeight: 700, fontSize: 14, color: T.textPrimary, flexShrink: 0 }}>
                    {cat.code}
                  </span>
                  <span style={{ fontSize: 13, color: T.textSlate, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat.name ?? cat.description}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {cat.perPersonPrice != null && (
                    <span style={{ fontFamily: T.fontMono, fontWeight: 700, fontSize: 13, color: T.textPrimary }}>
                      {safeCurrency(cat.perPersonPrice, row.currency)}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: T.textMuted }}>{avail} avail</span>
                  <StatusPill status={effectiveStatus} />
                  {isExpanded ? <ChevronUp size={15} color={T.textSlate} /> : <ChevronDown size={15} color={T.textSlate} />}
                </div>
              </button>

              {/* Expanded: deck list */}
              {isExpanded && (
                <div style={{ background: "#f8fafc", borderTop: `1px solid ${T.border}` }}>
                  {isGTY ? (
                    <div style={{ padding: "14px 24px", fontSize: 13, color: T.textSlate, fontStyle: "italic" }}>
                      Guarantee — specific cabin assigned at time of sailing.
                    </div>
                  ) : cat.avlResult !== "OK" ? (
                    <div style={{ padding: "14px 24px", fontSize: 13, color: T.textMuted, fontStyle: "italic" }}>
                      Waitlist — no cabins currently available for selection.
                    </div>
                  ) : cache?.loading ? (
                    <div style={{ padding: "14px 24px", fontSize: 13, color: T.textMuted }}>Loading cabins…</div>
                  ) : cache?.error ? (
                    <div style={{ padding: "14px 24px", fontSize: 13, color: T.red }}>Failed to load cabin data.</div>
                  ) : !cache || cache.decks.length === 0 ? (
                    <RefreshBanner
                      job={refreshJob}
                      onRefresh={() => handleRefresh(cat.code)}
                    />
                  ) : (
                    <>
                      {cache.decks.map((deck) => {
                        const deckKey = String(deck.deckNumber ?? deck.deckName);
                        const isDeckOpen = expandedDecks.has(deckKey);
                        return (
                          <div key={deckKey} style={{ borderBottom: `1px solid ${T.border}` }}>
                            {/* Deck header */}
                            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                              <button
                                onClick={() => toggleDeck(deckKey)}
                                style={{
                                  flex: 1, display: "flex", alignItems: "center", gap: 8,
                                  padding: "10px 24px", border: "none", background: "transparent",
                                  cursor: "pointer", textAlign: "left",
                                }}
                              >
                                {isDeckOpen
                                  ? <ChevronDown size={13} color={T.textSlate} />
                                  : <ChevronRight size={13} color={T.textSlate} />}
                                <span style={{ fontWeight: 700, fontSize: 13, color: T.textPrimary }}>{deck.deckName}</span>
                                <span style={{ fontSize: 12, color: T.textMuted }}>({deck.cabins.length} cabin{deck.cabins.length !== 1 ? "s" : ""})</span>
                              </button>
                              <button
                                onClick={() => setDeckImageUrl(deck.deckImage || "")}
                                title={deck.deckImage ? "View deck plan" : "No deck image uploaded"}
                                style={{
                                  display: "flex", alignItems: "center", gap: 4,
                                  padding: "6px 14px", marginRight: 8,
                                  border: `1px solid ${T.border}`, borderRadius: 6,
                                  background: T.surface, cursor: "pointer",
                                  fontSize: 11,
                                  color: deck.deckImage ? T.textSlate : T.textMuted,
                                  opacity: deck.deckImage ? 1 : 0.6,
                                }}
                              >
                                <ImageIcon size={12} />
                                <span>Deck Plan</span>
                              </button>
                            </div>

                            {/* Cabin rows */}
                            {isDeckOpen && (
                              <div style={{ paddingBottom: 6 }}>
                                {deck.cabins.map((cabin) => (
                                  <div
                                    key={cabin.cabinNumber}
                                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "7px 40px", borderTop: `1px solid ${T.border}` }}
                                  >
                                    <span style={{ fontFamily: T.fontMono, fontWeight: 700, fontSize: 13, color: T.textPrimary, minWidth: 48 }}>
                                      {cabin.cabinNumber}
                                    </span>
                                    <span style={{ fontSize: 12, color: T.textSlate }}>
                                      {cabin.capacity ? `${cabin.capacity} pax` : "—"}
                                    </span>
                                    <StatusPill status={cabin.status} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <DataRefreshStrip
                        job={refreshJob}
                        row={row}
                        onRefresh={() => handleRefresh(cat.code)}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function TagManagementModal({
  row,
  assigneeOptions,
  saving,
  onClose,
  onCreate,
  onUpdate,
  onDelete
}) {
  const defaultColor = "#2563eb";
  const [editingTagId, setEditingTagId] = useState(null);
  const [form, setForm] = useState({
    label: "Employee Booking",
    assignedTo: "",
    note: "",
    color: defaultColor
  });
  const tags = row.tags || [];

  const resetForm = () => {
    setEditingTagId(null);
    setForm({
      label: "Employee Booking",
      assignedTo: "",
      note: "",
      color: defaultColor
    });
  };

  const startEdit = (tagItem) => {
    setEditingTagId(tagItem.id);
    setForm({
      label: tagItem.label || "",
      assignedTo: tagItem.assignedTo || "",
      note: tagItem.note || "",
      color: tagItem.color || defaultColor
    });
  };

  const submit = async () => {
    if (!form.label.trim()) {
      return;
    }

    const payload = {
      label: form.label.trim(),
      assignedTo: form.assignedTo.trim(),
      note: form.note.trim(),
      color: form.color
    };

    if (editingTagId) {
      await onUpdate(editingTagId, payload);
    } else {
      await onCreate(payload);
    }

    resetForm();
  };

  return (
    <Modal onClose={onClose} width="min(96vw, 860px)">
      <div style={{ padding: 24, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Cruise Tags</div>
          <h2 style={{ margin: "6px 0 0", fontSize: 22 }}>{row.package}</h2>
          <div style={{ marginTop: 6, fontSize: 12, color: T.textMuted }}>{getCruiseDisplayId(row)} · {getCruiseRouteLabel(row)}</div>
        </div>
        <button onClick={onClose} style={{ border: "none", background: T.muted, borderRadius: "50%", width: 36, height: 36, cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>Saved tags</div>
          {tags.length === 0 ? (
            <div style={{ border: `1px dashed ${T.border}`, borderRadius: 14, padding: 24, color: T.textMuted, textAlign: "center" }}>
              No tags yet for this cruise.
            </div>
          ) : (
            tags.map((tagItem) => (
              <div key={tagItem.id} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${tagItem.color || defaultColor}15`, color: tagItem.color || defaultColor, borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
                        <Tag size={12} />
                        {tagItem.label}
                      </span>
                      {tagItem.assignedTo ? (
                        <span style={{ fontSize: 11, color: T.textSlate, background: T.muted, borderRadius: 999, padding: "4px 10px" }}>
                          {tagItem.assignedTo}
                        </span>
                      ) : null}
                    </div>
                    {tagItem.note ? (
                      <div style={{ color: T.textSlate, fontSize: 13 }}>{tagItem.note}</div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startEdit(tagItem)} style={{ border: `1px solid ${T.border}`, background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>
                      Edit
                    </button>
                    <button onClick={() => onDelete(tagItem.id)} disabled={saving} style={{ border: "none", background: "#fee2e2", color: "#b91c1c", borderRadius: 10, padding: "6px 10px", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, background: T.muted, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
              {editingTagId ? "Edit tag" : "Add tag"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: T.textMuted }}>
              Use this to mark cruises that will be booked by your team.
            </div>
          </div>

          <input
            value={form.label}
            onChange={(event) => setForm(current => ({ ...current, label: event.target.value }))}
            placeholder="Tag label"
            style={{ width: "100%", height: 38, borderRadius: 10, border: `1px solid ${T.border}`, padding: "8px 12px" }}
          />

          <select
            value={form.assignedTo}
            onChange={(event) => setForm(current => ({ ...current, assignedTo: event.target.value }))}
            style={{ width: "100%", height: 38, borderRadius: 10, border: `1px solid ${T.border}`, padding: "8px 12px" }}
          >
            <option value="">Assigned to</option>
            {assigneeOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <input
            type="color"
            value={form.color}
            onChange={(event) => setForm(current => ({ ...current, color: event.target.value }))}
            style={{ width: 72, height: 42, borderRadius: 10, border: `1px solid ${T.border}`, background: "#fff", cursor: "pointer" }}
          />

          <textarea
            value={form.note}
            onChange={(event) => setForm(current => ({ ...current, note: event.target.value }))}
            placeholder="Optional note"
            rows={4}
            style={{ width: "100%", borderRadius: 12, border: `1px solid ${T.border}`, padding: "12px", resize: "vertical" }}
          />

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            {editingTagId ? (
              <button onClick={resetForm} disabled={saving} style={{ border: `1px solid ${T.border}`, background: "#fff", borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>
                Cancel
              </button>
            ) : null}
            <button
              onClick={submit}
              disabled={saving || !form.label.trim()}
              style={{ border: "none", background: T.textPrimary, color: "#fff", borderRadius: 10, padding: "8px 14px", cursor: "pointer", opacity: saving || !form.label.trim() ? 0.6 : 1 }}
            >
              {saving ? "Saving..." : editingTagId ? "Update tag" : "Add tag"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function CruiseSearchPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [shipRow, setShipRow] = useState(null);
  const [pricingRow, setPricingRow] = useState(null);
  const [itineraryRow, setItineraryRow] = useState(null);
  const [tagRow, setTagRow] = useState(null);
  const [tagDirectory, setTagDirectory] = useState({ assignees: [] });
  const [lookupOptions, setLookupOptions] = useState({
    vendors: [],    // [{ id, name }]
    allShips: [],   // [{ name, vendorId }]
    users: []
  });
  const [savingTag, setSavingTag] = useState(false);
  const [filters, setFilters] = useState({
    code: "",
    vendor: "",
    ship: "",
    cruiseLine: "",
    startDate: "",
    endDate: "",
    nights: "",
    route: "",
    portFrom: "",
    portTo: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    code: "",
    vendor: "",
    ship: "",
    cruiseLine: "",
    startDate: "",
    endDate: "",
    nights: "",
    route: "",
    portFrom: "",
    portTo: "",
  });
  const [datePreset, setDatePreset] = useState("All");

  const applyDatePreset = (preset) => {
    setDatePreset(preset.label);
    if (preset.days == null) {
      setF("startDate", "");
      setF("endDate", "");
      return;
    }
    const today = new Date();
    const end = new Date(today.getTime() + preset.days * 86400000);
    const toInputDate = (d) => d.toISOString().slice(0, 10);
    setF("startDate", toInputDate(today));
    setF("endDate", toInputDate(end));
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetchCruises({
          page,
          limit: PAGE_SIZE,
          detail: "full",
          search: appliedFilters.code || undefined,
          vendorName: appliedFilters.vendor || undefined,
          ship: appliedFilters.ship || undefined,
          cruiseLine: appliedFilters.cruiseLine || undefined,
          nights: appliedFilters.nights || undefined,
          route: appliedFilters.route || undefined,
          portFrom: appliedFilters.portFrom || undefined,
          portTo: appliedFilters.portTo || undefined,
          startDateFrom: appliedFilters.startDate || undefined,
          startDateTo: appliedFilters.endDate || undefined,
        });

        if (!active) {
          return;
        }

        setData((response.data || []).map((item) => ({ ...item, pinned: Boolean(item.pinned) })));
        setPagination(response.pagination || null);
        logActivity("search_cruise", { page, vendor: appliedFilters.vendor || null, ship: appliedFilters.ship || null, nights: appliedFilters.nights || null, resultCount: response.data?.length ?? 0 });
      } catch (err) {
        if (!active) {
          return;
        }

        setError(err.message || "Failed to load cruises");
        setData([]);
        setPagination(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [appliedFilters, page]);

  useEffect(() => {
    let active = true;

    const loadLookups = async () => {
      try {
        const [tagResponse, vendorResponse, shipResponse, userResponse] = await Promise.all([
          fetchCruiseTags(),
          fetchVendors({ limit: 100 }),
          fetchShips({ limit: 300 }),
          fetchUsers()
        ]);

        if (!active) {
          return;
        }

        setTagDirectory({
          assignees: userResponse.data?.map((user) => user.name).filter(Boolean) || tagResponse.data?.assignees || []
        });

        setLookupOptions({
          vendors: (vendorResponse.data || []).map((v) => ({ id: v.id, name: v.name })).filter((v) => v.name),
          allShips: (shipResponse.data || []).map((s) => ({ name: s.name, vendorId: s.vendorId })).filter((s) => s.name),
          users: userResponse.data?.map((user) => user.name).filter(Boolean) || []
        });
      } catch (err) {
        if (active) {
          console.error(err);
        }
      }
    };

    loadLookups();

    return () => {
      active = false;
    };
  }, []);

  // Ship.vendorId can be stale/null for ships ingested before vendor-linking
  // existed, so the client-side filter over a one-time ship list can miss
  // ships for some vendors. Re-fetch from the server (filtered by vendorId,
  // which now also matches via each ship's actual cruises) whenever the
  // vendor filter changes, instead of trusting the cached allShips list.
  const [vendorShips, setVendorShips] = useState(null); // null = no vendor selected

  useEffect(() => {
    let active = true;
    const selectedVendor = lookupOptions.vendors.find((v) => v.name === filters.vendor);
    if (!selectedVendor) {
      setVendorShips(null);
      return () => { active = false; };
    }
    fetchShips({ vendorId: selectedVendor.id, limit: 300 })
      .then((res) => {
        if (!active) return;
        setVendorShips((res.data || []).map((s) => s.name).filter(Boolean));
      })
      .catch((err) => {
        if (active) console.error(err);
      });
    return () => { active = false; };
  }, [filters.vendor, lookupOptions.vendors]);

  const opts = useMemo(() => {
    const vendorNames = lookupOptions.vendors.map((v) => v.name);
    const ships = vendorShips ?? lookupOptions.allShips.map((s) => s.name);
    return {
      vendors: vendorNames,
      ships,
      cruiseLines: [...new Set(data.map((item) => item.cruiseLine).filter(Boolean))],
      nights: [...new Set(data.map((item) => item.nights).filter(Boolean))].sort((a, b) => a - b),
      routes: [...new Set(data.map((item) => getCruiseRouteLabel(item)).filter(Boolean))],
      ports: [...new Set([...data.map((item) => item.portFrom), ...data.map((item) => item.portTo)].filter(Boolean))],
    };
  }, [data, lookupOptions, vendorShips]);

  const rows = useMemo(
    () => [...data].sort((a, b) => (b.tags?.length || 0) - (a.tags?.length || 0)),
    [data],
  );

  const setF = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const reset = () => {
    const empty = { code: "", vendor: "", ship: "", cruiseLine: "", startDate: "", endDate: "", nights: "", route: "", portFrom: "", portTo: "" };
    setFilters(empty);
    setAppliedFilters(empty);
    setDatePreset("All");
    setPage(1);
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    setPage(1);
  };

  const replaceCruiseInState = (updatedCruise) => {
    if (!updatedCruise) {
      return;
    }

    setData((current) =>
      current.map((row) => (row.id === updatedCruise.id ? { ...updatedCruise } : row))
    );
    setTagRow((current) => (current?.id === updatedCruise.id ? updatedCruise : current));
    setPricingRow((current) => (current?.id === updatedCruise.id ? updatedCruise : current));
    setShipRow((current) => (current?.id === updatedCruise.id ? updatedCruise : current));
  };

  const refreshTagDirectory = async () => {
      try {
        const response = await fetchCruiseTags();
        setTagDirectory({
          assignees: lookupOptions.users.length > 0 ? lookupOptions.users : response.data?.assignees || []
        });
      } catch (err) {
        console.error(err);
      }
    };

  const handleCreateTag = async (payload) => {
    if (!tagRow) {
      return;
    }

    try {
      setSavingTag(true);
      const response = await createCruiseTag(tagRow.id, payload);
      replaceCruiseInState(response.data);
      await refreshTagDirectory();
    } finally {
      setSavingTag(false);
    }
  };

  const handleUpdateTag = async (tagId, payload) => {
    if (!tagRow) {
      return;
    }

    try {
      setSavingTag(true);
      const response = await updateCruiseTag(tagRow.id, tagId, payload);
      replaceCruiseInState(response.data);
      await refreshTagDirectory();
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!tagRow) {
      return;
    }

    try {
      setSavingTag(true);
      const response = await deleteCruiseTag(tagRow.id, tagId);
      replaceCruiseInState(response.data);
      await refreshTagDirectory();
    } finally {
      setSavingTag(false);
    }
  };

  const togglePin = (id) => {
    const row = data.find((item) => item.id === id);

    if (row) {
      setTagRow(row);
    }
  };

  async function handlePricingRefreshComplete() {
    if (!pricingRow) return;
    try {
      const code = pricingRow.code ?? pricingRow.id;
      const updated = await fetchCruise(code);
      if (updated) replaceCruiseInState(updated);
    } catch { /* silent — modal still shows */ }
  }

  const overview = useMemo(() => {
    const cruises = pagination?.total ?? rows.length;
    const ships = new Set(rows.map((row) => row.shipCode || row.ship).filter(Boolean)).size;
    return { cruises, ships };
  }, [pagination, rows]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)`, padding: "28px 32px", fontFamily: T.fontBase }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: T.textMuted, textTransform: "uppercase" }}>
            Inventory Manager
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 800, color: T.textPrimary }}>Cruise Search</h1>
          <div style={{ marginTop: 8, fontSize: 14, color: T.textSlate, maxWidth: 760 }}>
            Paginated cruise inventory from the database with ship drilldown and cabin pricing breakdown.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
          {[
            ["Cruises", overview.cruises, T.textPrimary],
            ["Ships", overview.ships, T.blue],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.82)", border: `1px solid ${T.border}`, borderRadius: 18, padding: "16px 18px", boxShadow: T.shadowCard, backdropFilter: "blur(6px)" }}>
              <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color, fontFamily: T.fontMono }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 20, border: `1px solid ${T.border}`, padding: 20, boxShadow: T.shadowCard, backdropFilter: "blur(8px)" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Cruise Code</div>
            <input
              type="text"
              placeholder="Search by cruise code, ship, package or route (e.g. CJ07260801)"
              value={filters.code}
              onChange={(event) => setF("code", event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }}
              style={{ width: "100%", height: 38, borderRadius: 8, border: `1px solid ${T.border}`, padding: "8px 12px" }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Vendor</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={() => { setF("vendor", ""); setF("ship", ""); }}
                style={{
                  height: 34, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${filters.vendor === "" ? T.blue : T.border}`,
                  background: filters.vendor === "" ? T.blueBg : "#fff",
                  color: filters.vendor === "" ? T.blue : T.textSlate,
                }}
              >
                All
              </button>
              {opts.vendors.map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => { setF("vendor", value); setF("ship", ""); }}
                  style={{
                    height: 34, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${filters.vendor === value ? T.blue : T.border}`,
                    background: filters.vendor === value ? T.blueBg : "#fff",
                    color: filters.vendor === value ? T.blue : T.textSlate,
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {[
              { key: "ship", ph: "Ship", mode: "input", values: opts.ships },
              { key: "cruiseLine", ph: "Cruise Line", mode: "select", values: opts.cruiseLines },
              { key: "portFrom", ph: "From", mode: "select", values: opts.ports },
              { key: "portTo", ph: "To", mode: "select", values: opts.ports },
            ].map((field) =>
              field.mode === "input" ? (
                <SearchableSelect
                  key={field.key}
                  placeholder={field.ph}
                  value={filters[field.key]}
                  onChange={(value) => setF(field.key, value)}
                  options={field.values}
                />
              ) : (
                <select
                  key={field.key}
                  style={{ width: "100%", height: 38, borderRadius: 8, border: `1px solid ${T.border}`, padding: "8px 12px" }}
                  value={filters[field.key]}
                  onChange={(event) => setF(field.key, event.target.value)}
                >
                  <option value="">{field.ph}</option>
                  {field.values.map((value) => (
                    <option key={value} value={value}>
                      {field.key === "cruiseLine" ? (CRUISE_LINE_LABELS[value] ?? value) : value}
                    </option>
                  ))}
                </select>
              ),
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Departure window</div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {[
                { label: "All", days: null },
                { label: "Next 7 Days", days: 7 },
                { label: "Next 30 Days", days: 30 },
                { label: "Next 3 Months", days: 90 },
                { label: "Next 6 Months", days: 182 },
                { label: "Next 1 Year", days: 365 },
                { label: "Next 2 Years", days: 730 },
              ].map((preset) => {
                const isActive = datePreset === preset.label;
                return (
                  <button
                    type="button"
                    key={preset.label}
                    onClick={() => applyDatePreset(preset)}
                    style={{
                      height: 34, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${isActive ? T.blue : T.border}`,
                      background: isActive ? T.blueBg : "#fff",
                      color: isActive ? T.blue : T.textSlate,
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
                <input
                  type="date"
                  style={{ height: 34, borderRadius: 8, border: `1px solid ${T.border}`, padding: "0 10px" }}
                  value={filters.startDate}
                  onChange={(event) => { setF("startDate", event.target.value); setDatePreset(null); }}
                />
                <span style={{ color: T.textMuted, fontSize: 12 }}>to</span>
                <input
                  type="date"
                  style={{ height: 34, borderRadius: 8, border: `1px solid ${T.border}`, padding: "0 10px" }}
                  value={filters.endDate}
                  onChange={(event) => { setF("endDate", event.target.value); setDatePreset(null); }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={applyFilters} style={{ height: 38, padding: "0 24px", border: "none", borderRadius: 8, background: T.textPrimary, color: "#fff", cursor: "pointer", fontWeight: 600 }}>
              Search
            </button>
            <button onClick={reset} style={{ height: 38, padding: "0 24px", border: "none", borderRadius: 8, background: T.muted, cursor: "pointer", fontWeight: 600 }}>
              Reset
            </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", margin: "12px 0", color: T.textMuted, fontSize: 12 }}>
          <div>{loading ? "Loading sailings..." : `${pagination?.total ?? rows.length} results`}</div>
          <div>Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1}</div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 20, border: `1px solid ${T.border}`, boxShadow: T.shadowCard, overflow: "hidden", backdropFilter: "blur(8px)" }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: T.textMuted }}>Loading cruises from database...</div>
          ) : error ? (
            <div style={{ padding: 60, textAlign: "center", color: T.red }}>{error}</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: T.textMuted }}>No cruises found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                <thead style={{ background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)" }}>
                  <tr>
                    {["", "Vendor", "Ship", "Cruise", "Nights", "Route", "Departure", "Arrival", "Avail.", "Refreshed", "Price"].map((header) => (
                      <th key={header} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: T.textSlate }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const lowestPrice = Math.min(...(row.cabinCategories || []).filter((cabin) => cabin.avlResult === "OK").map((cabin) => Number(cabin.cabinPrice ?? 0)));
                    const hasFullDetails = (row.cabinCategories || []).some(
                      c => c.confidence === "Medium" || c.confidence === "High"
                    );
                    const isTagged = (row.tags?.length || 0) > 0;
                    const canTag = hasFullDetails || isTagged;

                    return (
                      <tr key={row.id} style={{ background: isTagged ? "#fffbeb" : index % 2 === 0 ? "#fff" : T.muted }}>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                          <button
                            onClick={() => canTag ? togglePin(row.id) : null}
                            style={{
                              border: "none", background: "none",
                              cursor: canTag ? "pointer" : "not-allowed",
                              color: isTagged ? "#d97706" : canTag ? T.textSlate : T.textMuted,
                              opacity: canTag ? 1 : 0.35,
                              fontSize: 0
                            }}
                            title={
                              isTagged ? "Manage tags"
                              : canTag ? "Add tag"
                              : "Get Full Details first before tagging"
                            }
                          >
                            <Pin size={16} />
                            📌
                          </button>
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                          <div>{row.vendor?.name}</div>
                          {row.cruiseLine && (
                            <div style={{ marginTop: 3, fontSize: 11, color: T.textMuted, fontFamily: T.fontMono }}>
                              {CRUISE_LINE_LABELS[row.cruiseLine] ?? row.cruiseLine}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                          <button onClick={() => setShipRow(row)} style={{ border: "none", background: T.blueBg, color: T.blue, borderRadius: 8, padding: "4px 12px", cursor: "pointer" }}>
                            {row.ship}
                          </button>
                          <div style={{ marginTop: 6, fontSize: 11, color: T.textMuted, fontFamily: T.fontMono }}>
                            {getCruiseDisplayId(row)}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>{row.package}</td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>{row.nights}N</td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                          <button
                            onClick={() => setItineraryRow(row)}
                            style={{ border: "none", background: "none", cursor: "pointer", color: T.blue, fontWeight: 600, fontSize: 13, padding: 0, textAlign: "left", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
                          >
                            {getCruiseRouteLabel(row)}
                          </button>
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>{fmtDate(row.startDate)}</td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>{fmtDate(row.endDate)}</td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                          {row.cabinCategories?.filter(c => c.avlResult === "OK").length ?? 0} avail. cat.
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.textMuted, whiteSpace: "nowrap" }}>
                          {(() => {
                            // Prefer cabin-freshness; fall back to the row's own
                            // last-write so list-only cruises aren't stuck on "—".
                            const ts = row.cabinsUpdatedAt ?? row.updatedAt ?? row.createdAt;
                            return ts ? fmtFetchedAt(new Date(ts).getTime()) : "—";
                          })()}
                        </td>
                        <td style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                          <button
                            onClick={() => setPricingRow(row)}
                            style={{
                              border: "none",
                              background: Number.isFinite(lowestPrice) ? "linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)" : T.amberBg,
                              color: Number.isFinite(lowestPrice) ? "#fff" : T.amberDk,
                              borderRadius: 12,
                              padding: "6px 12px",
                              cursor: "pointer",
                            }}
                          >
                            {Number.isFinite(lowestPrice) ? safeCurrency(lowestPrice, row.currency) : "WTL"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setPage(1)}
              disabled={!pagination?.hasPreviousPage || loading}
              style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", background: "#fff", cursor: pagination?.hasPreviousPage ? "pointer" : "not-allowed", opacity: pagination?.hasPreviousPage ? 1 : 0.5 }}
            >
              First
            </button>
            {getVisiblePages(pagination?.page ?? 1, pagination?.totalPages ?? 1).map((pageNumber, index, pages) => {
              const previousPage = pages[index - 1];
              const showGap = previousPage && pageNumber - previousPage > 1;

              return (
                <div key={pageNumber} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {showGap ? <span style={{ color: T.textMuted }}>...</span> : null}
                  <button
                    onClick={() => setPage(pageNumber)}
                    disabled={loading}
                    style={{
                      border: `1px solid ${pageNumber === (pagination?.page ?? 1) ? T.blue : T.border}`,
                      borderRadius: 10,
                      padding: "8px 14px",
                      background: pageNumber === (pagination?.page ?? 1) ? T.blueBg : "#fff",
                      color: pageNumber === (pagination?.page ?? 1) ? T.blue : T.textPrimary,
                      cursor: loading ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {pageNumber}
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => setPage(pagination?.totalPages ?? 1)}
              disabled={!pagination?.hasNextPage || loading}
              style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", background: "#fff", cursor: pagination?.hasNextPage ? "pointer" : "not-allowed", opacity: pagination?.hasNextPage ? 1 : 0.5 }}
            >
              Last
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={!pagination?.hasPreviousPage || loading}
            style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", background: "#fff", cursor: pagination?.hasPreviousPage ? "pointer" : "not-allowed", opacity: pagination?.hasPreviousPage ? 1 : 0.5 }}
          >
            Previous
          </button>
          <button
            onClick={() => setPage((current) => current + 1)}
            disabled={!pagination?.hasNextPage || loading}
            style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", background: "#fff", cursor: pagination?.hasNextPage ? "pointer" : "not-allowed", opacity: pagination?.hasNextPage ? 1 : 0.5 }}
          >
            Next
          </button>
          </div>
        </div>
      </div>

      {shipRow && <ShipModal row={shipRow} onClose={() => setShipRow(null)} />}
      {itineraryRow && <ItineraryModal row={itineraryRow} onClose={() => setItineraryRow(null)} />}
      {pricingRow && <PricingModal row={pricingRow} onClose={() => setPricingRow(null)} onRefreshComplete={handlePricingRefreshComplete} />}
      {tagRow && (
        <TagManagementModal
          row={tagRow}
          assigneeOptions={tagDirectory.assignees}
          saving={savingTag}
          onClose={() => setTagRow(null)}
          onCreate={handleCreateTag}
          onUpdate={handleUpdateTag}
          onDelete={handleDeleteTag}
        />
      )}
    </>
  );
}
