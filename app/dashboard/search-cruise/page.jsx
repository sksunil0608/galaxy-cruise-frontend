"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, ChevronUp, ChevronLeft, ChevronsLeft, ChevronsRight, Pin, Minus, Tag, TrendingDown, TrendingUp, X, ImageIcon, Search, RotateCcw, RefreshCw, Compass, Sparkles, AlertCircle, Ship, MapPin, CalendarDays, Layers } from "lucide-react";

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

const VENDOR_COLOR_STYLES = {
  "MSC Cruises": {
    badge: "bg-blue-50 text-blue-800 border-blue-200/80",
    pillActive: "bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-md shadow-blue-700/25 border-blue-700",
    pillHover: "hover:bg-blue-50 hover:text-blue-900 hover:border-blue-300",
    dot: "bg-blue-600"
  },
  "Holland America (gohal)": {
    badge: "bg-amber-50 text-amber-900 border-amber-200/80",
    pillActive: "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-md shadow-amber-600/25 border-amber-600",
    pillHover: "hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300",
    dot: "bg-amber-600"
  },
  "Celestyal": {
    badge: "bg-cyan-50 text-cyan-900 border-cyan-200/80",
    pillActive: "bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-700 text-white shadow-md shadow-cyan-600/25 border-cyan-600",
    pillHover: "hover:bg-cyan-50 hover:text-cyan-900 hover:border-cyan-300",
    dot: "bg-cyan-600"
  },
  "Complete Cruise Solution B": {
    badge: "bg-emerald-50 text-emerald-900 border-emerald-200/80",
    pillActive: "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-md shadow-emerald-600/25 border-emerald-600",
    pillHover: "hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-300",
    dot: "bg-emerald-600"
  },
  "Complete Cruise Solution A": {
    badge: "bg-teal-50 text-teal-900 border-teal-200/80",
    pillActive: "bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 text-white shadow-md shadow-teal-600/25 border-teal-600",
    pillHover: "hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300",
    dot: "bg-teal-600"
  },
  "FirstMates": {
    badge: "bg-purple-50 text-purple-900 border-purple-200/80",
    pillActive: "bg-gradient-to-r from-purple-600 via-violet-600 to-purple-700 text-white shadow-md shadow-purple-600/25 border-purple-600",
    pillHover: "hover:bg-purple-50 hover:text-purple-900 hover:border-purple-300",
    dot: "bg-purple-600"
  },
  "Azamara": {
    badge: "bg-rose-50 text-rose-900 border-rose-200/80",
    pillActive: "bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 text-white shadow-md shadow-rose-600/25 border-rose-600",
    pillHover: "hover:bg-rose-50 hover:text-rose-900 hover:border-rose-300",
    dot: "bg-rose-600"
  },
  "CruisingPower": {
    badge: "bg-sky-50 text-sky-900 border-sky-200/80",
    pillActive: "bg-gradient-to-r from-sky-600 via-blue-600 to-sky-700 text-white shadow-md shadow-sky-600/25 border-sky-600",
    pillHover: "hover:bg-sky-50 hover:text-sky-900 hover:border-sky-300",
    dot: "bg-sky-600"
  },
  "GOCCL": {
    badge: "bg-indigo-50 text-indigo-900 border-indigo-200/80",
    pillActive: "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 border-indigo-600",
    pillHover: "hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-300",
    dot: "bg-indigo-600"
  },
  "Seawebagents": {
    badge: "bg-teal-50 text-teal-900 border-teal-200/80",
    pillActive: "bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 text-white shadow-md shadow-teal-700/25 border-teal-700",
    pillHover: "hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300",
    dot: "bg-teal-600"
  }
};

