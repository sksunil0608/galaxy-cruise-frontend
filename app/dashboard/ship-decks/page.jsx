"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Anchor,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileText,
  HelpCircle,
  ImageIcon,
  Layers,
  Link2,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Ship,
  Sparkles,
  Trash2,
  Upload,
  Utensils,
  Waves,
  X
} from "lucide-react";

import {
  createShipDeck,
  deleteShipDeck,
  fetchShip,
  fetchShips,
  updateShipDeck
} from "../api";

const SECTION_TYPE_PRESETS = [
  "Cabins",
  "Suites",
  "Dining",
  "Pool & Sun Deck",
  "Entertainment",
  "Bar & Lounge",
  "Wellness & Spa",
  "Public Area",
  "Promenade"
];

const createEmptySection = () => ({
  title: "",
  sectionType: "Cabins",
  cabinCodes: "",
  description: ""
});

const createEmptyForm = () => ({
  id: null,
  name: "",
  deckNumber: "",
  description: "",
  imageUrl: "",
  imageData: "",
  imageFileName: "",
  sections: [createEmptySection()]
});

const mapDeckToForm = deck => ({
  id: deck.id,
  name: deck.name || "",
  deckNumber: deck.deckNumber ?? "",
  description: deck.description || "",
  imageUrl: deck.image || "",
  imageData: "",
  imageFileName: "",
  sections:
    deck.sections?.length
      ? deck.sections.map(section => ({
          title: section.title || "",
          sectionType: section.sectionType || "Cabins",
          cabinCodes: Array.isArray(section.cabinCodes) ? section.cabinCodes.join(", ") : "",
          description: section.description || ""
        }))
      : [createEmptySection()]
});

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

