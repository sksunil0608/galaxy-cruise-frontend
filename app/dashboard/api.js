import { api } from "@/lib/api"
import {
  dedupeCruises,
  normalizeCruiseResponsePayload
} from "./cruise-helpers"


function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return
    }

    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

export async function fetchDashboardOverview() {
  return api("/vendors/dashboard")
}

export async function checkMainBackendHealth() {
  const start = Date.now()
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "")
  try {
    const res = await fetch(`${base}/`, { headers: { Accept: "application/json" } })
    const data = await res.json()
    return { ok: res.ok, latencyMs: Date.now() - start, service: data?.message ?? "cruisesaga-backend" }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message }
  }
}

export async function checkScraperBackendHealth() {
  const start = Date.now()
  try {
    const res = await fetch(`${scraperBase()}/health`)
    const data = await res.json()
    return { ok: res.ok, latencyMs: Date.now() - start, service: data?.service ?? "scrapper-backend" }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message }
  }
}

export async function fetchVendorBySlug(slug) {
  return api(`/vendors/${slug}`)
}

export async function fetchVendors(params = {}) {
  return api(`/vendors${buildQueryString(params)}`)
}

export async function fetchUsers() {
  const response = await api("/users")

  return {
    success: true,
    data: Array.isArray(response) ? response : []
  }
}

export async function fetchShip(code) {
  return api(`/ships/${encodeURIComponent(code)}`)
}

export async function fetchShips(params = {}) {
  return api(`/ships${buildQueryString(params)}`)
}

export async function createShipDeck(code, payload) {
  return api(`/ships/${encodeURIComponent(code)}/decks`, {
    method: "POST",
    body: JSON.stringify(payload)
  })
}

export async function updateShipDeck(code, deckId, payload) {
  return api(`/ships/${encodeURIComponent(code)}/decks/${deckId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  })
}

export async function deleteShipDeck(code, deckId) {
  return api(`/ships/${encodeURIComponent(code)}/decks/${deckId}`, {
    method: "DELETE"
  })
}

export async function fetchCruises(params = {}) {
  const response = await api(`/cruises/search${buildQueryString(params)}`)
  return normalizeCruiseResponsePayload(response)
}

export async function fetchCruise(code) {
  const response = await api(`/cruises/${encodeURIComponent(code)}`)
  if (!response?.data) return null
  return normalizeCruiseResponsePayload({ data: [response.data] }).data?.[0] ?? null
}

export async function fetchCruiseTags() {
  return api("/cruises/tags")
}

export async function fetchCruisePriceAlerts(params = {}) {
  return api(`/cruises/price-alerts${buildQueryString(params)}`)
}

export async function markCruisePriceAlertRead(alertId) {
  return api(`/cruises/price-alerts/${alertId}/read`, {
    method: "PUT"
  })
}

export async function createCruiseTag(code, payload) {
  const response = await api(`/cruises/${encodeURIComponent(code)}/tags`, {
    method: "POST",
    body: JSON.stringify(payload)
  })

  return {
    ...response,
    data: response.data ? normalizeCruiseResponsePayload({ data: [response.data] }).data[0] : null
  }
}

export async function updateCruiseTag(code, tagId, payload) {
  const response = await api(`/cruises/${encodeURIComponent(code)}/tags/${tagId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  })

  return {
    ...response,
    data: response.data ? normalizeCruiseResponsePayload({ data: [response.data] }).data[0] : null
  }
}

export async function fetchCategoryDecks(cruiseCode, categoryCode) {
  return api(`/cruises/${encodeURIComponent(cruiseCode)}/categories/${encodeURIComponent(categoryCode)}/cabins`)
}

// Where scrapper-backend lives. Resolution order:
//   1. the DB-backed setting (Dashboard → Settings), cached in localStorage
//   2. NEXT_PUBLIC_SCRAPER_URL — baked in at build time, so it can't be changed
//      after deploy, which is exactly why the setting above exists
//   3. local dev default
const SCRAPER_URL_STORAGE_KEY = "scraperUrl"

const scraperBase = () => {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(SCRAPER_URL_STORAGE_KEY)
    if (stored) return stored.replace(/\/+$/, "")
  }
  return (process.env.NEXT_PUBLIC_SCRAPER_URL || "http://localhost:3001").replace(/\/+$/, "")
}

export function getScraperBaseUrl() {
  return scraperBase()
}

export async function fetchAppSettings() {
  return api("/settings")
}

export async function updateAppSetting(key, value) {
  const res = await api(`/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value })
  })
  if (key === SCRAPER_URL_STORAGE_KEY && typeof window !== "undefined" && res?.data?.value) {
    window.localStorage.setItem(SCRAPER_URL_STORAGE_KEY, res.data.value)
  }
  return res
}

// Pull the stored scraper URL into localStorage so scraperBase() picks it up.
// Safe to call on every dashboard mount; failures leave the previous value in
// place rather than knocking the app back to localhost.
export async function syncScraperUrlFromSettings() {
  if (typeof window === "undefined") return null
  try {
    const res = await fetchAppSettings()
    const row = (res?.data ?? []).find(s => s.key === SCRAPER_URL_STORAGE_KEY)
    if (row?.value) {
      window.localStorage.setItem(SCRAPER_URL_STORAGE_KEY, row.value)
      return row.value
    }
  } catch {}
  return null
}

async function scraperFetch(path, options = {}) {
  const res = await fetch(`${scraperBase()}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  })
  return res.json()
}