const getVendorStyle = (vendorName) => {
  return VENDOR_COLOR_STYLES[vendorName] || {
    badge: "bg-slate-100 text-slate-800 border-slate-200/80",
    pillActive: "bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 text-white shadow-md shadow-teal-600/25 border-teal-600",
    pillHover: "hover:bg-teal-50/70 hover:text-teal-900 hover:border-teal-300",
    dot: "bg-teal-600"
  };
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
  fontBase: "'Inter', var(--font-inter), sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
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

  const uniqueOptions = useMemo(() => [...new Set(options || [])].filter(Boolean), [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return uniqueOptions;
    return uniqueOptions.filter((opt) => opt.toLowerCase().includes(q));
  }, [uniqueOptions, query]);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          className="w-full h-9.5 rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition shadow-2xs"
          placeholder={placeholder}
          value={open ? query : value || ""}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(event) => setQuery(event.target.value)}
        />
        {value && !open ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
            title="Clear selection"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
      </div>
      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-40 max-h-64 overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-lg py-1">
          <div
            onMouseDown={(event) => { event.preventDefault(); onChange(""); setOpen(false); setQuery(""); }}
            className="px-3.5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 cursor-pointer border-b border-slate-100"
          >
            {placeholder} (All)
          </div>
          {filtered.length === 0 && (
            <div className="px-3.5 py-3 text-xs text-slate-400">No matches found</div>
          )}
          {filtered.map((opt, idx) => (
            <div
              key={`${opt}-${idx}`}
              onMouseDown={(event) => { event.preventDefault(); onChange(opt); setOpen(false); setQuery(""); }}
              className={`px-3.5 py-2 text-xs cursor-pointer transition ${
                opt === value
                  ? "bg-emerald-50 text-emerald-700 font-bold"
                  : "text-slate-800 hover:bg-slate-50 font-medium"
              }`}
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
        style={{ width, maxHeight: "94vh", overflowY: "auto", background: T.surface, borderRadius: 12, boxShadow: T.shadowModal }}
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
        <button onClick={onClose} style={{ border: "none", background: T.muted, borderRadius: 6, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ padding: "18px 24px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              borderRadius: 6,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 600,
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
        <button onClick={onClose} style={{ border: "none", background: T.muted, borderRadius: 6, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <X size={15} />
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowY: "auto", maxHeight: "65vh" }}>
        {stops.length === 0 ? (
          <div className="py-12 px-6 text-center text-slate-500">
            <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
              <Compass size={20} />
            </div>
            <div className="font-bold text-slate-800 text-sm">Detailed itinerary not yet loaded</div>
            <div className="text-xs mt-1.5 text-slate-400">Port-by-port data will appear here once fetched from the carrier.</div>
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
    <div className="py-12 px-8 flex flex-col items-center gap-5 text-center">
      <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
        <Search size={22} strokeWidth={2.2} />
      </div>
      <div>
        <div className="font-bold text-base text-slate-900">Live cabin data not yet fetched</div>
        {minPrice != null && Number.isFinite(minPrice) && (
          <div className="mt-2 text-sm text-slate-600">
            Estimated lead-in price from&nbsp;
            <span className="font-bold font-mono text-slate-900">{safeCurrency(minPrice, currency)}</span>
          </div>
        )}
        <div className="mt-1.5 text-xs text-slate-500 max-w-sm">
          Fetch real-time cabin categories, availability, and deck data from the vendor.
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg px-3.5 py-2 max-w-md">
          <AlertCircle size={14} className="shrink-0 text-rose-600" />
          <span>{job?.error ?? "Request failed."}{job?.retryAfter ? ` Retry in ${fmtSeconds(job.retryAfter)}.` : ""}</span>
        </div>
      )}

      {isRunning ? (
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-xs font-medium text-slate-600">Fetching live data… ~{fmtSeconds(remainingSec)} remaining</div>
          <div className="text-[11px] text-slate-400 font-mono">Est. {fmtSeconds(Math.ceil((job.estimatedMs ?? 180000) / 1000))} total</div>
        </div>
      ) : isCooldown ? (
        <div className="text-xs font-medium text-slate-600">Data fetched — reloading…</div>
      ) : (
        <button
          onClick={onGetDetails}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-xs transition-all cursor-pointer active:scale-[0.98]"
        >
          <Sparkles size={15} />
          <span>Get Full Details</span>
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
        if (s.status === "cooldown" || s.status === "idle" || s.status === "offline" || s.status === "error") {
          stopPolling();
          if (s.success) {
            if (catCode) reloadCategoryDecks(catCode);
            if (onComplete) onComplete();
          }
        }
      } catch {
        stopPolling();
      }
    }, 3000);
  }

  // Check status on modal mount only if lead-in or checking active job
  useEffect(() => {
    if (isLeadInOnly) {
      getCruiseRefreshStatus(cruiseCode).then(s => {
        if (s && s.status !== "offline") {
          setRefreshJob(s);
          if (s.status === "in_progress") startPolling(null);
        }
      }).catch(() => {});
    }
    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cruiseCode, isLeadInOnly]);

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
          <button onClick={onClose} style={{ border: "none", background: T.muted, borderRadius: 6, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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

          const categoryPrice = [
            cat.cabinPrice,
            cat.price,
            cat.perPersonPrice,
            cat.totalPrice,
            cat.minPrice,
            activeData?.minPrice
          ].find(p => p != null && Number.isFinite(Number(p)) && Number(p) > 0);

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
                  {categoryPrice != null && Number(categoryPrice) > 0 && (
                    <span style={{ fontFamily: T.fontMono, fontWeight: 700, fontSize: 13, color: T.textPrimary }}>
                      {safeCurrency(categoryPrice, row.currency)}
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
    const vendorNames = [...new Set(lookupOptions.vendors.map((v) => v.name).filter(Boolean))];
    const rawShips = vendorShips ?? lookupOptions.allShips.map((s) => s.name);
    const ships = [...new Set(rawShips.filter(Boolean))];
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

  const setF = (key, value) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key !== "code") {
        setAppliedFilters(next);
        setPage(1);
      }
      return next;
    });
  };

  const selectVendor = (vendorName) => {
    setFilters((current) => {
      const next = { ...current, vendor: vendorName, ship: "" };
      setAppliedFilters(next);
      setPage(1);
      return next;
    });
  };

  const applyDatePreset = (preset) => {
    setDatePreset(preset.label);
    let startDate = "";
    let endDate = "";
    if (preset.days != null) {
      const today = new Date();
      const end = new Date(today.getTime() + preset.days * 86400000);
      const toInputDate = (d) => d.toISOString().slice(0, 10);
      startDate = toInputDate(today);
      endDate = toInputDate(end);
    }
    setFilters((current) => {
      const next = { ...current, startDate, endDate };
      setAppliedFilters(next);
      setPage(1);
      return next;
    });
  };

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

  // Debounce keyword search input so typing naturally filters after short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.code !== appliedFilters.code) {
        setAppliedFilters((current) => ({ ...current, code: filters.code }));
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [filters.code, appliedFilters.code]);

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
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4">
      {/* ── Top Header Banner ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-teal-200/60 bg-gradient-to-br from-teal-50/70 via-sky-50/50 to-emerald-50/60 p-6 sm:p-8 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/80 backdrop-blur-xs px-3.5 py-1 text-[11px] font-bold text-teal-800 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
              </span>
              <span>Inventory Manager · Live Database</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Cruise Search & Inventory Explorer
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">
              Paginated cruise inventory from the database with ship drilldown, real-time cabin category pricing, and booking tags.
            </p>
          </div>

          {/* Stat Counter Chips */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-2xs min-w-[120px] transition-all hover:border-slate-300">
              <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
                <Ship size={16} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Cruises</span>
                <span className="text-xl font-black text-slate-900 font-mono tracking-tight">{overview.cruises?.toLocaleString() ?? 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-2xs min-w-[120px] transition-all hover:border-slate-300">
              <div className="p-1.5 rounded-lg bg-sky-50 text-sky-700">
                <Compass size={16} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Ships</span>
                <span className="text-xl font-black text-slate-900 font-mono tracking-tight">{overview.ships?.toLocaleString() ?? 0}</span>
              </div>
            </div>
            {opts.ports?.length > 0 && (
              <div className="hidden sm:flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-2xs min-w-[120px] transition-all hover:border-slate-300">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <MapPin size={16} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Ports</span>
                  <span className="text-xl font-black text-slate-900 font-mono tracking-tight">{opts.ports.length}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* ── Filter Form Card ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5">
          {/* Cruise Code Input */}
          <div>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <Search size={13} className="text-teal-600" />
              <span>Cruise Code or Keyword</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              <input
                type="text"
                placeholder="Search by cruise code, ship name, package title or route (e.g. CJ07260801)"
                value={filters.code}
                onChange={(event) => setF("code", event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }}
                className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition shadow-2xs"
              />
              {filters.code && (
                <button
                  type="button"
                  onClick={() => setF("code", "")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Vendor Filter Buttons */}
          <div>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <Layers size={13} className="text-teal-600" />
              <span>Cruise Line Provider</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => selectVendor("")}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filters.vendor === ""
                    ? "bg-teal-700 text-white shadow-xs border border-teal-700"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-2xs"
                }`}
              >
                All Providers
              </button>
              {opts.vendors.map((value) => {
                const isSelected = filters.vendor === value;
                const vStyle = getVendorStyle(value);
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => selectVendor(value)}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? "bg-teal-700 text-white font-bold shadow-xs border border-teal-700"
                        : "bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80 shadow-2xs"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : vStyle.dot}`} />
                      <span>{value}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4 Multi-Select Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: "ship", ph: "Select Ship", mode: "input", values: opts.ships, icon: Ship, iconColor: "text-sky-600" },
              { key: "cruiseLine", ph: "Select Cruise Line", mode: "select", values: opts.cruiseLines, icon: Compass, iconColor: "text-teal-600" },
              { key: "portFrom", ph: "Departure Port (From)", mode: "select", values: opts.ports, icon: MapPin, iconColor: "text-emerald-600" },
              { key: "portTo", ph: "Destination Port (To)", mode: "select", values: opts.ports, icon: MapPin, iconColor: "text-indigo-600" },
            ].map((field) => {
              const Icon = field.icon;
              return field.mode === "input" ? (
                <div key={field.key}>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    <Icon size={12} className={field.iconColor} />
                    <span>{field.ph}</span>
                  </label>
                  <SearchableSelect
                    placeholder={field.ph}
                    value={filters[field.key]}
                    onChange={(value) => setF(field.key, value)}
                    options={field.values}
                  />
                </div>
              ) : (
                <div key={field.key}>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    <Icon size={12} className={field.iconColor} />
                    <span>{field.ph}</span>
                  </label>
                  <select
                    className="w-full h-9.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition shadow-2xs"
                    value={filters[field.key]}
                    onChange={(event) => setF(field.key, event.target.value)}
                  >
                    <option value="">{field.ph} (All)</option>
                    {field.values.map((value) => (
                      <option key={value} value={value}>
                        {field.key === "cruiseLine" ? (CRUISE_LINE_LABELS[value] ?? value) : value}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Departure Window */}
          <div>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <CalendarDays size={13} className="text-teal-600" />
              <span>Departure Window</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: "All Dates", days: null },
                { label: "Next 7 Days", days: 7 },
                { label: "Next 30 Days", days: 30 },
                { label: "Next 3 Months", days: 90 },
                { label: "Next 6 Months", days: 182 },
                { label: "Next 1 Year", days: 365 },
                { label: "Next 2 Years", days: 730 },
              ].map((preset) => {
                const isActive = datePreset === preset.label || (preset.label === "All Dates" && !datePreset && !filters.startDate && !filters.endDate);
                return (
                  <button
                    type="button"
                    key={preset.label}
                    onClick={() => applyDatePreset(preset)}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? "bg-teal-700 text-white font-bold shadow-xs border border-teal-700"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-2xs"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="date"
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 font-semibold shadow-2xs focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-500/20"
                  value={filters.startDate}
                  onChange={(event) => { setF("startDate", event.target.value); setDatePreset(null); }}
                />
                <span className="text-xs font-medium text-slate-400">to</span>
                <input
                  type="date"
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 font-semibold shadow-2xs focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-500/20"
                  value={filters.endDate}
                  onChange={(event) => { setF("endDate", event.target.value); setDatePreset(null); }}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
            <button
              onClick={applyFilters}
              className="inline-flex items-center gap-2 h-9.5 px-5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold shadow-xs active:scale-95 transition cursor-pointer"
            >
              <Search size={15} />
              <span>Search Inventory</span>
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 h-9.5 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs active:scale-95 transition cursor-pointer"
            >
              <RotateCcw size={13} className="text-slate-500" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>

        {/* ── Results Status Toolbar ──────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="inline-flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
            </span>
            <span className="text-xs font-bold text-slate-900">
              {loading ? "Searching inventory…" : `${(pagination?.total ?? rows.length).toLocaleString()} sailings found`}
            </span>
          </div>
          <div className="bg-white px-3 py-0.5 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 font-mono shadow-2xs">
            Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1}
          </div>
        </div>

        {/* ── Table & Mobile List Card ────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-sm font-semibold text-slate-600 flex flex-col items-center justify-center gap-2.5">
              <RefreshCw className="animate-spin text-teal-600" size={20} />
              <span>Loading cruises from database...</span>
            </div>
          ) : error ? (
            <div className="py-20 text-center text-sm font-bold text-rose-600">{error}</div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center text-sm font-medium text-slate-400">No cruises found.</div>
          ) : (
            <>
              {/* ── Mobile List View (md:hidden) ─────────────────────────── */}
              <div className="block md:hidden divide-y divide-slate-100">
                {rows.map((row) => {
                  const lowestPrice = Math.min(...(row.cabinCategories || []).filter((cabin) => cabin.avlResult === "OK").map((cabin) => Number(cabin.cabinPrice ?? 0)));
                  const hasFullDetails = (row.cabinCategories || []).some(
                    c => c.confidence === "Medium" || c.confidence === "High"
                  );
                  const isTagged = (row.tags?.length || 0) > 0;
                  const canTag = hasFullDetails || isTagged;
                  const availableCabins = row.cabinCategories?.filter(c => c.avlResult === "OK").length ?? 0;
                  const vStyle = getVendorStyle(row.vendor?.name);

                  return (
                    <div key={row.id} className={`p-4 transition-colors ${isTagged ? "bg-amber-50/50" : "bg-white"}`}>
                      {/* Top bar: Vendor, Ship badge, Pin */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${vStyle.badge}`}>
                            {row.vendor?.name}
                          </span>
                          {row.cruiseLine && (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              {CRUISE_LINE_LABELS[row.cruiseLine] ?? row.cruiseLine}
                            </span>
                          )}
                          <button
                            onClick={() => setShipRow(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 text-[11px] font-bold transition cursor-pointer"
                          >
                            <Ship size={11} className="text-sky-600" />
                            <span>{row.ship}</span>
                          </button>
                        </div>
                        <button
                          onClick={() => canTag ? togglePin(row.id) : null}
                          className={`p-1.5 rounded-lg transition shrink-0 ${
                            canTag ? "cursor-pointer hover:bg-slate-100" : "cursor-not-allowed opacity-30"
                          } ${isTagged ? "text-amber-600 bg-amber-100/60" : "text-slate-400"}`}
                          title={
                            isTagged ? "Manage tags"
                            : canTag ? "Add tag"
                            : "Get Full Details first before tagging"
                          }
                        >
                          <Pin size={15} className={isTagged ? "fill-amber-500 text-amber-600" : ""} />
                        </button>
                      </div>

                      {/* Package Title */}
                      <h4 className="text-sm font-bold text-slate-900 leading-snug mb-2">
                        {row.package}
                      </h4>

                      {/* Route & Nights */}
                      <div className="flex items-center gap-2 text-xs mb-3 flex-wrap">
                        <button
                          onClick={() => setItineraryRow(row)}
                          className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-900 text-xs cursor-pointer hover:underline underline-offset-2"
                        >
                          <MapPin size={12} className="shrink-0 text-teal-600" />
                          <span>{getCruiseRouteLabel(row)}</span>
                        </button>
                        <span className="text-slate-300">•</span>
                        <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px]">
                          {row.nights} Nights
                        </span>
                      </div>

                      {/* Sailing Dates */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 mb-3">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Departure</div>
                          <div className="font-semibold text-slate-900 mt-0.5">{fmtDate(row.startDate)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Arrival</div>
                          <div className="font-semibold text-slate-900 mt-0.5">{fmtDate(row.endDate)}</div>
                        </div>
                      </div>

                      {/* Bottom Bar: Availability & Price Button */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {availableCabins} cabins available
                        </span>

                        <button
                          onClick={() => setPricingRow(row)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            Number.isFinite(lowestPrice)
                              ? "bg-teal-700 hover:bg-teal-800 text-white shadow-2xs"
                              : "bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100"
                          }`}
                        >
                          {Number.isFinite(lowestPrice) ? safeCurrency(lowestPrice, row.currency) : "View Cabins / WTL"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop Table View (hidden md:block) ─────────────────── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["", "Vendor", "Ship", "Cruise", "Nights", "Route", "Departure", "Arrival", "Avail.", "Refreshed", "Price"].map((header) => (
                        <th key={header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {rows.map((row, index) => {
                      const lowestPrice = Math.min(...(row.cabinCategories || []).filter((cabin) => cabin.avlResult === "OK").map((cabin) => Number(cabin.cabinPrice ?? 0)));
                      const hasFullDetails = (row.cabinCategories || []).some(
                        c => c.confidence === "Medium" || c.confidence === "High"
                      );
                      const isTagged = (row.tags?.length || 0) > 0;
                      const canTag = hasFullDetails || isTagged;
                      const vStyle = getVendorStyle(row.vendor?.name);

                      return (
                        <tr key={row.id} className={`transition-all hover:bg-slate-50/70 ${isTagged ? "bg-amber-50/50" : index % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => canTag ? togglePin(row.id) : null}
                              className={`p-1 rounded-md transition ${
                                canTag ? "cursor-pointer hover:bg-slate-100" : "cursor-not-allowed opacity-30"
                              } ${isTagged ? "text-amber-600" : "text-slate-400"}`}
                              title={
                                isTagged ? "Manage tags"
                                : canTag ? "Add tag"
                                : "Get Full Details first before tagging"
                              }
                            >
                              <Pin size={15} className={isTagged ? "fill-amber-500 text-amber-600" : ""} />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${vStyle.badge}`}>
                              {row.vendor?.name}
                            </span>
                            {row.cruiseLine && (
                              <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
                                {CRUISE_LINE_LABELS[row.cruiseLine] ?? row.cruiseLine}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setShipRow(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 text-xs font-bold transition cursor-pointer"
                            >
                              <Ship size={11} className="text-sky-600" />
                              <span>{row.ship}</span>
                            </button>
                            <div className="mt-0.5 text-[11px] font-mono text-slate-400">
                              {getCruiseDisplayId(row)}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 max-w-[240px] truncate" title={row.package}>
                            {row.package}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                              {row.nights}N
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setItineraryRow(row)}
                              className="text-left font-semibold text-teal-700 hover:text-teal-900 hover:underline text-xs decoration-dotted underline-offset-4 cursor-pointer"
                            >
                              {getCruiseRouteLabel(row)}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                            {fmtDate(row.startDate)}
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                            {fmtDate(row.endDate)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {row.cabinCategories?.filter(c => c.avlResult === "OK").length ?? 0} avail
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-400 whitespace-nowrap">
                            {(() => {
                              const ts = row.cabinsUpdatedAt ?? row.updatedAt ?? row.createdAt;
                              return ts ? fmtFetchedAt(new Date(ts).getTime()) : "—";
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setPricingRow(row)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs ${
                                Number.isFinite(lowestPrice)
                                  ? "bg-teal-700 hover:bg-teal-800 text-white"
                                  : "bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100"
                              }`}
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
            </>
          )}
        </div>

        {/* ── Modern Pagination Bar ─────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>
              Showing page <strong className="text-slate-900 font-bold">{pagination?.page ?? 1}</strong> of{" "}
              <strong className="text-slate-900 font-bold">{pagination?.totalPages ?? 1}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              <strong className="text-slate-900 font-bold">{(pagination?.total ?? rows.length).toLocaleString()}</strong> total sailings
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <button
              onClick={() => setPage(1)}
              disabled={!pagination?.hasPreviousPage || loading}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
              title="First Page"
            >
              <ChevronsLeft size={14} />
              <span className="hidden sm:inline">First</span>
            </button>

            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={!pagination?.hasPreviousPage || loading}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
              <span>Prev</span>
            </button>

            <div className="flex items-center gap-1 mx-0.5">
              {getVisiblePages(pagination?.page ?? 1, pagination?.totalPages ?? 1).map((pageNumber, index, pages) => {
                const previousPage = pages[index - 1];
                const showGap = previousPage && pageNumber - previousPage > 1;

                return (
                  <div key={pageNumber} className="flex items-center gap-1">
                    {showGap && <span className="text-slate-400 text-xs px-1 font-bold select-none">...</span>}
                    <button
                      onClick={() => setPage(pageNumber)}
                      disabled={loading}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        pageNumber === (pagination?.page ?? 1)
                          ? "bg-teal-700 text-white shadow-xs border border-teal-700 ring-2 ring-teal-700/20"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={!pagination?.hasNextPage || loading}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>

            <button
              onClick={() => setPage(pagination?.totalPages ?? 1)}
              disabled={!pagination?.hasNextPage || loading}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
              title="Last Page"
            >
              <span className="hidden sm:inline">Last</span>
              <ChevronsRight size={14} />
            </button>
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
    </div>
  );
}