export default function ShipDecksPage() {
  const [ships, setShips] = useState([]);
  const [loadingShips, setLoadingShips] = useState(true);
  const [selectedShipCode, setSelectedShipCode] = useState("");
  const [shipData, setShipData] = useState(null);
  const [loadingShip, setLoadingShip] = useState(false);
  const [form, setForm] = useState(createEmptyForm());
  const [imageSourceTab, setImageSourceTab] = useState("file"); // 'file' | 'url'
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deckFilter, setDeckFilter] = useState("");

  useEffect(() => {
    let active = true;

    const loadShips = async () => {
      try {
        setLoadingShips(true);
        const response = await fetchShips({ limit: 100 });

        if (!active) return;

        const nextShips = response.data || [];
        setShips(nextShips);
        setSelectedShipCode(current => current || nextShips[0]?.code || "");
      } catch (err) {
        if (active) setError(err.message || "Failed to load ships");
      } finally {
        if (active) setLoadingShips(false);
      }
    };

    loadShips();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadShip = async () => {
      if (!selectedShipCode) {
        setShipData(null);
        return;
      }

      try {
        setLoadingShip(true);
        setError("");
        const response = await fetchShip(selectedShipCode);

        if (!active) return;

        setShipData(response.data || null);
      } catch (err) {
        if (active) setError(err.message || "Failed to load ship details");
      } finally {
        if (active) setLoadingShip(false);
      }
    };

    loadShip();

    return () => {
      active = false;
    };
  }, [selectedShipCode]);

  const decks = useMemo(() => {
    return Array.isArray(shipData?.decks) ? shipData.decks : [];
  }, [shipData]);

  const filteredDecks = useMemo(() => {
    if (!deckFilter.trim()) return decks;
    const query = deckFilter.toLowerCase();
    return decks.filter(d =>
      (d.name && d.name.toLowerCase().includes(query)) ||
      (d.deckNumber && String(d.deckNumber).includes(query))
    );
  }, [decks, deckFilter]);

  const deckRangeLabel = useMemo(() => {
    if (!decks.length) return "None registered";
    const nums = decks.map(d => Number(d.deckNumber)).filter(n => Number.isFinite(n) && n > 0);
    if (!nums.length) return `${decks.length} deck${decks.length === 1 ? "" : "s"}`;
    return `Decks ${Math.min(...nums)} – ${Math.max(...nums)}`;
  }, [decks]);

  const resetForm = () => {
    setForm(createEmptyForm());
    setMessage("");
    setError("");
  };

  const handleSectionChange = (index, field, value) => {
    setForm(current => {
      const nextSections = [...current.sections];
      nextSections[index] = {
        ...nextSections[index],
        [field]: value
      };
      return { ...current, sections: nextSections };
    });
  };

  const handleImageFile = async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm(current => ({
        ...current,
        imageData: dataUrl,
        imageFileName: file.name,
        imageUrl: ""
      }));
    } catch (err) {
      setError(err.message || "Failed to process image file");
    }
  };

  const reloadShip = async () => {
    if (!selectedShipCode) return;
    const response = await fetchShip(selectedShipCode);
    setShipData(response.data || null);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!selectedShipCode) {
      setError("Please select a ship vessel first.");
      return;
    }

    if (!form.name.trim()) {
      setError("Deck Name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        name: form.name.trim(),
        deckNumber: form.deckNumber === "" ? null : Number(form.deckNumber),
        description: form.description.trim() || null,
        sections: form.sections
          .filter(section => section.title.trim())
          .map(section => ({
            title: section.title.trim(),
            sectionType: section.sectionType.trim() || null,
            cabinCodes: section.cabinCodes
              .split(",")
              .map(code => code.trim())
              .filter(Boolean),
            description: section.description.trim() || null
          }))
      };

      if (form.imageData) {
        payload.image = form.imageData;
      } else if (form.imageUrl) {
        payload.image = form.imageUrl.trim();
      }

      if (form.id) {
        await updateShipDeck(selectedShipCode, form.id, payload);
        setMessage(`Deck "${form.name}" updated successfully.`);
      } else {
        await createShipDeck(selectedShipCode, payload);
        setMessage(`Deck "${form.name}" created successfully.`);
      }

      await reloadShip();
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to save ship deck");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = deck => {
    setForm(mapDeckToForm(deck));
    if (deck.image) {
      setImageSourceTab(deck.image.startsWith("data:") ? "file" : "url");
    }
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async deckId => {
    if (!selectedShipCode || !window.confirm("Are you sure you want to delete this deck plan?")) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await deleteShipDeck(selectedShipCode, deckId);
      await reloadShip();
      if (form.id === deckId) {
        resetForm();
      }
      setMessage("Deck plan deleted successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete deck plan");
    }
  };

  const currentShipObj = ships.find(s => s.code === selectedShipCode) || shipData;

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
              <span>Ship Blueprint Studio · Interactive Deck Mapping</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Manage Ship Decks & Layouts
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">
              Upload deck plans, map sections and cabin codes, and keep vessel blueprints organized across all fleets in the database.
            </p>
          </div>

          {/* Ship Vessel Selector */}
          <div className="min-w-[280px] rounded-xl border border-slate-200/90 bg-white/90 backdrop-blur-xs p-3 shadow-2xs">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Ship</label>
            <select
              value={selectedShipCode}
              onChange={event => setSelectedShipCode(event.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-teal-600 transition cursor-pointer"
              disabled={loadingShips}
            >
              {ships.map(ship => (
                <option key={ship.code} value={ship.code}>
                  {ship.name} ({ship.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {message && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800 shadow-2xs">
          <X size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
        {/* Left Column: Vessel Details & Saved Decks */}
        <div className="space-y-4">
          {/* Vessel Overview Card */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-teal-50 p-1.5 text-teal-700 border border-teal-100">
                  <Compass size={15} />
                </div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Vessel Details</h2>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 font-mono">
                {currentShipObj?.code || "--"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-slate-50/70 border border-slate-200/60 px-3 py-2 text-xs">
                <span className="text-slate-500 font-medium">Ship Name</span>
                <span className="font-bold text-slate-900 truncate max-w-[160px]">{currentShipObj?.name || "--"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50/70 border border-slate-200/60 px-3 py-2 text-xs">
                <span className="text-slate-500 font-medium">Vendor Line</span>
                <span className="font-bold text-slate-900">{shipData?.vendor?.name || currentShipObj?.vendor?.name || "--"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50/70 border border-slate-200/60 px-3 py-2 text-xs">
                <span className="text-slate-500 font-medium">Blueprints</span>
                <span className="font-bold text-teal-800 font-mono">{decks.length} registered</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50/70 border border-slate-200/60 px-3 py-2 text-xs">
                <span className="text-slate-500 font-medium">Deck Coverage</span>
                <span className="font-bold text-slate-700">{deckRangeLabel}</span>
              </div>
            </div>
          </div>

          {/* Saved Decks Card */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-sky-50 p-1.5 text-sky-700 border border-sky-100">
                  <Layers size={15} />
                </div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Saved Decks ({decks.length})
                </h2>
              </div>
              <button
                onClick={resetForm}
                className="inline-flex items-center gap-1 rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-bold text-teal-800 hover:bg-teal-100 transition cursor-pointer"
              >
                <Plus size={12} />
                <span>New</span>
              </button>
            </div>

            {decks.length > 3 && (
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={deckFilter}
                  onChange={e => setDeckFilter(e.target.value)}
                  placeholder="Filter decks…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-7 pr-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-teal-500 outline-none"
                />
              </div>
            )}

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {loadingShip ? (
                <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
                  <RefreshCcw size={14} className="animate-spin text-teal-600" />
                  <span>Loading blueprints…</span>
                </div>
              ) : filteredDecks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center space-y-2">
                  <div className="inline-flex rounded-full bg-slate-100 p-2.5 text-slate-400">
                    <Layers size={18} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">No deck plans yet</p>
                  <p className="text-[11px] text-slate-500">
                    Fill in the form to configure blueprints for this ship.
                  </p>
                </div>
              ) : (
                filteredDecks.map(deck => {
                  const isSelected = form.id === deck.id;
                  return (
                    <div
                      key={deck.id}
                      className={`rounded-xl border p-3 transition-all ${
                        isSelected
                          ? "border-teal-400 bg-teal-50/30 shadow-xs"
                          : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs truncate">
                            {deck.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                            {deck.deckNumber ? (
                              <span className="font-semibold text-teal-700">Deck {deck.deckNumber}</span>
                            ) : (
                              <span>No number</span>
                            )}
                            <span>·</span>
                            <span>{deck.sections?.length || 0} sections</span>
                          </div>
                        </div>

                        {deck.image && (
                          <div className="h-8 w-8 rounded-md bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                            <Image
                              src={deck.image}
                              alt={deck.name}
                              fill
                              sizes="32px"
                              style={{ objectFit: "cover" }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center gap-1.5 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleEdit(deck)}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 py-1 text-[11px] font-bold text-slate-700 transition cursor-pointer shadow-2xs"
                        >
                          <Pencil size={11} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(deck.id)}
                          className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 p-1 text-[11px] font-bold text-rose-700 transition cursor-pointer"
                          title="Delete Deck Plan"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Deck Form & Section Builder */}
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
            {/* Form Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    {form.id ? `Edit Deck Plan: ${form.name}` : "Create New Deck Blueprint"}
                  </h2>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                    form.id
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-teal-50 text-teal-700 border-teal-200"
                  }`}>
                    {form.id ? "Editing" : "New Blueprint"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define deck metadata, schematic layout graphics, and zoned functional areas.
                </p>
              </div>

              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white transition cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Deck Name & Number */}
            <div className="grid gap-3.5 sm:grid-cols-[2fr_1fr]">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Deck Name <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Lido Deck, Promenade Deck, Bridge Deck"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 outline-none transition"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Deck Number
                </label>
                <input
                  type="number"
                  value={form.deckNumber}
                  onChange={event => setForm(current => ({ ...current, deckNumber: event.target.value }))}
                  placeholder="e.g. 10"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 outline-none transition font-mono"
                />
              </div>
            </div>

            {/* Deck Description */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Deck Description & Amenities
              </label>
              <textarea
                value={form.description}
                onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
                placeholder="Overview of public facilities, elevators, observation lounges, and cabin corridors located on this deck…"
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 outline-none transition leading-relaxed"
              />
            </div>

            {/* Deck Schematic Graphic / Image Upload */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Deck Plan Image Schematic
                </label>
                {/* Source Switch Tabs */}
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setImageSourceTab("file")}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition cursor-pointer text-[11px] ${
                      imageSourceTab === "file"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Upload size={11} />
                    <span>Upload File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSourceTab("url")}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition cursor-pointer text-[11px] ${
                      imageSourceTab === "url"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Link2 size={11} />
                    <span>Remote URL</span>
                  </button>
                </div>
              </div>

              <div className="grid gap-3.5 md:grid-cols-[minmax(0,1fr)_260px]">
                {/* Input Area based on tab */}
                <div>
                  {imageSourceTab === "file" ? (
                    <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-4 text-center hover:border-teal-500 hover:bg-teal-50/20 transition group">
                      <div className="rounded-full bg-slate-100 p-2.5 text-slate-500 group-hover:bg-teal-100 group-hover:text-teal-700 transition">
                        <Upload size={18} />
                      </div>
                      <span className="mt-2 text-xs font-bold text-slate-700 group-hover:text-teal-900">
                        {form.imageFileName || "Click to browse blueprint image"}
                      </span>
                      <span className="mt-0.5 text-[10px] text-slate-400">
                        Supports PNG, JPG, WEBP formats up to 10MB
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                    </label>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={form.imageUrl}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            imageUrl: event.target.value,
                            imageData: "",
                            imageFileName: ""
                          }))
                        }
                        placeholder="https://res.cloudinary.com/.../deck10.png"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 outline-none transition"
                      />
                      <p className="text-[11px] text-slate-400 leading-normal">
                        Direct public HTTPS URL to deck blueprint schematic.
                      </p>
                    </div>
                  )}
                </div>

                {/* Live Preview Box */}
                <div className="relative flex min-h-[128px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 overflow-hidden">
                  {form.imageData || form.imageUrl ? (
                    <div className="relative h-28 w-full">
                      <Image
                        src={form.imageData || form.imageUrl}
                        alt="Deck blueprint preview"
                        fill
                        sizes="260px"
                        style={{ objectFit: "contain" }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm(current => ({
                            ...current,
                            imageData: "",
                            imageUrl: "",
                            imageFileName: ""
                          }))
                        }
                        className="absolute top-1 right-1 rounded-full bg-slate-900/80 text-white p-1 hover:bg-rose-600 transition cursor-pointer shadow-xs"
                        title="Remove image"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <ImageIcon size={22} className="text-slate-300 mb-1" />
                      <span className="text-[11px] font-bold text-slate-400">No blueprint loaded</span>
                      <span className="text-[10px] text-slate-400">Upload file or enter URL</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Deck Sections Builder ────────────────────────────────────────── */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <MapPin size={14} className="text-teal-600" />
                    <span>Deck Functional Sections ({form.sections.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Group cabin zones, stateroom numbering sequences, and shipboard venues.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setForm(current => ({
                      ...current,
                      sections: [...current.sections, createEmptySection()]
                    }))
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs self-start sm:self-auto"
                >
                  <Plus size={13} className="text-teal-600" />
                  <span>Add Section</span>
                </button>
              </div>

              {/* Section Items */}
              <div className="space-y-3">
                {form.sections.map((section, index) => (
                  <div
                    key={`${form.id || "new"}-${index}`}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3 transition hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                          {index + 1}
                        </span>
                        <span>Section Details</span>
                      </div>

                      {form.sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm(current => ({
                              ...current,
                              sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index)
                            }))
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                        >
                          <Trash2 size={11} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-[2fr_1fr]">
                      <div>
                        <input
                          value={section.title}
                          onChange={event => handleSectionChange(index, "title", event.target.value)}
                          placeholder="Section Title (e.g. Forward Balcony Staterooms)"
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-teal-600 outline-none"
                        />
                      </div>

                      <div>
                        <input
                          value={section.sectionType}
                          onChange={event => handleSectionChange(index, "sectionType", event.target.value)}
                          placeholder="Category / Type (e.g. Cabins)"
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-teal-600 outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick Section Type Presets */}
                    <div className="flex flex-wrap items-center gap-1 text-[11px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                        Preset:
                      </span>
                      {SECTION_TYPE_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleSectionChange(index, "sectionType", preset)}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                            section.sectionType === preset
                              ? "bg-teal-700 text-white shadow-2xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {/* Cabin Codes */}
                    <div>
                      <input
                        value={section.cabinCodes}
                        onChange={event => handleSectionChange(index, "cabinCodes", event.target.value)}
                        placeholder="Cabin codes (comma separated, e.g. 10101, 10102, 10103)"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-medium text-slate-800 placeholder:text-slate-400 focus:border-teal-600 outline-none"
                      />
                    </div>

                    {/* Description */}
                    <textarea
                      value={section.description}
                      onChange={event => handleSectionChange(index, "description", event.target.value)}
                      placeholder="Optional notes or details for this zone…"
                      rows={1}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-600 outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Form Footer Submit Action */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-200 bg-white px-4 h-9 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Reset Form
              </button>

              <button
                type="submit"
                disabled={saving || !selectedShipCode}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-6 h-9 text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCcw size={13} className="animate-spin" />
                    <span>Saving Blueprint…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>{form.id ? "Update Deck Blueprint" : "Save Deck Blueprint"}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* ── Visual Blueprint Inspection Gallery ───────────────────────────── */}
          {decks.length > 0 && (
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-teal-50 p-1.5 text-teal-700 border border-teal-100">
                    <Sparkles size={15} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Deck Blueprint Gallery ({decks.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Visual schematic views and configured cabin clusters for {currentShipObj?.name || "this ship"}.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {decks.map(deck => (
                  <div
                    key={deck.id}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900">{deck.name}</h3>
                          {deck.deckNumber && (
                            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-700 font-mono shadow-2xs">
                              Deck {deck.deckNumber}
                            </span>
                          )}
                          <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                            {deck.sections?.length || 0} configured zones
                          </span>
                        </div>

                        {deck.description && (
                          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                            {deck.description}
                          </p>
                        )}

                        {deck.sections?.length > 0 && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 pt-2">
                            {deck.sections.map(section => (
                              <div
                                key={section.id || section.title}
                                className="rounded-lg border border-slate-200/70 bg-white p-3 shadow-2xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 text-xs truncate">
                                    {section.title}
                                  </span>
                                  {section.sectionType && (
                                    <span className="rounded-md bg-teal-50 border border-teal-100 px-1.5 py-0.2 text-[10px] font-bold text-teal-700">
                                      {section.sectionType}
                                    </span>
                                  )}
                                </div>

                                {section.description && (
                                  <p className="text-[11px] text-slate-500 leading-tight">
                                    {section.description}
                                  </p>
                                )}

                                {section.cabinCodes?.length ? (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {section.cabinCodes.map(code => (
                                      <span
                                        key={`${section.id}-${code}`}
                                        className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 font-mono"
                                      >
                                        {code}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {deck.image && (
                        <div className="relative h-[180px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white lg:w-[260px] shrink-0 p-2">
                          <Image
                            src={deck.image}
                            alt={deck.name}
                            fill
                            sizes="260px"
                            style={{ objectFit: "contain" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