export async function checkAllVendorAuth() {
  return scraperFetch("/api/auth/check")
}

export async function checkVendorAuth(vendorKey) {
  return scraperFetch(`/api/auth/check/${encodeURIComponent(vendorKey)}`)
}

export async function getVendorSchedules() {
  return scraperFetch("/api/schedule")
}

export async function getScraperVendorLastRuns() {
  return scraperFetch("/api/vendors/last-runs")
}

export async function triggerVendorScrapeFetch(vendorKey, options = {}) {
  const res = await fetch(
    `${scraperBase()}/api/scrapers/${encodeURIComponent(vendorKey)}/run`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(options) }
  )
  const data = await res.json()
  if (!res.ok && res.status !== 409) throw new Error(data?.error ?? "Trigger failed")
  return { ...data, httpStatus: res.status }
}

export async function refreshCruiseCabins(cruiseCode, vendorKey) {
  const response = await fetch(
    `${scraperBase()}/api/cruises/${encodeURIComponent(cruiseCode)}/refresh-cabins`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorKey })
    }
  )
  const data = await response.json()
  // 202 = started, 409 = already in_progress — both are "ok" for the caller
  if (response.status === 429) throw Object.assign(new Error(data?.message ?? "Too many requests"), { code: data?.status, retryAfter: data?.retryAfter })
  if (!response.ok && response.status !== 409) throw new Error(data?.error ?? "Refresh failed")
  return { ...data, httpStatus: response.status }
}

export async function getCruiseRefreshStatus(cruiseCode) {
  const response = await fetch(
    `${scraperBase()}/api/cruises/${encodeURIComponent(cruiseCode)}/refresh-status`
  )
  const data = await response.json()
  return data
}

export async function deleteCruiseTag(code, tagId) {
  const response = await api(`/cruises/${encodeURIComponent(code)}/tags/${tagId}`, {
    method: "DELETE"
  })

  return {
    ...response,
    data: response.data ? normalizeCruiseResponsePayload({ data: [response.data] }).data[0] : null
  }
}

export async function fetchCruiseOptions(params = {}) {
  return fetchCruises({
    detail: "summary",
    limit: 50,
    ...params
  })
}

export async function fetchComparedCruises(codes) {
  if (!codes.length) {
    return { success: true, data: [] }
  }

  const query = new URLSearchParams({
    codes: codes.join(",")
  })

  const response = await api(`/cruises/compare?${query.toString()}`)
  return {
    ...response,
    data: dedupeCruises(response.data ?? [])
  }
}

export async function fetchVendorRuns(params = {}) {
  return api(`/vendor-runs${buildQueryString(params)}`)
}

export async function fetchOperationalHealthData() {
  return {
    success: true,
    dashboard: await fetchDashboardOverview()
  }
}

export async function fetchCapacityInsightsData() {
  const [dashboard, cruises] = await Promise.all([
    fetchDashboardOverview(),
    fetchCruises()
  ])

  return {
    success: true,
    dashboard,
    cruises
  }
}


// ── Activity logging ──────────────────────────────────────────────────────────
// Fire-and-forget — never blocks the caller, never throws.
export function logActivity(action, details = {}) {
  try {
    const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null
    const user    = userRaw ? JSON.parse(userRaw) : null
    const token   = typeof window !== "undefined" ? localStorage.getItem("token") : null
    const base    = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

    fetch(`${base}/activities`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ action, details, userEmail: user?.email ?? null })
    }).catch(() => {})
  } catch {}
}

export async function fetchActivities(params = {}) {
  return api(`/activities${buildQueryString(params)}`)
}


// ── Itinerary Manager (static itinerary reference data + port aliases) ─────

export async function fetchItineraries(params = {}) {
  return api(`/itinerary${buildQueryString(params)}`)
}

export async function createItinerary(payload) {
  return api("/itinerary", { method: "POST", body: JSON.stringify(payload) })
}

export async function updateItinerary(id, payload) {
  return api(`/itinerary/${id}`, { method: "PUT", body: JSON.stringify(payload) })
}

export async function deleteItinerary(id) {
  return api(`/itinerary/${id}`, { method: "DELETE" })
}

export async function fetchPortAliases(params = {}) {
  return api(`/itinerary/port-aliases${buildQueryString(params)}`)
}

export async function createPortAlias(payload) {
  return api("/itinerary/port-aliases", { method: "POST", body: JSON.stringify(payload) })
}

export async function updatePortAlias(id, payload) {
  return api(`/itinerary/port-aliases/${id}`, { method: "PUT", body: JSON.stringify(payload) })
}

export async function deletePortAlias(id) {
  return api(`/itinerary/port-aliases/${id}`, { method: "DELETE" })
}

