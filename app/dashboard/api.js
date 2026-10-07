import { api, getApiBaseUrl, setApiBaseUrl, API_URL_STORAGE_KEY } from "@/lib/api"
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
  const base = getApiBaseUrl().replace(/\/api\/?$/, "")
  try {
    const res = await fetch(`${base}/`, { headers: { Accept: "application/json" } })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, latencyMs: Date.now() - start, service: data?.message ?? data?.service ?? "cruisesaga-backend" }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message }
  }
}

export async function checkScraperBackendHealth() {
  const start = Date.now()
  const base = scraperBase().replace(/\/api\/?$/, "")
  try {
    const res = await fetch(`${base}/health`).catch(async () => {
      return fetch(getScraperEndpoint("/api/schedule"))
    })
    const data = await res?.json().catch(() => ({}))
    return { ok: res?.ok || false, latencyMs: Date.now() - start, service: data?.service ?? "scrapper-backend" }
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
export const SCRAPER_URL_STORAGE_KEY = "scraperUrl"

export const scraperBase = () => {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(SCRAPER_URL_STORAGE_KEY)
    if (stored) {
      const trimmed = stored.trim().replace(/\/+$/, "")
      if (trimmed === "http://localhost:3001") return "http://localhost:3001/api"
      return trimmed
    }
  }
  return (process.env.NEXT_PUBLIC_SCRAPER_URL || "http://localhost:3001/api").trim().replace(/\/+$/, "")
}

export function getScraperBaseUrl() {
  return scraperBase()
}

export function getScraperEndpoint(path) {
  const base = scraperBase()
  const cleanPath = path.startsWith("/") ? path : `/${path}`

  if (base.endsWith("/api") && cleanPath.startsWith("/api/")) {
    return `${base}${cleanPath.replace(/^\/api/, "")}`
  }
  return `${base}${cleanPath}`
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
    let val = row?.value || "http://localhost:3001/api"
    if (val === "http://localhost:3001") val = "http://localhost:3001/api"
    window.localStorage.setItem(SCRAPER_URL_STORAGE_KEY, val)
    return val
  } catch {}
  return null
}

// ── Frontend .env File Management ──────────────────────────────────────────
export async function fetchFrontendEnv() {
  try {
    const res = await fetch("/api/env", { headers: { Accept: "application/json" }, cache: "no-store" })
    const data = await res.json()
    return data
  } catch (err) {
    return { success: false, error: err.message }
  }
}

export async function saveFrontendEnv(payload) {
  const res = await fetch("/api/env", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data?.error || "Failed to update .env file")
  }
  return data
}


async function scraperFetch(path, options = {}) {
  const timeoutMs = options.timeout || 6000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(getScraperEndpoint(path), {
      headers: { "Content-Type": "application/json" },
      signal: options.signal || controller.signal,
      ...options
    })
    return await res.json()
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn(`Scraper fetch timed out after ${timeoutMs}ms on ${path}`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
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
    getScraperEndpoint(`/api/scrapers/${encodeURIComponent(vendorKey)}/run`),
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(options) }
  )
  const data = await res.json()
  if (!res.ok && res.status !== 409) throw new Error(data?.error ?? "Trigger failed")
  return { ...data, httpStatus: res.status }
}

export async function refreshCruiseCabins(cruiseCode, vendorKey) {
  try {
    // 1. Pre-flight check: if scraper already reported in_progress or finished, resolve directly without issuing a duplicate POST that triggers 409
    try {
      const activeStatus = await getCruiseRefreshStatus(cruiseCode);
      if (activeStatus && (activeStatus.status === "in_progress" || activeStatus.status === "completed")) {
        return { ...activeStatus, httpStatus: 200 };
      }
    } catch {
      // Continue to POST if status check fails
    }

    const response = await fetch(
      getScraperEndpoint(`/api/cruises/${encodeURIComponent(cruiseCode)}/refresh-cabins`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorKey, force: true, reset: true })
      }
    );
    const data = await response.json().catch(() => ({}));
    if (response.status === 429) {
      throw Object.assign(new Error(data?.message ?? "Too many requests"), { code: data?.status, retryAfter: data?.retryAfter });
    }
    if (!response.ok && response.status !== 409) {
      throw new Error(data?.error ?? data?.message ?? "Refresh failed");
    }

    // If 409 returned but remaining is 0 or elapsed >= estimatedMs, treat lock as expired/completed
    const isExpired = (data.remaining != null && data.remaining <= 0) ||
                      (data.elapsed != null && data.estimatedMs != null && data.elapsed >= data.estimatedMs);
    const normalizedStatus = isExpired ? "completed" : (data?.status ?? (response.status === 409 ? "in_progress" : "started"));

    return { status: normalizedStatus, ...data, httpStatus: response.status, isStale: isExpired };
  } catch (err) {
    if (err.name === "TypeError" || (err.message && err.message.toLowerCase().includes("fetch"))) {
      throw new Error("Scraper server is offline.");
    }
    throw err;
  }
}

export async function getCruiseRefreshStatus(cruiseCode) {
  try {
    const response = await fetch(
      getScraperEndpoint(`/api/cruises/${encodeURIComponent(cruiseCode)}/refresh-status`)
    );
    if (!response.ok) {
      return { status: "offline", error: "Scraper server is offline." };
    }
    const data = await response.json().catch(() => ({}));
    
    // If the server still reports in_progress but the job time has elapsed (remaining == 0 or elapsed >= estimatedMs)
    if (data.status === "in_progress") {
      const isExpired = (data.remaining != null && data.remaining <= 0) ||
                        (data.elapsed != null && data.estimatedMs != null && data.elapsed >= data.estimatedMs);
      if (isExpired) {
        return { ...data, status: "completed", isStale: true, remaining: 0 };
      }
    }
    return data;
  } catch (err) {
    return { status: "offline", error: "Scraper server is offline." };
  }
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
  try {
    const dashboard = await fetchDashboardOverview()
    return {
      success: true,
      dashboard
    }
  } catch (err) {
    return {
      success: false,
      dashboard: null,
      error: err?.message
    }
  }
}

export async function fetchCapacityInsightsData(params = {}) {
  const [dashboardResult, cruisesResult] = await Promise.allSettled([
    fetchDashboardOverview(),
    fetchCruises(params)
  ])

  const dashboard = dashboardResult.status === "fulfilled" ? dashboardResult.value : { vendor_fleet: [] }
  const cruises = cruisesResult.status === "fulfilled" ? cruisesResult.value : { data: [] }

  return {
    success: dashboardResult.status === "fulfilled" || cruisesResult.status === "fulfilled",
    dashboard,
    cruises,
    errors: {
      dashboard: dashboardResult.status === "rejected" ? dashboardResult.reason?.message : null,
      cruises: cruisesResult.status === "rejected" ? cruisesResult.reason?.message : null
    }
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

