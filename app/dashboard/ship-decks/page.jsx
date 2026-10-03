"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Layers,
  MapPin,
  Pencil,
  Plus,
  Ship,
  Trash2,
  Upload,
  X
} from "lucide-react";

import {
  createShipDeck,
  deleteShipDeck,
  fetchShip,
  fetchShips,
  updateShipDeck
} from "../api";

const createEmptySection = () => ({
  title: "",
  sectionType: "",
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
          sectionType: section.sectionType || "",
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadShips = async () => {
      try {
        setLoadingShips(true);
        const response = await fetchShips({ limit: 100 });

        if (!active) {
          return;
        }

        const nextShips = response.data || [];
        setShips(nextShips);
        setSelectedShipCode(current => current || nextShips[0]?.code || "");
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load ships");
        }
      } finally {
        if (active) {
          setLoadingShips(false);
        }
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

        if (!active) {
          return;
        }

        setShipData(response.data || null);
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load ship");
        }
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
  }, [selectedShipCode]);

  const decks = useMemo(() => {
    return Array.isArray(shipData?.decks) ? shipData.decks : [];
  }, [shipData]);

  const overview = useMemo(() => {
    if (!shipData) {
      return [];
    }

    return [
      ["Ship Code", shipData.code || "--"],
      ["Vendor Line", shipData.vendor?.name || "--"],
      ["Registered Decks", String(decks.length)],
      ["Deck Range", decks.length ? `${Math.min(...decks.map(d => d.deckNumber || 0))} - ${Math.max(...decks.map(d => d.deckNumber || 0))}` : "--"]
    ];
  }, [shipData, decks]);

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
    if (!file) {
      return;
    }

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
    if (!selectedShipCode) {
      return;
    }

    const response = await fetchShip(selectedShipCode);
    setShipData(response.data || null);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!selectedShipCode) {
      setError("Please select a ship first");
      return;
    }

    if (!form.name.trim()) {
      setError("Deck name is required");
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
        setMessage("Deck updated successfully.");
      } else {
        await createShipDeck(selectedShipCode, payload);
        setMessage("Deck created successfully.");
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
    setMessage("");
    setError("");
  };

  const handleDelete = async deckId => {
    if (!selectedShipCode || !window.confirm("Delete this deck plan?")) {
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
      setMessage("Deck deleted successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete deck");
    }
  };

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
              <span>Ship Deck Blueprints · Interactive Deck Mapping</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Manage Ship Decks & Layouts
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">
              Upload deck plans, map sections and cabin codes, and keep vessel blueprints organized across all fleets in the database.
            </p>
          </div>

          <div className="min-w-[280px] rounded-xl border border-slate-200/90 bg-white/90 backdrop-blur-xs p-3 shadow-2xs">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Ship</label>
            <select
              value={selectedShipCode}
              onChange={event => setSelectedShipCode(event.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-teal-600 transition"
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

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 shadow-2xs">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 shadow-2xs">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left Sidebar: Overview & Saved Decks */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">Ship Overview</h2>
            <div className="mt-3 space-y-2">
              {overview.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50/70 border border-slate-200/60 px-3 py-2 text-xs">
                  <span className="text-slate-500 font-medium">{label}</span>
                  <span className="font-bold text-slate-900 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Saved Decks</h2>
              <button
                onClick={resetForm}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                + New Deck
              </button>
            </div>

            <div className="mt-3 space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {loadingShip ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading decks…</div>
              ) : decks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                  No deck plans configured yet.
                </div>
              ) : (
                decks.map(deck => (
                  <div key={deck.id} className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">{deck.name}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {deck.deckNumber ? `Deck ${deck.deckNumber}` : "No deck number"} · {deck.sections?.length || 0} sections
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex gap-1.5 pt-2 border-t border-slate-200/60">
                      <button
                        onClick={() => handleEdit(deck)}
                        className="flex-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 py-1 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(deck.id)}
                        className="flex-1 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 py-1 text-[11px] font-bold text-rose-700 transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Area: Form & Previews */}
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {form.id ? "Edit Deck Blueprint" : "Create New Deck Blueprint"}
                </h2>
                <p className="text-xs text-slate-500">
                  Upload schematic image or provide remote Cloudinary URL.
                </p>
              </div>
              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Deck Name *</label>
                <input
                  value={form.name}
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Lido Deck"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Deck Number</label>
                <input
                  value={form.deckNumber}
                  onChange={event => setForm(current => ({ ...current, deckNumber: event.target.value }))}
                  placeholder="e.g. 10"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Deck Description</label>
              <textarea
                value={form.description}
                onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
                placeholder="Amenities, public spaces, and general features on this deck…"
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600"
              />
            </div>

            {/* Image Upload / URL */}
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Deck Plan Image</label>
                <input
                  value={form.imageUrl}
                  onChange={event => setForm(current => ({ ...current, imageUrl: event.target.value, imageData: "", imageFileName: "" }))}
                  placeholder="Optional remote image URL (https://...)"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-2xs outline-none focus:border-teal-600"
                />
                <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 text-xs text-slate-500 hover:bg-slate-100 transition">
                  <Upload size={16} className="text-slate-400 mb-1" />
                  <span className="font-bold text-slate-700">{form.imageFileName || "Choose deck image file"}</span>
                  <span className="text-[10px] text-slate-400">PNG, JPG, WEBP formats</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                </label>
              </div>

              {(form.imageData || form.imageUrl) ? (
                <div className="relative min-h-[140px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <Image
                    src={form.imageData || form.imageUrl}
                    alt="Deck preview"
                    fill
                    sizes="240px"
                    style={{ objectFit: "contain" }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center min-h-[140px] rounded-lg border border-slate-200 bg-slate-50/50 text-xs text-slate-400 font-medium">
                  No image selected
                </div>
              )}
            </div>

            {/* Sections Sub-form */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Deck Sections</h3>
                  <p className="text-[11px] text-slate-500">Cabin clusters, dining, entertainment zones</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(current => ({ ...current, sections: [...current.sections, createEmptySection()] }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  + Add Section
                </button>
              </div>

              <div className="space-y-3">
                {form.sections.map((section, index) => (
                  <div key={`${form.id || "new"}-${index}`} className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
                      <input
                        value={section.title}
                        onChange={event => handleSectionChange(index, "title", event.target.value)}
                        placeholder="Section title (e.g. Forward Balconies)"
                        className="h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-teal-600"
                      />
                      <input
                        value={section.sectionType}
                        onChange={event => handleSectionChange(index, "sectionType", event.target.value)}
                        placeholder="Section type (e.g. Cabins)"
                        className="h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-teal-600"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm(current => ({
                            ...current,
                            sections:
                              current.sections.length > 1
                                ? current.sections.filter((_, sectionIndex) => sectionIndex !== index)
                                : [createEmptySection()]
                          }))
                        }
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 h-8.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>

                    <input
                      value={section.cabinCodes}
                      onChange={event => handleSectionChange(index, "cabinCodes", event.target.value)}
                      placeholder="Cabin codes (comma separated, e.g. 10101, 10102, 10103)"
                      className="h-8.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-teal-600 font-mono"
                    />

                    <textarea
                      value={section.description}
                      onChange={event => handleSectionChange(index, "description", event.target.value)}
                      placeholder="Section description…"
                      rows={1}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-teal-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving || !selectedShipCode}
                className="rounded-lg bg-teal-700 hover:bg-teal-800 text-white px-5 h-9 text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving…" : form.id ? "Update Deck Blueprint" : "Create Deck Blueprint"}
              </button>
            </div>
          </form>

          {/* Decks Preview Cards */}
          {decks.length > 0 && (
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">Deck Plan Previews</h2>
              <div className="space-y-4">
                {decks.map(deck => (
                  <div key={deck.id} className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{deck.name}</h3>
                          {deck.deckNumber && (
                            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-700 font-mono">
                              Deck {deck.deckNumber}
                            </span>
                          )}
                        </div>
                        {deck.description && (
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{deck.description}</p>
                        )}
                        <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
                          {(deck.sections || []).map(section => (
                            <div key={section.id} className="rounded-lg border border-slate-200/70 bg-white p-3 shadow-2xs">
                              <div className="font-bold text-slate-900 text-xs">{section.title}</div>
                              {section.sectionType && <div className="text-[11px] font-semibold text-teal-700">{section.sectionType}</div>}
                              {section.description && <div className="mt-1 text-xs text-slate-500">{section.description}</div>}
                              {section.cabinCodes?.length ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {section.cabinCodes.map(code => (
                                    <span key={`${section.id}-${code}`} className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 font-mono">
                                      {code}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      {deck.image && (
                        <div className="relative h-[180px] w-full overflow-hidden rounded-lg border border-slate-200 bg-white lg:w-[280px] shrink-0">
                          <Image
                            src={deck.image}
                            alt={deck.name}
                            fill
                            sizes="280px"
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
