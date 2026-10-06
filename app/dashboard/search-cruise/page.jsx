"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, ChevronUp, ChevronLeft, ChevronsLeft, ChevronsRight, Pin, Minus, Tag, TrendingDown, TrendingUp, X, ImageIcon, Search, RotateCcw, RefreshCw, Compass, Sparkles, AlertCircle, Ship, MapPin, CalendarDays, Layers, Zap, CheckCircle2, Play, Check, ArrowDown, ArrowDownNarrowWide, ArrowUpNarrowWide, Building2 } from "lucide-react";

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
import { fetchCategoryDecks, refreshCruiseCabins, getCruiseRefreshStatus, logActivity, fetchCruise, triggerVendorScrapeFetch } from "../api";
import { CruiseSearchSkeleton } from "@/components/ui/skeleton-patterns";
import { Skeleton } from "@/components/ui/skeleton";

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

const VENDOR_SCRAPER_MAP = {
  "MSC Cruises": "msc",
  "Holland America (gohal)": "gohal",
  "Complete Cruise Solution A": "completecruisesolutionA",
  "Complete Cruise Solution B": "completecruisesolutionB",
  "FirstMates": "firstmates",
  "Azamara": "azamara",
  "CruisingPower": "cruisingpower",
  "GOCCL": "goccl",
  "Seawebagents": "seawebagents",
  "Celestyal": "celestyal",
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
function SearchableSelect({ placeholder, value, onChange, options, onEnter }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const boxRef = useRef(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const uniqueOptions = useMemo(() => [...new Set(options || [])].filter(Boolean), [options]);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return uniqueOptions;
    return uniqueOptions.filter((opt) => opt.toLowerCase().includes(q));
  }, [uniqueOptions, query]);

  const handleInputChange = (event) => {
    const newVal = event.target.value;
    setQuery(newVal);
    if (!open) setOpen(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onChange(newVal);
    }, 300);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      onChange(query);
      setOpen(false);
      if (onEnter) onEnter();
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white px-3.5 pr-8 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all shadow-2xs"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
              setQuery("");
              onChange("");
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full hover:bg-slate-100 transition"
            title="Clear"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
      </div>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-40 max-h-64 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 backdrop-blur-md">
          <div
            onMouseDown={(event) => {
              event.preventDefault();
              if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
              setQuery("");
              onChange("");
              setOpen(false);
            }}
            className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer border-b border-slate-100 flex items-center justify-between transition-colors"
          >
            <span>{placeholder} (All)</span>
            <span className="text-[10px] text-slate-400 font-medium">Reset</span>
          </div>
          {query.trim() && !uniqueOptions.some((opt) => opt.toLowerCase() === query.trim().toLowerCase()) && (
            <div
              onMouseDown={(event) => {
                event.preventDefault();
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                onChange(query.trim());
                setOpen(false);
              }}
              className="px-3.5 py-2 text-xs cursor-pointer bg-teal-50/80 hover:bg-teal-100/80 text-teal-900 font-semibold border-b border-teal-100 flex items-center justify-between transition-colors"
            >
              <span>Search ship containing <strong className="font-bold">"{query.trim()}"</strong></span>
              <span className="text-[10px] bg-teal-200/80 px-2 py-0.5 rounded-md text-teal-800 font-bold">Apply</span>
            </div>
          )}
          {filtered.length === 0 && !query.trim() && (
            <div className="px-3.5 py-3 text-xs text-slate-400">No options available</div>
          )}
          {filtered.map((opt, idx) => (
            <div
              key={`${opt}-${idx}`}
              onMouseDown={(event) => {
                event.preventDefault();
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                setQuery(opt);
                onChange(opt);
                setOpen(false);
              }}
              className={`px-3.5 py-2 text-xs cursor-pointer transition ${opt.toLowerCase() === (value || "").toLowerCase()
                ? "bg-teal-50 text-teal-800 font-bold"
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

// Icon-powered Sort Dropdown — replaces native select emoji options with rich Lucide icons
function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const SORT_OPTIONS = [
    { value: "refreshed", label: "Recently Refreshed", icon: Zap, iconColor: "text-amber-500" },
    { value: "departure", label: "Departure Date (Soonest)", icon: CalendarDays, iconColor: "text-teal-600" },
    { value: "price_asc", label: "Price (Low to High)", icon: ArrowDownNarrowWide, iconColor: "text-emerald-600" },
    { value: "price_desc", label: "Price (High to Low)", icon: ArrowUpNarrowWide, iconColor: "text-indigo-600" },
    { value: "avail", label: "Availability (Most Avail)", icon: CheckCircle2, iconColor: "text-cyan-600" },
  ];

  const current = SORT_OPTIONS.find((opt) => opt.value === value) || SORT_OPTIONS[0];
  const CurrentIcon = current.icon;

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-2xs cursor-pointer transition"
      >
        <CurrentIcon size={14} className={`${current.iconColor} shrink-0`} />
        <span>{current.label}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            Sort inventory by
          </div>
          {SORT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${isSelected ? "bg-teal-50 text-teal-900 font-bold" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} className={`${opt.iconColor} shrink-0`} />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check size={13} className="text-teal-600 shrink-0" />}
              </button>
            );
          })}
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
    Balcony: { bg: "#ecfeff", color: "#0f766e" },
    Suite: { bg: "#ede9fe", color: "#6d28d9" },
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

function Modal({ children, onClose, width = "min(96vw, 920px)", className = "" }) {
  useEffect(() => {
    const handle = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/90 relative ${className}`}
        style={{ maxWidth: width }}
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
      <div className="p-4 sm:p-6 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ship Details</div>
          <h2 className="mt-1 text-lg sm:text-2xl font-bold text-slate-900 leading-snug break-words">{ship.name || row.ship}</h2>
          <div className="mt-1 text-xs text-slate-500 font-mono">{shipCode || "--"}</div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-3.5 sm:p-5 pt-3 pb-0 flex gap-2 flex-wrap border-b border-slate-100">
        {[
          { key: "overview", label: "Overview" },
          { key: "decks", label: `Deck Plans (${decks.length})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === tab.key
              ? "bg-teal-700 text-white shadow-2xs"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
        {loadingShip ? (
          <div className="space-y-4 py-2">
            <Skeleton className="h-64 w-full rounded-2xl bg-slate-200" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-200/80 bg-slate-50 space-y-2">
                  <Skeleton className="h-3 w-16 bg-slate-200" />
                  <Skeleton className="h-5 w-24 bg-slate-300" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-36 bg-slate-300" />
              <Skeleton className="h-20 w-full rounded-xl bg-slate-100" />
            </div>
          </div>
        ) : shipError ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{shipError}</div>
        ) : null}

        {activeTab === "overview" ? (
          <>
            {imageSrc && (
              <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-slate-100 h-52 sm:h-64 relative">
                <Image
                  src={imageSrc}
                  alt={ship.name || row.ship}
                  fill
                  sizes="(max-width: 768px) 96vw, 1080px"
                  className="object-cover"
                  onError={() => setImageSrc(null)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
              {stats.map(([label, value]) => (
                <div key={label} className="border border-slate-200/80 rounded-xl p-3 sm:p-3.5 bg-slate-50">
                  <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
                  <div className="mt-1 font-bold text-sm sm:text-base text-slate-900">{value}</div>
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
            <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-4">
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
  Unavailable: { bg: "#fef2f2", color: "#ef4444" },
  Waitlist: { bg: "#fffbeb", color: "#d97706" },
  Unknown: { bg: "#f8fafc", color: "#64748b" },
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
  if (!ts) return "—";
  const num = typeof ts === "number" ? ts : new Date(ts).getTime();
  if (isNaN(num) || num <= 0) return "—";
  const diffSec = Math.round((Date.now() - num) / 1000);
  if (diffSec < 30) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays <= 7) return `${diffDays}d ago`;
  const d = new Date(num);
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
};

function DataRefreshStrip({ job, row, onRefresh }) {
  const status = job?.status;
  const isRunning = status === "in_progress" || status === "started";
  const isCooldown = status === "cooldown";
  const isBlocked = isRunning || isCooldown;
  const remainingSec = isRunning
    ? Math.ceil((job?.remaining ?? 0) / 1000)
    : isCooldown ? (job?.retryAfter ?? 0) : 0;
  const stillFetching = isRunning && remainingSec <= 0;
  const fetchedTs = !isRunning
    ? (job?.completedAt ?? (row?.cabinsUpdatedAt ? new Date(row.cabinsUpdatedAt).getTime() : null))
    : null;
  const fetchedLabel = isRunning ? null : fetchedTs ? `Fetched ${fmtFetchedAt(fetchedTs)}` : "Not available";

  return (
    <div className="p-3 px-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200/80 bg-slate-50/70 rounded-b-xl">
      <div className="flex items-center gap-2 text-xs">
        {isRunning && (
          <span className="inline-flex items-center gap-1.5 text-teal-800 font-semibold">
            <RefreshCw size={12} className="animate-spin text-teal-600" />
            <span>{stillFetching ? "Almost done…" : `Refreshing live… ~${fmtSeconds(remainingSec)} left`}</span>
          </span>
        )}
        {isCooldown && (
          <span className="text-slate-500 font-medium">
            Next refresh in {fmtSeconds(remainingSec)}
          </span>
        )}
        {fetchedLabel && (
          <span className="text-slate-500 font-medium">
            {fetchedLabel}
          </span>
        )}
      </div>

      <button
        onClick={onRefresh}
        disabled={isBlocked}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-slate-700 hover:text-slate-900 shadow-2xs active:scale-95 transition cursor-pointer"
      >
        <RefreshCw size={12} className={`text-slate-500 ${isRunning ? "animate-spin" : ""}`} />
        <span>{isRunning ? "Refreshing…" : "Refresh Data"}</span>
      </button>
    </div>
  );
}

function RefreshBanner({ job, onRefresh }) {
  const status = job?.status;
  const isRunning = status === "in_progress" || status === "started";
  const isCooldown = status === "cooldown";
  const isError = status === "error" || status === "rate_limited";
  const isBlocked = isRunning || isCooldown;

  const remainingSec = isRunning
    ? Math.ceil((job?.remaining ?? 0) / 1000)
    : isCooldown ? (job?.retryAfter ?? 0) : 0;
  const stillFetching = isRunning && remainingSec <= 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-xl bg-gradient-to-r from-slate-50 via-teal-50/20 to-slate-50 border border-slate-200/90 shadow-2xs">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${isRunning ? "bg-teal-100 text-teal-700" : isError ? "bg-rose-100 text-rose-700" : "bg-teal-50 border border-teal-100 text-teal-700"
          }`}>
          {isRunning ? (
            <RefreshCw size={16} className="animate-spin text-teal-700" />
          ) : isError ? (
            <AlertCircle size={16} className="text-rose-600" />
          ) : (
            <Sparkles size={16} className="text-teal-600" />
          )}
        </div>
        <div className="text-xs space-y-0.5">
          <div className="font-bold text-slate-900">
            {isRunning
              ? stillFetching
                ? "Finalizing live carrier staterooms…"
                : `Fetching live staterooms… ~${fmtSeconds(remainingSec)} remaining`
              : isCooldown
                ? `Data fetched — next refresh in ${fmtSeconds(remainingSec)}`
                : job?.success
                  ? "No cabin-level data available for this vendor."
                  : isError
                    ? job.error ?? "Failed to fetch live data."
                    : "No detailed cabin data loaded yet."}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {isRunning
              ? "Querying carrier booking portal for open cabin numbers..."
              : isError
                ? (job?.retryAfter ? `Retry available in ${fmtSeconds(job.retryAfter)}` : "Click below to retry scraper worker.")
                : "Fetch real-time cabin numbers, deck locations, and availability."}
          </div>
        </div>
      </div>

      {!isBlocked && (
        <button
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-95 text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer shrink-0"
        >
          <Sparkles size={13} />
          <span>Get Full Details</span>
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
  DEPART: { bg: "#fee2e2", color: "#b91c1c" },
  "ARRIVE-DOCK": { bg: "#dcfce7", color: "#15803d" },
  "ARRIVE-TENDER": { bg: "#d1fae5", color: "#065f46" },
  "AT SEA": { bg: "#e0f2fe", color: "#0369a1" },
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
      <div className="p-4 sm:p-6 border-b border-slate-200 flex items-start justify-between gap-3 bg-gradient-to-b from-slate-50/80 to-white">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full inline-block">Itinerary Schedule</div>
          <h2 className="text-base sm:text-xl font-black text-slate-900 leading-snug break-words">{row.package || "Cruise Itinerary"}</h2>
          <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap pt-0.5">
            {row.ship && <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">{row.ship}</span>}
            {row.nights && <span className="font-medium text-slate-500">· {row.nights} nights</span>}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Table & Mobile List View */}
      <div className="overflow-y-auto max-h-[70vh] divide-y divide-slate-100">
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
            {/* Mobile List View (block sm:hidden) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {stops.map((stop, i) => {
                const as = activityStyle(stop.activity ?? "");
                return (
                  <div key={i} className="p-3.5 space-y-2 bg-white hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded shrink-0">
                          Day {stop.day}
                        </span>
                        <span className="font-bold text-slate-900 text-sm truncate">{stop.port}</span>
                      </div>
                      <span style={{ background: as.bg, color: as.color }} className="rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0">
                        {stop.activity}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <span className="font-medium text-slate-600 truncate">{stop.country || "Port of call"}</span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {stop.date} {stop.time ? `· ${stop.time}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop / Tablet View (hidden sm:block) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10.5px]">
                  <tr>
                    <th className="px-4 py-2.5">Day</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Time</th>
                    <th className="px-4 py-2.5">Activity</th>
                    <th className="px-4 py-2.5">Port of Call</th>
                    <th className="px-4 py-2.5">Country</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {stops.map((stop, i) => {
                    const as = activityStyle(stop.activity ?? "");
                    return (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                        <td className="px-4 py-3 font-bold text-slate-600">{stop.day}</td>
                        <td className="px-4 py-3 font-mono text-slate-800 whitespace-nowrap">{stop.date}</td>
                        <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{stop.time || "--"}</td>
                        <td className="px-4 py-3">
                          <span style={{ background: as.bg, color: as.color }} className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold whitespace-nowrap inline-block">
                            {stop.activity}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">{stop.port}</td>
                        <td className="px-4 py-3 text-slate-500">{stop.country || "--"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function LeadInDetailsPanel({ job, minPrice, currency, onGetDetails, hasAttemptedFetch, onForceCheck }) {
  const isRunning = job?.status === "in_progress" || job?.status === "started";
  const isCooldown = job?.status === "cooldown";
  const isError = job?.status === "error" || job?.status === "rate_limited";
  const remainingSec = isRunning ? Math.ceil((job.remaining ?? 0) / 1000) : isCooldown ? (job.retryAfter ?? 0) : 0;
  const isFinalizing = isRunning && remainingSec <= 0;

  if (hasAttemptedFetch && !isRunning && !isCooldown && !isError) {
    return (
      <div className="py-14 px-8 flex flex-col items-center gap-5 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-2xs">
          <AlertCircle size={26} strokeWidth={2.2} />
        </div>
        <div className="space-y-1.5">
          <div className="font-bold text-base text-slate-900">No Live Cabin Inventory Found</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            The carrier returned no open stateroom categories for this sailing. It may be currently fully booked (waitlist only), restricted to phone bookings, or not yet published by the cruise line.
          </div>
          {minPrice != null && Number.isFinite(minPrice) && (
            <div className="pt-2 text-xs text-slate-600">
              Published lead-in rate was&nbsp;
              <span className="font-bold font-mono text-slate-900">{safeCurrency(minPrice, currency)}</span>
            </div>
          )}
        </div>
        <button
          onClick={onGetDetails}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs hover:shadow-sm transition-all cursor-pointer active:scale-[0.98]"
        >
          <RefreshCw size={14} />
          <span>Check Live Vendor Again</span>
        </button>
      </div>
    );
  }

  return (
    <div className="py-12 px-8 flex flex-col items-center gap-5 text-center max-w-md mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shadow-2xs">
        {isRunning ? (
          <RefreshCw size={22} strokeWidth={2.2} className="animate-spin text-teal-600" />
        ) : (
          <Search size={22} strokeWidth={2.2} />
        )}
      </div>
      <div>
        <div className="font-bold text-base text-slate-900">
          {isRunning ? "Fetching Live Stateroom Data" : "Live cabin data not yet fetched"}
        </div>
        {minPrice != null && Number.isFinite(minPrice) && (
          <div className="mt-2 text-sm text-slate-600">
            Estimated lead-in price from&nbsp;
            <span className="font-bold font-mono text-slate-900">{safeCurrency(minPrice, currency)}</span>
          </div>
        )}
        <div className="mt-1.5 text-xs text-slate-500 max-w-sm">
          {isRunning
            ? "Querying carrier booking engines for live category availability and deck plans..."
            : "Fetch real-time cabin categories, availability, and deck data from the vendor."}
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg px-3.5 py-2 max-w-md text-left">
          <AlertCircle size={14} className="shrink-0 text-rose-600" />
          <span>{job?.error ?? "Request failed."}{job?.retryAfter ? ` Retry in ${fmtSeconds(job.retryAfter)}.` : ""}</span>
        </div>
      )}

      {isRunning ? (
        <div className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-teal-50/60 border border-teal-200/80 w-full shadow-2xs">
          <div className="text-xs font-bold text-teal-900 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
            </span>
            {isFinalizing
              ? "Finalizing data from vendor… Almost ready"
              : `Scraper active in background (~${fmtSeconds(remainingSec)} remaining)`}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {job?.elapsed ? `Elapsed: ${fmtSeconds(Math.ceil(job.elapsed / 1000))} · ` : ""}Est. {fmtSeconds(Math.ceil((job?.estimatedMs ?? 90000) / 1000))} total
          </div>
          {onForceCheck && (
            <button
              onClick={onForceCheck}
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-teal-900 font-bold text-xs border border-teal-200/90 shadow-2xs cursor-pointer transition hover:border-teal-300 active:scale-95"
            >
              <RefreshCw size={13} className="text-teal-700" />
              <span>Check & Display Staterooms Now</span>
            </button>
          )}
        </div>
      ) : isCooldown ? (
        <div className="text-xs font-medium text-slate-600 flex items-center gap-2">
          <RefreshCw size={13} className="animate-spin text-teal-600" />
          <span>Data fetched — reloading staterooms…</span>
        </div>
      ) : (
        <button
          onClick={onGetDetails}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-xs transition-all cursor-pointer active:scale-[0.98]"
        >
          <Sparkles size={15} />
          <span>Get Full Details</span>
        </button>
      )}
    </div>
  );
}

function PricingModal({ row: initialRow, onClose, onRefreshComplete }) {
  const [row, setRow] = useState(initialRow);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  useEffect(() => {
    setRow(initialRow);
  }, [initialRow]);

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

  useEffect(() => {
    if (cabinGroups.length > 0 && (!activeGroup || !cabinGroups.some(g => g.group === activeGroup))) {
      setActiveGroup(cabinGroups[0]?.group ?? null);
    }
  }, [cabinGroups, activeGroup]);

  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedDecks, setExpandedDecks] = useState(new Set());
  // { [code]: { loading, decks: [{deckNumber, deckName, deckImage, cabins}], error } }
  const [cabinCache, setCabinCache] = useState({});
  const [deckImageUrl, setDeckImageUrl] = useState(null);
  // refreshJob: null | { status, estimatedMs, elapsed, remaining, retryAfter, error, count }
  const [refreshJob, setRefreshJob] = useState(null);
  const refreshPollRef = useRef(null);
  const pollCountRef = useRef(0);

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

    // Guarantee categories don't have individual cabin selections
    if (cat.avlResult === "GTY" || cat.status === "Guarantee") return;

    // Check if cabins are already present in category object
    if (Array.isArray(cat.cabins) && cat.cabins.length > 0) {
      const deckMap = new Map();
      cat.cabins.forEach((cab) => {
        const dNum = cab.deckNumber ?? cab.deck ?? "Main";
        const dName = cab.deckName ?? `Deck ${dNum}`;
        if (!deckMap.has(dName)) {
          deckMap.set(dName, { deckNumber: dNum, deckName: dName, deckImage: cab.deckImage, cabins: [] });
        }
        deckMap.get(dName).cabins.push(cab);
      });
      const embeddedDecks = Array.from(deckMap.values());
      if (embeddedDecks.length > 0) {
        setCabinCache(prev => ({ ...prev, [code]: { loading: false, decks: embeddedDecks } }));
        setExpandedDecks(new Set([String(embeddedDecks[0].deckNumber ?? embeddedDecks[0].deckName)]));
        return;
      }
    }

    // Already cached
    if (cabinCache[code] && cabinCache[code].decks?.length > 0) return;

    const cruiseIdOrCode = row.code ?? row.id;
    setCabinCache(prev => ({ ...prev, [code]: { loading: true, decks: [] } }));
    try {
      const result = await fetchCategoryDecks(cruiseIdOrCode, code);
      let rawDecks = result?.data?.decks ?? result?.decks ?? (Array.isArray(result?.data) ? result.data : []);

      // If rawDecks is array of flat cabin objects instead of decks, group by deck
      if (rawDecks.length > 0 && !rawDecks[0].cabins && rawDecks[0].cabinNumber) {
        const deckMap = new Map();
        rawDecks.forEach((cab) => {
          const dNum = cab.deckNumber ?? cab.deck ?? "Main";
          const dName = cab.deckName ?? `Deck ${dNum}`;
          if (!deckMap.has(dName)) {
            deckMap.set(dName, { deckNumber: dNum, deckName: dName, deckImage: cab.deckImage, cabins: [] });
          }
          deckMap.get(dName).cabins.push(cab);
        });
        rawDecks = Array.from(deckMap.values());
      }

      setCabinCache(prev => ({ ...prev, [code]: { loading: false, decks: rawDecks } }));
      if (rawDecks[0]?.deckNumber != null || rawDecks[0]?.deckName != null) {
        setExpandedDecks(new Set([String(rawDecks[0].deckNumber ?? rawDecks[0].deckName)]));
      }
    } catch {
      setCabinCache(prev => ({ ...prev, [code]: { loading: false, decks: [], error: true } }));
    }
  }

  const cruiseCode = row.code ?? row.id;

  function stopPolling() {
    if (refreshPollRef.current) { clearInterval(refreshPollRef.current); refreshPollRef.current = null; }
  }

  async function reloadCruiseData() {
    try {
      const updated = await fetchCruise(cruiseCode);
      if (updated) {
        setRow(updated);
        if (onRefreshComplete) onRefreshComplete(updated);
      }
      return updated;
    } catch {
      return null;
    }
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
    pollCountRef.current = 0;
    refreshPollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      try {
        // Check if DB already populated cabin categories
        const updated = await reloadCruiseData();
        if (updated && (updated.cabinCategories || []).length > 0) {
          stopPolling();
          setHasAttemptedFetch(true);
          setRefreshJob(null);
          if (catCode) reloadCategoryDecks(catCode);
          if (onComplete) onComplete(updated);
          return;
        }

        const s = await getCruiseRefreshStatus(cruiseCode);
        setRefreshJob(s);

        const isDone = s.status === "cooldown" || s.status === "idle" || s.status === "offline" || s.status === "error";
        const isExpired = s.status === "in_progress" && (s.remaining == null || s.remaining <= 0);

        if (isDone || isExpired) {
          stopPolling();
          setHasAttemptedFetch(true);
          setRefreshJob(null);
          if (s.success && catCode) reloadCategoryDecks(catCode);
          if (onComplete) onComplete(updated);
        }
      } catch {
        stopPolling();
        setHasAttemptedFetch(true);
        setRefreshJob(null);
      }
    }, 2000);
  }

  // Check status on modal mount only if lead-in or checking active job
  useEffect(() => {
    if (isLeadInOnly || cabinGroups.length === 0) {
      getCruiseRefreshStatus(cruiseCode).then(async (s) => {
        if (s && s.status !== "offline") {
          // Only start polling if there is a real, active job with remaining time > 0
          if (s.status === "in_progress" && s.remaining > 0) {
            setRefreshJob(s);
            startPolling(null);
          } else {
            // Stale or already completed — immediately check DB
            const updated = await reloadCruiseData();
            if (updated && (updated.cabinCategories || []).length > 0) {
              setRefreshJob(null);
            } else {
              setHasAttemptedFetch(true);
              setRefreshJob(null);
            }
          }
        } else {
          setHasAttemptedFetch(true);
          setRefreshJob(null);
        }
      }).catch(() => {
        setHasAttemptedFetch(true);
        setRefreshJob(null);
      });
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cruiseCode, isLeadInOnly]);

  async function handleForceCheck() {
    stopPolling();
    await reloadCruiseData();
    setHasAttemptedFetch(true);
    setRefreshJob(null);
  }

  async function handleRefresh(catCode) {
    const vendorKey =
      VENDOR_SCRAPER_MAP[row.vendor?.name] ??
      row.vendor?.slug ??
      (row.vendor?.name ? row.vendor.name.toLowerCase().replace(/[^a-z0-9]/g, "") : null) ??
      row.vendorKey ??
      row.source ??
      "msc";

    try {
      const result = await refreshCruiseCabins(cruiseCode, vendorKey);
      logActivity("refresh_cabin", { cruiseCode, vendorKey, status: result.status });
      const isCompletedOrStale =
        result.status === "idle" ||
        result.status === "cooldown" ||
        result.success ||
        result.remaining <= 0 ||
        (result.elapsed != null && result.estimatedMs != null && result.elapsed >= result.estimatedMs);

      // Check if DB already has categories while job is running in background
      const current = await reloadCruiseData();
      if (current && (current.cabinCategories || []).length > 0) {
        setHasAttemptedFetch(true);
        setRefreshJob(null);
        if (catCode) reloadCategoryDecks(catCode);
        return;
      }

      if (isCompletedOrStale) {
        setHasAttemptedFetch(true);
        setRefreshJob(null);
        if (catCode) reloadCategoryDecks(catCode);
        return;
      }
      const estMs = result.remaining ?? result.estimatedMs ?? 45000;
      setRefreshJob({ status: result.status || "in_progress", estimatedMs: result.estimatedMs ?? estMs, remaining: estMs, elapsed: result.elapsed });
      if (result.status === "started" || result.status === "in_progress") startPolling(catCode);
    } catch (err) {
      const offline = err.message?.toLowerCase().includes("fetch") || err.message?.toLowerCase().includes("network");
      setRefreshJob({ status: "error", error: offline ? "Scraper server is offline." : err.message, retryAfter: err.retryAfter });
      setHasAttemptedFetch(true);
    }
  }

  async function handleGetFullDetails() {
    const vendorKey =
      VENDOR_SCRAPER_MAP[row.vendor?.name] ??
      row.vendor?.slug ??
      (row.vendor?.name ? row.vendor.name.toLowerCase().replace(/[^a-z0-9]/g, "") : null) ??
      row.vendorKey ??
      row.source ??
      "msc";

    try {
      setHasAttemptedFetch(false);
      const result = await refreshCruiseCabins(cruiseCode, vendorKey);
      logActivity("refresh_cabin", { cruiseCode, vendorKey, status: result.status });
      const isCompletedOrStale =
        result.status === "idle" ||
        result.status === "cooldown" ||
        result.success ||
        result.remaining <= 0 ||
        (result.elapsed != null && result.estimatedMs != null && result.elapsed >= result.estimatedMs);

      // Check if DB already has categories while job is running in background
      const current = await reloadCruiseData();
      if (current && (current.cabinCategories || []).length > 0) {
        setHasAttemptedFetch(true);
        setRefreshJob(null);
        if (onRefreshComplete) onRefreshComplete(current);
        return;
      }

      if (isCompletedOrStale) {
        setHasAttemptedFetch(true);
        setRefreshJob(null);
        if (onRefreshComplete) onRefreshComplete(current);
        return;
      }
      const estMs = result.remaining ?? result.estimatedMs ?? 45000;
      setRefreshJob({ status: result.status || "in_progress", estimatedMs: result.estimatedMs ?? estMs, remaining: estMs, elapsed: result.elapsed });
      startPolling(null, onRefreshComplete);
    } catch (err) {
      const offline = err.message?.toLowerCase().includes("fetch") || err.message?.toLowerCase().includes("network");
      setRefreshJob({ status: "error", error: offline ? "Scraper server is offline." : err.message, retryAfter: err.retryAfter });
      setHasAttemptedFetch(true);
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
    <Modal onClose={onClose} width="min(96vw, 820px)">
      <div className="flex flex-col h-[85vh] max-h-[720px] w-full bg-white overflow-hidden min-w-0">
        {/* Header + tabs */}
        <div className="p-3.5 sm:p-5 pb-3 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white shrink-0">
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full shadow-2xs max-w-full truncate">
                <Sparkles size={11} className="text-teal-600 shrink-0" />
                <span className="truncate">Cabin Selection · Live Staterooms</span>
              </div>
              <h2 className="text-sm sm:text-lg md:text-xl font-black text-slate-900 tracking-tight leading-snug break-words">
                {row.package || "Cruise Stateroom Inventory"}
              </h2>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs text-slate-600 pt-0.5">
                <span className="font-bold text-slate-900 bg-slate-100 px-2 sm:px-2.5 py-0.5 rounded-md border border-slate-200/70 text-xs truncate max-w-[180px]">
                  {row.ship}
                </span>
                {row.vendor?.name && (
                  <span className="font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60 text-xs truncate max-w-[150px]">
                    {row.vendor.name}
                  </span>
                )}
                {row.cruiseLine && (
                  <span className="font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60 text-xs truncate max-w-[150px]">
                    {CRUISE_LINE_LABELS[row.cruiseLine] ?? row.cruiseLine}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Category Tab Pills with Responsive Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2 pt-1">
            {cabinGroups.map(({ group, minPrice }) => {
              const isActive = group === activeGroup;
              return (
                <button
                  key={group}
                  onClick={() => handleGroupChange(group)}
                  className={`flex flex-col items-start justify-center px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-left transition-all cursor-pointer min-w-0 active:scale-[0.97] ${isActive
                    ? "bg-teal-700 text-white shadow-md shadow-teal-700/25 ring-2 ring-teal-600 font-bold"
                    : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-2xs"
                    }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs leading-tight truncate">{group}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-teal-300 ml-1 shrink-0" />}
                  </div>
                  {minPrice != null ? (
                    <span
                      className={`text-[10px] sm:text-[10.5px] font-mono mt-0.5 truncate w-full ${isActive ? "text-teal-100 font-semibold" : "text-slate-500 font-medium"
                        }`}
                    >
                      from {safeCurrency(minPrice, row.currency)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 mt-0.5">--</span>
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
            className="fixed inset-0 z-9999 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <button
              onClick={() => setDeckImageUrl(null)}
              className="absolute top-5 right-5 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition cursor-pointer"
            >
              <X size={20} />
            </button>
            {deckImageUrl ? (
              <img
                src={deckImageUrl}
                alt="Deck plan"
                onClick={(e) => e.stopPropagation()}
                className="max-w-[92vw] max-h-[88vh] rounded-xl object-contain shadow-2xl border border-white/10"
              />
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
              >
                <ImageIcon size={44} className="text-slate-600" />
                <p className="text-white font-bold text-sm">No deck image available</p>
                <p className="text-slate-400 text-xs">Upload a deck plan via Ship Decks management</p>
              </div>
            )}
          </div>
        )}

        {/* Category + cabin list (fixed flex-1 scrollable area) */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0 bg-white">
          {cabinGroups.length === 0 && (
            <LeadInDetailsPanel
              job={refreshJob}
              minPrice={null}
              currency={row.currency}
              onGetDetails={handleGetFullDetails}
              hasAttemptedFetch={hasAttemptedFetch}
              onForceCheck={handleForceCheck}
            />
          )}
          {isLeadInOnly && (
            <LeadInDetailsPanel
              job={refreshJob}
              minPrice={leadInMinPrice}
              currency={row.currency}
              onGetDetails={handleGetFullDetails}
              hasAttemptedFetch={hasAttemptedFetch}
              onForceCheck={handleForceCheck}
            />
          )}
          {!isLeadInOnly && cabinGroups.length > 0 && (!activeData || (activeData.categories || []).length === 0) && (
            <div className="py-14 px-8 flex flex-col items-center gap-4 text-center max-w-sm mx-auto text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                <Search size={22} />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">No cabins in this category</div>
                <div className="text-xs text-slate-400 mt-1">
                  Select another cabin tier tab above or refresh live vendor inventory.
                </div>
              </div>
            </div>
          )}
          {!isLeadInOnly && activeData?.categories?.map((cat) => {
            const isExpanded = expandedCategory === cat.code;
            const isGTY = cat.avlResult === "GTY" || cat.status === "Guarantee";
            const cache = cabinCache[cat.code];
            const hasRealCabinData = (cat.cabins ?? []).length > 0;
            const realCabinCount = (cat.cabins ?? []).length;
            const avail = hasRealCabinData ? realCabinCount : (cat.avail ?? cat.available ?? 0);
            const effectiveStatus = hasRealCabinData
              ? (realCabinCount > 0 ? "Available" : "Sold Out")
              : (cat.status && cat.status !== "Unknown"
                ? cat.status
                : (avail > 0 ? "Available" : "Unavailable"));

            const categoryPrice = [
              cat.cabinPrice,
              cat.price,
              cat.perPersonPrice,
              cat.totalPrice,
              cat.minPrice,
              activeData?.minPrice
            ].find(p => p != null && Number.isFinite(Number(p)) && Number(p) > 0);

            return (
              <div key={cat.code} className="transition-colors">
                {/* Category row */}
                <button
                  onClick={() => handleCategoryClick(cat)}
                  className={`w-full flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 px-4 sm:px-5 text-left gap-2 sm:gap-3 transition-all cursor-pointer active:scale-[0.995] ${isExpanded
                      ? "bg-teal-50/60 border-l-4 border-l-teal-600 shadow-xs ring-1 ring-teal-500/10"
                      : "bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent"
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className={`font-mono font-bold text-xs px-2.5 py-1 rounded-lg shrink-0 transition-colors ${isExpanded
                          ? "bg-teal-700 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-800 border border-slate-200/80"
                        }`}
                    >
                      {cat.code}
                    </span>
                    <span className={`text-xs font-semibold truncate ${isExpanded ? "text-slate-900 font-bold" : "text-slate-800"}`}>
                      {cat.name ?? cat.description}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
                    {categoryPrice != null && Number(categoryPrice) > 0 && (
                      <span className="font-mono font-black text-xs text-slate-900 bg-slate-100/90 px-2.5 py-0.5 rounded-md border border-slate-200/70">
                        {safeCurrency(categoryPrice, row.currency)}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                      {avail} avail
                    </span>
                    <StatusPill status={effectiveStatus} />
                    <div className={`p-1 rounded-lg transition-all ${isExpanded ? "bg-teal-100 text-teal-800" : "text-slate-400"}`}>
                      {isExpanded ? (
                        <ChevronUp size={15} className="shrink-0" />
                      ) : (
                        <ChevronDown size={15} className="shrink-0" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded: deck list */}
                {isExpanded && (
                  <div className="bg-slate-50/50 border-t border-slate-200/70 p-3 sm:p-4 space-y-3">
                    {isGTY ? (
                      <div className="p-4 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-600 italic">
                        Guarantee — specific cabin assigned at time of sailing.
                      </div>
                    ) : cache?.loading ? (
                      <div className="p-3 space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <Skeleton className="h-3.5 w-32 bg-slate-300" />
                          <Skeleton className="h-3.5 w-20 bg-slate-200" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-3 rounded-xl border border-slate-200/80 bg-white space-y-2">
                              <Skeleton className="h-4 w-24 bg-slate-300" />
                              <Skeleton className="h-3 w-16 bg-slate-200" />
                              <Skeleton className="h-5 w-20 bg-teal-200/70" />
                            </div>
                          ))}
                        </div>
                      </div>

                    ) : cache?.error ? (
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-2">
                        <p className="font-bold">Failed to load cabin inventory.</p>
                        <RefreshBanner
                          job={refreshJob}
                          onRefresh={() => handleRefresh(cat.code)}
                        />
                      </div>
                    ) : !cache || cache.decks.length === 0 ? (
                      <div className="rounded-xl bg-white border border-slate-200/80 p-3">
                        <RefreshBanner
                          job={refreshJob}
                          onRefresh={() => handleRefresh(cat.code)}
                        />
                      </div>
                    ) : (
                      <>
                        {cache.decks.map((deck) => {
                          const deckKey = String(deck.deckNumber ?? deck.deckName);
                          const isDeckOpen = expandedDecks.has(deckKey);
                          return (
                            <div
                              key={deckKey}
                              className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs"
                            >
                              {/* Deck header */}
                              <div className="flex items-center justify-between p-3 px-4 bg-slate-50/80 border-b border-slate-100">
                                <button
                                  onClick={() => toggleDeck(deckKey)}
                                  className="flex-1 flex items-center gap-2 text-left cursor-pointer"
                                >
                                  {isDeckOpen ? (
                                    <ChevronDown size={14} className="text-slate-600 shrink-0" />
                                  ) : (
                                    <ChevronRight size={14} className="text-slate-600 shrink-0" />
                                  )}
                                  <span className="font-bold text-xs text-slate-900">
                                    {deck.deckName}
                                  </span>
                                  <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200/60 px-2 py-0.2 rounded-md">
                                    {deck.cabins.length} cabin{deck.cabins.length !== 1 ? "s" : ""}
                                  </span>
                                </button>

                                <button
                                  onClick={() => setDeckImageUrl(deck.deckImage || "")}
                                  title={deck.deckImage ? "View deck plan" : "No deck image uploaded"}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                                >
                                  <ImageIcon size={12} className="text-teal-700" />
                                  <span>Deck Plan</span>
                                </button>
                              </div>

                              {/* Multi-column Stateroom Cards Grid */}
                              {isDeckOpen && (
                                <div className="p-3 bg-slate-50/30">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {deck.cabins.map((cabin) => (
                                      <div
                                        key={cabin.cabinNumber}
                                        className="flex items-center justify-between p-2 px-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:border-teal-400 hover:bg-teal-50/20 transition-all duration-150"
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-mono font-black text-slate-900 text-xs">
                                            {cabin.cabinNumber}
                                          </span>
                                          {cabin.capacity && (
                                            <span className="text-[9.5px] text-slate-400 font-medium">
                                              {cabin.capacity}p
                                            </span>
                                          )}
                                        </div>
                                        <StatusPill status={cabin.status} />
                                      </div>
                                    ))}
                                  </div>
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
      <div className="p-4 sm:p-6 border-b border-slate-200 flex items-start justify-between gap-3 bg-gradient-to-b from-slate-50/80 to-white">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full inline-block">Cruise Tags & Assignments</div>
          <h2 className="text-base sm:text-xl font-black text-slate-900 leading-snug break-words">{row.package || "Cruise Booking"}</h2>
          <div className="text-xs text-slate-500 font-mono truncate">{getCruiseDisplayId(row)} · {getCruiseRouteLabel(row)}</div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 overflow-y-auto max-h-[75vh]">
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Saved tags ({tags.length})</div>
          {tags.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-slate-400 text-center text-xs font-medium bg-slate-50/50">
              No tags yet for this cruise.
            </div>
          ) : (
            tags.map((tagItem) => (
              <div key={tagItem.id} className="border border-slate-200/90 rounded-xl p-3.5 bg-white shadow-2xs space-y-2.5">
                <div className="flex justify-between gap-2.5 items-start">
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        style={{ backgroundColor: `${tagItem.color || defaultColor}15`, color: tagItem.color || defaultColor }}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      >
                        <Tag size={11} />
                        <span className="truncate max-w-[150px]">{tagItem.label}</span>
                      </span>
                      {tagItem.assignedTo ? (
                        <span className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200/60 rounded-full px-2 py-0.5 font-medium truncate max-w-[120px]">
                          {tagItem.assignedTo}
                        </span>
                      ) : null}
                    </div>
                    {tagItem.note ? (
                      <div className="text-xs text-slate-600 leading-relaxed break-words">{tagItem.note}</div>
                    ) : null}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => startEdit(tagItem)}
                      className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(tagItem.id)}
                      disabled={saving}
                      className="border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-slate-50/80 flex flex-col gap-3.5">
          <div>
            <div className="text-sm font-bold text-slate-900">
              {editingTagId ? "Edit tag" : "Add new tag"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Mark this cruise and assign to team members for follow up.
            </div>
          </div>

          <input
            value={form.label}
            onChange={(event) => setForm(current => ({ ...current, label: event.target.value }))}
            placeholder="Tag label (e.g. Employee Booking, VIP Lead)"
            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
          />

          <select
            value={form.assignedTo}
            onChange={(event) => setForm(current => ({ ...current, assignedTo: event.target.value }))}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 cursor-pointer"
          >
            <option value="">Select Assignee (Optional)</option>
            {assigneeOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-600">Tag Color:</span>
            <input
              type="color"
              value={form.color}
              onChange={(event) => setForm(current => ({ ...current, color: event.target.value }))}
              className="w-10 h-8 rounded-lg border border-slate-200 bg-white p-0.5 cursor-pointer"
            />
          </div>

          <textarea
            value={form.note}
            onChange={(event) => setForm(current => ({ ...current, note: event.target.value }))}
            placeholder="Optional note / client details..."
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 resize-y"
          />

          <div className="flex gap-2 justify-end pt-1">
            {editingTagId ? (
              <button
                onClick={resetForm}
                disabled={saving}
                className="border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer transition"
              >
                Cancel
              </button>
            ) : null}
            <button
              onClick={submit}
              disabled={saving || !form.label.trim()}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition shadow-2xs disabled:opacity-50"
            >
              {saving ? "Saving..." : editingTagId ? "Update Tag" : "Save Tag"}
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
    horizonDays: null,
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
    horizonDays: null,
    nights: "",
    route: "",
    portFrom: "",
    portTo: "",
  });
  const [sortBy, setSortBy] = useState("refreshed");
  const [datePreset, setDatePreset] = useState("All Dates");

  // Targeted Individual Ship Live Search / Scrape State
  const [targetStartDate, setTargetStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [targetHorizonDays, setTargetHorizonDays] = useState(30);
  const [targetShipName, setTargetShipName] = useState("");
  const [targetVendor, setTargetVendor] = useState("");
  const [targetVendorShips, setTargetVendorShips] = useState([]);
  const [targetShipsLoading, setTargetShipsLoading] = useState(false);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [scraperStatus, setScraperStatus] = useState(null);
  const [highlightedRowId, setHighlightedRowId] = useState(null);
  const [lastSearchedShip, setLastSearchedShip] = useState("");

  const scrollToRow = (cruiseId) => {
    if (!cruiseId) return;
    setHighlightedRowId(cruiseId);
    setTimeout(() => {
      const el = document.getElementById(`cruise-row-${cruiseId}`) || document.getElementById(`cruise-card-${cruiseId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    setTimeout(() => {
      setHighlightedRowId((prev) => (prev === cruiseId ? null : prev));
    }, 4000);
  };

  // Initialize filters from URL search params (e.g. ?ship=MSC+Preziosa&vendor=MSC)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialShip = params.get("ship") || params.get("shipName") || "";
    const initialVendor = params.get("vendor") || params.get("vendorName") || "";
    const initialCode = params.get("code") || params.get("search") || "";
    if (initialShip || initialVendor || initialCode) {
      const nextFilters = {
        ship: initialShip,
        vendor: initialVendor,
        code: initialCode
      };
      setFilters(prev => ({ ...prev, ...nextFilters }));
      setAppliedFilters(prev => ({ ...prev, ...nextFilters }));
      if (initialShip) {
        setTargetShipName(initialShip);
      }
      if (initialVendor) {
        setTargetVendor(initialVendor);
      }
    }
  }, []);

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
          sortBy: sortBy === "refreshed" ? "updatedAt" : sortBy === "departure" ? "startDate" : sortBy === "price_asc" || sortBy === "price_desc" ? "price" : "updatedAt",
          sortOrder: sortBy === "price_asc" || sortBy === "departure" ? "asc" : "desc",
          search: appliedFilters.code || undefined,
          vendorName: appliedFilters.vendor || undefined,
          ship: appliedFilters.ship || undefined,
          shipName: appliedFilters.ship || undefined,
          cruiseLine: appliedFilters.cruiseLine || undefined,
          nights: appliedFilters.nights || undefined,
          route: appliedFilters.route || undefined,
          portFrom: appliedFilters.portFrom || undefined,
          portTo: appliedFilters.portTo || undefined,
          startDateFrom: appliedFilters.startDate || undefined,
          startDateTo: appliedFilters.endDate || undefined,
          startDate: appliedFilters.startDate || undefined,
          horizonDays: appliedFilters.horizonDays || undefined,
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
  }, [appliedFilters, page, sortBy]);

  useEffect(() => {
    let active = true;

    const loadLookups = async () => {
      try {
        const [tagResponse, vendorResponse, shipResponse, userResponse] = await Promise.all([
          fetchCruiseTags().catch(() => ({ data: {} })),
          fetchVendors({ limit: 100 }).catch(() => ({ data: [] })),
          fetchShips({ limit: 300 }).catch(() => ({ data: [] })),
          fetchUsers().catch(() => ({ data: [] }))
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
          console.warn("Failed to load search cruise lookups:", err?.message || err);
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

  // Auto-initialize targetVendor when lookupOptions.vendors is loaded
  useEffect(() => {
    if (!targetVendor && lookupOptions.vendors.length > 0) {
      setTargetVendor(lookupOptions.vendors[0].name);
    }
  }, [lookupOptions.vendors, targetVendor]);

  // Auto-fetch ships belonging to the selected targeted vendor
  useEffect(() => {
    let active = true;
    if (!targetVendor) {
      setTargetVendorShips([]);
      return () => { active = false; };
    }
    const selectedVendor = lookupOptions.vendors.find((v) => v.name === targetVendor);
    if (!selectedVendor) {
      const fallback = [...new Set(lookupOptions.allShips.map((s) => s.name).filter(Boolean))];
      setTargetVendorShips(fallback);
      return () => { active = false; };
    }

    setTargetShipsLoading(true);
    fetchShips({ vendorId: selectedVendor.id, limit: 300 })
      .then((res) => {
        if (!active) return;
        const list = (res.data || []).map((s) => s.name).filter(Boolean);
        const unique = [...new Set(list)];
        setTargetVendorShips(unique);
        // Automatically select the 1st ship if current targetShipName is empty or not in this vendor's fleet
        if (unique.length > 0 && (!targetShipName || !unique.includes(targetShipName))) {
          setTargetShipName(unique[0]);
        }
      })
      .catch((err) => {
        if (active) console.error("Failed to load ships for vendor:", err);
      })
      .finally(() => {
        if (active) setTargetShipsLoading(false);
      });

    return () => { active = false; };
  }, [targetVendor, lookupOptions.vendors]);

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

  const rows = useMemo(() => {
    return [...data].sort((a, b) => {
      // Pinned / tagged cruises stay at top if any
      const tagDiff = (b.tags?.length || 0) - (a.tags?.length || 0);
      if (tagDiff !== 0) return tagDiff;

      if (sortBy === "refreshed") {
        const timeA = new Date(a.cabinsUpdatedAt ?? a.updatedAt ?? a.createdAt ?? 0).getTime();
        const timeB = new Date(b.cabinsUpdatedAt ?? b.updatedAt ?? b.createdAt ?? 0).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      }
      if (sortBy === "departure") {
        const getDepTime = (item) => {
          const val = item.startDate || item.departureDate || item.sailDate || item.date;
          if (!val) return Infinity;
          const t = new Date(val).getTime();
          return isNaN(t) ? Infinity : t;
        };
        return getDepTime(a) - getDepTime(b);
      }
      if (sortBy === "price_asc") {
        const getP = (item) => {
          const prices = (item.cabinCategories || []).map(c => Number(c.cabinPrice ?? c.price)).filter(p => Number.isFinite(p) && p > 0);
          const p = prices.length > 0 ? Math.min(...prices) : (Number(item.price ?? item.leadInPrice) || Infinity);
          return Number.isFinite(p) && p > 0 ? p : Infinity;
        };
        return getP(a) - getP(b);
      }
      if (sortBy === "price_desc") {
        const getP = (item) => {
          const prices = (item.cabinCategories || []).map(c => Number(c.cabinPrice ?? c.price)).filter(p => Number.isFinite(p) && p > 0);
          const p = prices.length > 0 ? Math.min(...prices) : (Number(item.price ?? item.leadInPrice) || -Infinity);
          return Number.isFinite(p) && p > 0 ? p : -Infinity;
        };
        return getP(b) - getP(a);
      }
      if (sortBy === "avail") {
        const getAvail = (item) => {
          const count = (item.cabinCategories || []).filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0)).length;
          return count || Number(item.seatsAvailable ?? 0);
        };
        return getAvail(b) - getAvail(a);
      }
      return 0;
    });
  }, [data, sortBy]);

  const setF = (key, value) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "startDate" && current.horizonDays) {
        if (value) {
          const base = new Date(value);
          const end = new Date(base.getTime() + current.horizonDays * 86400000);
          next.endDate = end.toISOString().slice(0, 10);
        }
      }
      if (key !== "code" && key !== "ship") {
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
    let startDate = filters.startDate || new Date().toISOString().slice(0, 10);
    let endDate = "";
    if (preset.days != null) {
      const base = filters.startDate ? new Date(filters.startDate) : new Date();
      const end = new Date(base.getTime() + preset.days * 86400000);
      const toInputDate = (d) => d.toISOString().slice(0, 10);
      endDate = toInputDate(end);
    }
    setFilters((current) => {
      const next = {
        ...current,
        startDate: preset.days == null ? current.startDate : (current.startDate || startDate),
        endDate,
        horizonDays: preset.days
      };
      setAppliedFilters(next);
      setPage(1);
      return next;
    });
  };

  const reset = () => {
    const empty = { code: "", vendor: "", ship: "", cruiseLine: "", startDate: "", endDate: "", horizonDays: null, nights: "", route: "", portFrom: "", portTo: "" };
    setFilters(empty);
    setAppliedFilters(empty);
    setDatePreset("All Dates");
    setPage(1);
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    setPage(1);
  };

  const handleTargetedSearch = () => {
    const trimmedShip = targetShipName.trim();
    const base = targetStartDate ? new Date(targetStartDate) : new Date();
    const end = new Date(base.getTime() + targetHorizonDays * 86400000);
    const toInputDate = (d) => d.toISOString().slice(0, 10);
    const endDate = toInputDate(end);

    setLastSearchedShip(trimmedShip || targetVendor || "ship");

    const nextFilters = {
      ...filters,
      ship: trimmedShip,
      vendor: targetVendor || filters.vendor,
      startDate: targetStartDate,
      endDate: endDate,
      horizonDays: targetHorizonDays,
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setDatePreset(`${targetHorizonDays} Days`);
    setPage(1);
  };

  const handleTriggerScraper = async () => {
    const trimmedShip = targetShipName.trim();
    const vendorKey = VENDOR_SCRAPER_MAP[targetVendor] || (targetVendor ? targetVendor.toLowerCase() : "msc");
    setScraperLoading(true);
    setScraperStatus(null);
    try {
      const res = await triggerVendorScrapeFetch(vendorKey, {
        startDate: targetStartDate,
        horizonDays: targetHorizonDays,
        ...(trimmedShip ? { shipName: trimmedShip } : {}),
      });
      const ok = res.httpStatus === 202 || res.result?.status === "queued" || res.result?.status === "started" || res.success;
      const rawStatus = res.result?.status || res.status;
      let displayMsg = "Searched";
      if (rawStatus === "queued" || rawStatus === "started" || rawStatus === "in_progress" || ok) {
        displayMsg = `Searched: Live inventory scan initiated for ${targetVendor || vendorKey}${trimmedShip ? ` (Ship: ${trimmedShip})` : ""}`;
      } else {
        displayMsg = res.error ?? "Live search triggered";
      }

      setScraperStatus({
        ok,
        msg: displayMsg
      });
      handleTargetedSearch();
    } catch (err) {
      setScraperStatus({ ok: false, msg: err.message || "Failed to trigger scraper" });
    } finally {
      setScraperLoading(false);
    }
  };

  // Debounce keyword and ship search inputs so typing naturally filters after short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.code !== appliedFilters.code || filters.ship !== appliedFilters.ship) {
        setAppliedFilters((current) => ({
          ...current,
          code: filters.code,
          ship: filters.ship
        }));
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [filters.code, filters.ship, appliedFilters.code, appliedFilters.ship]);

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
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/90 backdrop-blur-xs px-3.5 py-1 text-[11px] font-bold text-teal-800 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
              </span>
              <span>Inventory Manager · Live Database</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Cruise Search & Inventory Explorer
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">
              Paginated cruise inventory from the database with ship drilldown, real-time cabin category pricing, and booking tags.
            </p>
          </div>

          {/* Stat Counter Chips */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-teal-200/70 bg-white/90 hover:bg-white px-4 py-2.5 shadow-2xs min-w-[125px] transition-all hover:border-teal-300">
              <div className="p-2 rounded-lg bg-teal-100/70 text-teal-700">
                <Ship size={17} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Cruises</span>
                <span className="text-xl font-black text-slate-900 font-mono tracking-tight">{overview.cruises?.toLocaleString() ?? 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-teal-200/70 bg-white/90 hover:bg-white px-4 py-2.5 shadow-2xs min-w-[125px] transition-all hover:border-teal-300">
              <div className="p-2 rounded-lg bg-sky-100/70 text-sky-700">
                <Compass size={17} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Ships</span>
                <span className="text-xl font-black text-slate-900 font-mono tracking-tight">{overview.ships?.toLocaleString() ?? 0}</span>
              </div>
            </div>
            {opts.ports?.length > 0 && (
              <div className="hidden sm:flex items-center gap-3 rounded-xl border border-teal-200/70 bg-white/90 hover:bg-white px-4 py-2.5 shadow-2xs min-w-[125px] transition-all hover:border-teal-300">
                <div className="p-2 rounded-lg bg-emerald-100/70 text-emerald-700">
                  <MapPin size={17} />
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

      {/* ── Separate Targeted Individual Ship Search & Live Scraper Card ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow duration-300 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 text-white flex items-center justify-center shadow-sm shadow-teal-700/20 ring-4 ring-teal-50 shrink-0">
              <Ship size={19} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                <span>Targeted Individual Ship Search</span>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full">
                  <Sparkles size={11} className="text-teal-600" />
                  Ship + Dates + Horizon
                </span>
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Quickly query specific ship sailings by start date & horizon window, or dispatch on-demand live scraper workers.
              </p>
            </div>
          </div>

          {/* Active Query JSON preview badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] shadow-sm border border-slate-800">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
            <span className="text-teal-400 font-bold">query:</span>
            <span className="text-slate-300">{`{ startDate: "${targetStartDate}", horizonDays: ${targetHorizonDays}${targetShipName ? `, shipName: "${targetShipName}"` : ""} }`}</span>
          </div>
        </div>

        {/* 4 Main Inputs Grid: Vendor first (mandatory), then Ship (auto-fetched), Start Date, Search Horizon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          {/* 1. Vendor / Cruise Line Provider (Mandatory) */}
          <div className="sm:col-span-1 lg:col-span-3 space-y-1.5">
            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <Building2 size={13} className="text-teal-600" />
              <span>Cruise Line / Vendor <span className="text-rose-500">*</span></span>
            </label>
            <select
              value={targetVendor}
              onChange={(e) => setTargetVendor(e.target.value)}
              required
              className="w-full h-10 px-3.5 rounded-xl border border-teal-300/80 bg-white hover:bg-slate-50 focus:bg-white text-xs sm:text-sm font-semibold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
            >
              {opts.vendors.length === 0 ? (
                <option value="">Loading providers…</option>
              ) : (
                opts.vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Ship Name (Search & Select from Auto-fetched Fleet) */}
          <div className="sm:col-span-1 lg:col-span-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <Ship size={13} className="text-teal-600" />
                <span>Ship Name <span className="text-rose-500">*</span></span>
              </label>
              <span className="text-[10.5px] font-semibold text-teal-700">
                {targetShipsLoading ? "Loading…" : `${targetVendorShips.length} ship${targetVendorShips.length === 1 ? "" : "s"}`}
              </span>
            </div>
            <SearchableSelect
              placeholder={targetShipsLoading ? "Loading fleet ships…" : `Type or select ship (${targetVendorShips.length})`}
              value={targetShipName}
              onChange={(val) => setTargetShipName(val)}
              options={targetVendorShips}
              onEnter={handleTargetedSearch}
            />
          </div>

          {/* 3. Start Date */}
          <div className="sm:col-span-1 lg:col-span-2 space-y-1.5">
            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <CalendarDays size={13} className="text-teal-600" />
              <span>Start Date</span>
            </label>
            <input
              type="date"
              value={targetStartDate}
              onChange={(e) => setTargetStartDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-xs sm:text-sm font-semibold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
            />
          </div>

          {/* 4. Horizon Days Selector */}
          <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <Compass size={13} className="text-teal-600" />
                <span>Search Horizon</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-500">{targetHorizonDays} Days Horizon</span>
            </div>
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 gap-1 overflow-x-auto no-scrollbar">
              {[
                { label: "1 Day", days: 1 },
                { label: "7 Days", days: 7 },
                { label: "30 Days", days: 30 },
                { label: "60 Days", days: 60 },
                { label: "3 Months", days: 90 },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.days}
                  onClick={() => setTargetHorizonDays(opt.days)}
                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex-1 min-w-[54px] shrink-0 ${targetHorizonDays === opt.days
                    ? "bg-white text-teal-800 font-bold shadow-xs border border-slate-200/90"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Row & Live Scraper Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Active selection summary badge */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 py-1">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse shrink-0" />
            <span className="truncate">
              Targeting: <strong className="text-teal-900">{targetVendor || "Select Vendor"}</strong> · <strong className="text-slate-900">{targetShipName || "All Ships"}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleTargetedSearch}
              disabled={loading || !targetVendor}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-75 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm active:scale-95 transition-all cursor-pointer flex-1 sm:flex-initial"
            >
              {loading ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Search size={15} />
              )}
              <span>{loading ? "Searching Inventory…" : "Search Ship Inventory"}</span>
            </button>

            {!loading && rows.length > 0 && (appliedFilters.ship || lastSearchedShip) && (
              <button
                type="button"
                onClick={() => scrollToRow(rows[0]?.id)}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs sm:text-sm font-bold shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer animate-in fade-in slide-in-from-top-1"
                title={`Jump to row: ${rows[0]?.ship || "1st match"}`}
              >
                <ArrowDown size={14} className="text-emerald-700 animate-bounce" />
                <span>Go to Sailing ({rows[0]?.ship || "1st Match"})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleTriggerScraper}
              disabled={scraperLoading || !targetVendor}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm active:scale-95 transition-all cursor-pointer flex-1 sm:flex-initial"
              title="Dispatch scraper worker with { startDate, horizonDays, shipName }"
            >
              {scraperLoading ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Zap size={15} className="text-emerald-200" />
              )}
              <span>{scraperLoading ? "Triggering Scraper…" : "Run Live Scraper"}</span>
            </button>
          </div>
        </div>

        {/* Live Scraper feedback alert if triggered */}
        {scraperStatus && (
          <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs ${scraperStatus.ok
            ? "bg-emerald-50 text-emerald-900 border border-emerald-200/80"
            : "bg-rose-50 text-rose-900 border border-rose-200/80"
            }`}>
            <div className="flex items-center gap-2">
              {scraperStatus.ok ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-rose-600 shrink-0" />}
              <span>{scraperStatus.msg}</span>
            </div>
            <button
              type="button"
              onClick={() => setScraperStatus(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* ── Filter Form Card ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow duration-300 space-y-5">
        {/* Cruise Code or Keyword Search */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Search size={14} className="text-teal-600" />
              <span>Cruise Code or Keyword</span>
            </label>
            <span className="text-[11px] text-slate-400 font-normal">e.g. CJ07260801, Seaside, Mediterranean</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            <input
              type="text"
              placeholder="Search by cruise code, ship name, package title or route..."
              value={filters.code}
              onChange={(event) => setF("code", event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }}
              className="w-full h-11 pl-10 pr-16 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all shadow-2xs"
            />
            {filters.code && (
              <button
                type="button"
                onClick={() => setF("code", "")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Cruise Line Provider Tabs */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Layers size={14} className="text-teal-600" />
              <span>Cruise Line Provider</span>
            </label>
            {filters.vendor && (
              <button
                type="button"
                onClick={() => selectVendor("")}
                className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold cursor-pointer transition-colors"
              >
                Reset Provider
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap scroll-smooth no-scrollbar">
            <button
              type="button"
              onClick={() => selectVendor("")}
              className={`h-9 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${filters.vendor === ""
                ? "bg-teal-700 text-white font-bold shadow-xs border border-teal-700"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-2xs"
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
                  className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${isSelected
                    ? "bg-teal-700 text-white font-bold shadow-xs border border-teal-700 scale-[1.01]"
                    : "bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80 shadow-2xs"
                    }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-white ring-2 ring-teal-400" : vStyle.dot}`} />
                    <span>{value}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 Multi-Select Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {[
            { key: "ship", label: "Ship", ph: "Select Ship", mode: "input", values: opts.ships, icon: Ship, iconColor: "text-sky-600" },
            { key: "cruiseLine", label: "Cruise Line", ph: "Select Cruise Line (All)", mode: "select", values: opts.cruiseLines, icon: Compass, iconColor: "text-teal-600" },
            { key: "portFrom", label: "Departure Port (Origin)", ph: "Departure Port (From)", mode: "select", values: opts.ports, icon: MapPin, iconColor: "text-emerald-600" },
            { key: "portTo", label: "Destination Port", ph: "Destination Port (To)", mode: "select", values: opts.ports, icon: MapPin, iconColor: "text-indigo-600" },
          ].map((field) => {
            const Icon = field.icon;
            return field.mode === "input" ? (
              <div key={field.key} className="space-y-1.5">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Icon size={14} className={field.iconColor} />
                  <span>{field.label}</span>
                </label>
                <SearchableSelect
                  placeholder={field.ph}
                  value={filters[field.key]}
                  onChange={(value) => setF(field.key, value)}
                  options={field.values}
                  onEnter={applyFilters}
                />
              </div>
            ) : (
              <div key={field.key} className="space-y-1.5">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Icon size={14} className={field.iconColor} />
                  <span>{field.label}</span>
                </label>
                <select
                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white px-3.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all shadow-2xs cursor-pointer"
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
              </div>
            );
          })}
        </div>

        {/* Departure Window */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <CalendarDays size={14} className="text-teal-600" />
              <span>Departure Window</span>
            </label>
            {(filters.startDate || filters.endDate || (datePreset && datePreset !== "All Dates")) && (
              <span className="text-[11px] text-teal-700 font-semibold">
                {datePreset && datePreset !== "All Dates" ? datePreset : `${filters.startDate || "Any"} → ${filters.endDate || "Any"}`}
              </span>
            )}
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Presets */}
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 gap-1 overflow-x-auto no-scrollbar">
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
                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${isActive
                      ? "bg-white text-teal-800 font-bold shadow-xs border border-slate-200/90"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                      }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Range Picker */}
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <input
                type="date"
                className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white px-3 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
                value={filters.startDate}
                onChange={(event) => { setF("startDate", event.target.value); setDatePreset(null); }}
              />
              <span className="text-xs font-medium text-slate-400">to</span>
              <input
                type="date"
                className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white px-3 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all cursor-pointer"
                value={filters.endDate}
                onChange={(event) => { setF("endDate", event.target.value); setDatePreset(null); }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={applyFilters}
              disabled={loading}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-75 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow active:scale-95 transition-all cursor-pointer"
            >
              {loading ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Search size={15} />
              )}
              <span>{loading ? "Searching Inventory…" : "Search Inventory"}</span>
            </button>
            {!loading && rows.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToRow(rows[0]?.id)}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-teal-800 text-xs sm:text-sm font-semibold shadow-2xs active:scale-95 transition-all cursor-pointer animate-in fade-in"
              >
                <ArrowDown size={14} className="text-teal-600" />
                <span>Go to 1st Result</span>
              </button>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              <RotateCcw size={14} className="text-slate-500" />
              <span>Reset Filters</span>
            </button>
          </div>
          {Object.values(filters).filter(Boolean).length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
              {Object.values(filters).filter(Boolean).length} filter{Object.values(filters).filter(Boolean).length > 1 ? "s" : ""} active
            </span>
          )}
        </div>
      </div>

      {/* ── Results Status Toolbar ──────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="inline-flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
          </span>
          <span className="text-xs font-bold text-slate-900">
            {loading ? "Searching inventory…" : `${(pagination?.total ?? rows.length).toLocaleString()} sailings found`}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500 whitespace-nowrap">Sort by:</span>
            <SortDropdown
              value={sortBy}
              onChange={(newSort) => {
                setSortBy(newSort);
                setPage(1);
              }}
            />
          </div>

          <div className="bg-white px-3 py-1 rounded-md border border-slate-200 text-xs font-semibold text-slate-700 font-mono shadow-2xs whitespace-nowrap">
            Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1}
          </div>
        </div>
      </div>

      {/* ── Table & Mobile List Card ────────────────────────────────────── */}
      {loading ? (
        <CruiseSearchSkeleton rows={8} />
      ) : error ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-12 text-center text-sm font-bold text-rose-600 shadow-xs">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-12 text-center text-sm font-medium text-slate-400 shadow-xs">
          No cruises found.
        </div>
      ) : (
        <>
          {/* ── Mobile / Tablet Separated Card View (block lg:hidden) ─── */}
          <div className="block lg:hidden space-y-3.5">
            {rows.map((row) => {
              const validPrices = (row.cabinCategories || [])
                .map((cabin) => Number(cabin.cabinPrice ?? cabin.price ?? 0))
                .filter((p) => Number.isFinite(p) && p > 0);
              const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : (Number(row.price ?? row.leadInPrice) || NaN);
              const hasFullDetails = (row.cabinCategories || []).some(
                c => c.confidence === "Medium" || c.confidence === "High"
              );
              const isTagged = (row.tags?.length || 0) > 0;
              const canTag = hasFullDetails || isTagged;
              const availableCabins = row.cabinCategories?.filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0)).length ?? 0;
              const vStyle = getVendorStyle(row.vendor?.name);
              const packageTitle = row.package || row.name || row.title || (row.ship ? `${row.ship} Cruise` : "Cruise Sailing");

              return (
                <div
                  key={row.id}
                  id={`cruise-card-${row.id}`}
                  className={`rounded-2xl border bg-white p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-300 space-y-3.5 ${highlightedRowId === row.id
                      ? "ring-2 ring-teal-500 bg-teal-50/90 border-teal-400 shadow-md scale-[1.01]"
                      : isTagged
                        ? "border-amber-300/90 bg-amber-50/20 ring-1 ring-amber-200/60"
                        : "border-slate-200/90 hover:border-teal-300/80"
                    }`}
                >
                  {/* Top bar: Vendor, Cruise Line, Ship badge & Pin */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border whitespace-nowrap shrink-0 ${vStyle.badge}`}>
                        {row.vendor?.name}
                      </span>
                      {row.cruiseLine && (
                        <span className="text-[10.5px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                          {CRUISE_LINE_LABELS[row.cruiseLine] ?? row.cruiseLine}
                        </span>
                      )}
                      <button
                        onClick={() => setShipRow(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Ship size={11} className="text-sky-600 shrink-0" />
                        <span className="whitespace-nowrap">{row.ship}</span>
                      </button>
                    </div>
                    <button
                      onClick={() => canTag ? togglePin(row.id) : null}
                      className={`p-2 rounded-xl transition shrink-0 ${canTag ? "cursor-pointer hover:bg-slate-100" : "cursor-not-allowed opacity-30"
                        } ${isTagged ? "text-amber-600 bg-amber-100/80" : "text-slate-400 bg-slate-50 border border-slate-200/60"}`}
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
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {packageTitle}
                  </h4>

                  {/* Route & Nights */}
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <button
                      onClick={() => setItineraryRow(row)}
                      className="inline-flex items-center gap-1.5 font-semibold text-teal-700 hover:text-teal-900 text-xs cursor-pointer hover:underline underline-offset-2 break-words text-left"
                    >
                      <MapPin size={13} className="shrink-0 text-teal-600" />
                      <span>{getCruiseRouteLabel(row)}</span>
                    </button>
                    {row.nights && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap shrink-0">
                          {row.nights} Nights
                        </span>
                      </>
                    )}
                  </div>

                  {/* Sailing Dates Sub-card */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Departure</div>
                      <div className="font-semibold text-slate-800 mt-0.5 whitespace-nowrap">
                        {fmtDate(row.startDate || row.departureDate || row.sailDate || row.date)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Arrival</div>
                      <div className="font-semibold text-slate-800 mt-0.5 whitespace-nowrap">
                        {fmtDate(row.endDate || row.arrivalDate || row.returnDate)}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Bar: Availability, Refreshed & Price Button */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/90 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 whitespace-nowrap shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="whitespace-nowrap">{availableCabins} cabins available</span>
                      </span>
                      {(() => {
                        const ts = row.cabinsUpdatedAt ?? row.updatedAt ?? row.createdAt;
                        if (!ts) return null;
                        const num = new Date(ts).getTime();
                        const diffSec = Math.round((Date.now() - num) / 1000);
                        return (
                          <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded border ${diffSec < 3600 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200/60"
                            }`}>
                            {fmtFetchedAt(num)}
                          </span>
                        );
                      })()}
                    </div>

                    <button
                      onClick={() => setPricingRow(row)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${Number.isFinite(lowestPrice)
                        ? "bg-teal-700 hover:bg-teal-800 text-white shadow-teal-700/20"
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

          {/* ── Desktop Table View (hidden lg:block) ─────────────────── */}
          <div className="hidden lg:block rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto w-full max-w-full">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["", "Vendor", "Ship", "Cruise", "Nights", "Route", "Departure", "Arrival", "Avail.", "Refreshed", "Price"].map((header) => (
                      <th key={header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {rows.map((row, index) => {
                    const validPrices = (row.cabinCategories || [])
                      .map((cabin) => Number(cabin.cabinPrice ?? cabin.price ?? 0))
                      .filter((p) => Number.isFinite(p) && p > 0);
                    const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : (Number(row.price ?? row.leadInPrice) || NaN);
                    const hasFullDetails = (row.cabinCategories || []).some(
                      c => c.confidence === "Medium" || c.confidence === "High"
                    );
                    const isTagged = (row.tags?.length || 0) > 0;
                    const canTag = hasFullDetails || isTagged;
                    const availableCabins = row.cabinCategories?.filter(c => c.avlResult === "OK" || c.status === "Available" || (Number(c.avail ?? c.available ?? 0) > 0)).length ?? 0;
                    const vStyle = getVendorStyle(row.vendor?.name);

                    return (
                      <tr
                        key={row.id}
                        id={`cruise-row-${row.id}`}
                        className={`transition-all duration-300 ${highlightedRowId === row.id
                            ? "ring-2 ring-teal-500 bg-teal-100/60 font-semibold shadow-sm"
                            : isTagged
                              ? "bg-amber-50/50 hover:bg-slate-50/70"
                              : index % 2 === 0
                                ? "bg-white hover:bg-slate-50/70"
                                : "bg-slate-50/30 hover:bg-slate-50/70"
                          }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => canTag ? togglePin(row.id) : null}
                            className={`p-1 rounded-md transition ${canTag ? "cursor-pointer hover:bg-slate-100" : "cursor-not-allowed opacity-30"
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-0.5 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap shrink-0 ${vStyle.badge}`}>
                              {row.vendor?.name}
                            </span>
                            {row.cruiseLine && (
                              <div className="mt-0.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                                {CRUISE_LINE_LABELS[row.cruiseLine] ?? row.cruiseLine}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => setShipRow(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Ship size={11} className="text-sky-600 shrink-0" />
                            <span className="whitespace-nowrap">{row.ship}</span>
                          </button>
                          <div className="mt-0.5 text-[11px] font-mono text-slate-400 whitespace-nowrap">
                            {getCruiseDisplayId(row)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 max-w-[260px] truncate whitespace-nowrap" title={row.package}>
                          {row.package}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 whitespace-nowrap">
                            {row.nights}N
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => setItineraryRow(row)}
                            className="text-left font-semibold text-teal-700 hover:text-teal-900 hover:underline text-xs decoration-dotted underline-offset-4 cursor-pointer whitespace-nowrap max-w-[280px] truncate block"
                            title={getCruiseRouteLabel(row)}
                          >
                            {getCruiseRouteLabel(row)}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                          {fmtDate(row.startDate || row.departureDate || row.sailDate || row.date)}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                          {fmtDate(row.endDate || row.arrivalDate || row.returnDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 whitespace-nowrap shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="whitespace-nowrap">{availableCabins} avail</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {(() => {
                            const ts = row.cabinsUpdatedAt ?? row.updatedAt ?? row.createdAt;
                            if (!ts) return <span className="text-slate-400 font-medium">—</span>;
                            const num = new Date(ts).getTime();
                            const diffSec = Math.round((Date.now() - num) / 1000);
                            const isRecent = diffSec < 86400;
                            return (
                              <span
                                title={new Date(ts).toLocaleString()}
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${diffSec < 3600
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : isRecent
                                    ? "bg-teal-50 text-teal-800 border-teal-200"
                                    : "bg-slate-50 text-slate-600 border-slate-200/70"
                                  }`}
                              >
                                {fmtFetchedAt(num)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => setPricingRow(row)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${Number.isFinite(lowestPrice)
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
          </div>
        </>
      )}


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
                    className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${pageNumber === (pagination?.page ?? 1)
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
