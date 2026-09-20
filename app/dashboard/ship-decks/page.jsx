"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import {
  createShipDeck,
  deleteShipDeck,
  fetchShip,
  fetchShips,
  updateShipDeck
} from "../api";

const T = {
  border: "#e2e8f0",
  muted: "#f8fafc",
  textMuted: "#64748b",
  textPrimary: "#0f172a",
  blue: "#1d4ed8",
  blueBg: "#eff6ff",
  red: "#dc2626",
  redBg: "#fff1f2",
  green: "#166534",
  greenBg: "#dcfce7"
};

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

  const decks = shipData?.decks || [];

  const overview = useMemo(
    () => [
      ["Ship", shipData?.name || "--"],
      ["Code", shipData?.code || "--"],
      ["Decks", decks.length],
      ["Cruises", shipData?.cruiseCount ?? 0]
    ],
    [decks.length, shipData]
  );

  const resetForm = () => {
    setForm(createEmptyForm());
    setMessage("");
    setError("");
  };

  const reloadShip = async (shipCode = selectedShipCode) => {
    const response = await fetchShip(shipCode);
    setShipData(response.data || null);
  };

  const handleSectionChange = (index, key, value) => {
    setForm(current => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, [key]: value } : section
      )
    }));
  };

  const handleImageFile = async event => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const imageData = await readFileAsDataUrl(file);
      setForm(current => ({
        ...current,
        imageData,
        imageFileName: file.name,
        imageUrl: ""
      }));
    } catch (err) {
      setError(err.message || "Failed to load image");
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();

    if (!selectedShipCode) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        name: form.name,
        deckNumber: form.deckNumber,
        description: form.description,
        imageUrl: form.imageUrl,
        imageData: form.imageData,
        sections: form.sections
      };

      if (form.id) {
        await updateShipDeck(selectedShipCode, form.id, payload);
      } else {
        await createShipDeck(selectedShipCode, payload);
      }

      await reloadShip();
      setMessage(form.id ? "Deck updated successfully." : "Deck created successfully.");
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to save deck");
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
    <div className="space-y-6 px-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Ship Deck Admin
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Manage Deck Plans</h1>
            <p className="mt-2 text-sm text-slate-500">
              Upload deck images to Cloudinary, map sections and cabin codes, and keep ship deck plans organized outside cruise search.
            </p>
          </div>

          <div className="min-w-[280px]">
            <label className="mb-2 block text-sm font-medium text-slate-600">Select ship</label>
            <select
              value={selectedShipCode}
              onChange={event => setSelectedShipCode(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3"
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

      {message ? <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: T.greenBg, color: T.green }}>{message}</div> : null}
      {error ? <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: T.redBg, color: T.red }}>{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-slate-900">Ship overview</div>
            <div className="mt-4 space-y-3">
              {overview.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900">Saved decks</div>
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              >
                New deck
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {loadingShip ? (
                <div className="text-sm text-slate-500">Loading decks...</div>
              ) : decks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  No deck plans yet.
                </div>
              ) : (
                decks.map(deck => (
                  <div key={deck.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="font-semibold text-slate-900">{deck.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {deck.deckNumber ? `Deck ${deck.deckNumber}` : "No deck number"} · {deck.sections?.length || 0} sections
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleEdit(deck)}
                        className="flex-1 rounded-xl px-3 py-2 text-sm font-medium"
                        style={{ background: T.blueBg, color: T.blue }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(deck.id)}
                        className="flex-1 rounded-xl px-3 py-2 text-sm font-medium"
                        style={{ background: T.redBg, color: T.red }}
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

        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-slate-900">
                  {form.id ? "Edit deck plan" : "Create deck plan"}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Upload from your machine or keep a Cloudinary/remote image URL.
                </div>
              </div>
              {form.id ? (
                <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  Cancel
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[2fr_1fr]">
              <input
                value={form.name}
                onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                placeholder="Deck name"
                className="h-11 rounded-xl border border-slate-200 px-3"
                required
              />
              <input
                value={form.deckNumber}
                onChange={event => setForm(current => ({ ...current, deckNumber: event.target.value }))}
                placeholder="Deck number"
                className="h-11 rounded-xl border border-slate-200 px-3"
              />
            </div>

            <textarea
              value={form.description}
              onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
              placeholder="Deck description"
              rows={3}
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-3"
            />

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-3">
                <input
                  value={form.imageUrl}
                  onChange={event => setForm(current => ({ ...current, imageUrl: event.target.value, imageData: "", imageFileName: "" }))}
                  placeholder="Optional remote image URL"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3"
                />
                <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                  <span>{form.imageFileName || "Choose image from device"}</span>
                  <span className="mt-1 text-xs">PNG, JPG, WEBP</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                </label>
              </div>

              {(form.imageData || form.imageUrl) ? (
                <div className="relative min-h-[180px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <Image
                    src={form.imageData || form.imageUrl}
                    alt="Deck preview"
                    fill
                    sizes="280px"
                    style={{ objectFit: "contain" }}
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900">Deck sections</div>
              <button
                type="button"
                onClick={() => setForm(current => ({ ...current, sections: [...current.sections, createEmptySection()] }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Add section
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {form.sections.map((section, index) => (
                <div key={`${form.id || "new"}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
                    <input
                      value={section.title}
                      onChange={event => handleSectionChange(index, "title", event.target.value)}
                      placeholder="Section title"
                      className="h-11 rounded-xl border border-slate-200 px-3"
                    />
                    <input
                      value={section.sectionType}
                      onChange={event => handleSectionChange(index, "sectionType", event.target.value)}
                      placeholder="Section type"
                      className="h-11 rounded-xl border border-slate-200 px-3"
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
                      className="rounded-xl px-3 py-2 text-sm font-medium"
                      style={{ background: T.redBg, color: T.red }}
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    value={section.cabinCodes}
                    onChange={event => handleSectionChange(index, "cabinCodes", event.target.value)}
                    placeholder="Cabin codes, comma separated"
                    className="mt-3 h-11 w-full rounded-xl border border-slate-200 px-3"
                  />

                  <textarea
                    value={section.description}
                    onChange={event => handleSectionChange(index, "description", event.target.value)}
                    placeholder="Section description"
                    rows={2}
                    className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving || !selectedShipCode}
              className="mt-6 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              {saving ? "Saving..." : form.id ? "Update deck" : "Create deck"}
            </button>
          </form>

          {decks.length > 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-base font-semibold text-slate-900">Deck preview</div>
              <div className="mt-4 grid gap-4">
                {decks.map(deck => (
                  <div key={deck.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row">
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-semibold text-slate-900">{deck.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {deck.deckNumber ? `Deck ${deck.deckNumber}` : "No deck number"}
                        </div>
                        {deck.description ? (
                          <div className="mt-3 text-sm text-slate-600">{deck.description}</div>
                        ) : null}
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {(deck.sections || []).map(section => (
                            <div key={section.id} className="rounded-xl bg-slate-50 px-4 py-3">
                              <div className="font-medium text-slate-900">{section.title}</div>
                              {section.sectionType ? <div className="mt-1 text-xs text-slate-500">{section.sectionType}</div> : null}
                              {section.description ? <div className="mt-2 text-sm text-slate-600">{section.description}</div> : null}
                              {section.cabinCodes?.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {section.cabinCodes.map(code => (
                                    <span key={`${section.id}-${code}`} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                                      {code}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      {deck.image ? (
                        <div className="relative h-[220px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 lg:w-[360px]">
                          <Image
                            src={deck.image}
                            alt={deck.name}
                            fill
                            sizes="360px"
                            style={{ objectFit: "contain" }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
