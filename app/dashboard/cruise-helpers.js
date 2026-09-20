const LEGACY_CODE_PREFIX = "celestyal:"

const GROUP_ORDER = ["Suite", "Balcony", "Exterior", "Interior", "Other"]

export function mapCategoryToGroup(code) {
  if (!code) return "Other"
  const c = String(code).toUpperCase()
  if (c.startsWith("H")) return "Suite"
  if (c.startsWith("S")) return "Suite"
  if (c.startsWith("M")) return "Balcony"
  if (c.startsWith("B")) return "Balcony"
  if (c.startsWith("O")) return "Exterior"
  if (c.startsWith("I")) return "Interior"
  return "Other"
}

export function buildCabinGroups(categories = []) {
  const groupMap = new Map()

  for (const cat of categories) {
    const group = cat.group ?? mapCategoryToGroup(cat.code)
    if (!groupMap.has(group)) groupMap.set(group, [])
    groupMap.get(group).push(cat)
  }

  const result = []
  for (const groupName of GROUP_ORDER) {
    if (!groupMap.has(groupName)) continue
    const cats = groupMap.get(groupName)
    const prices = cats
      .filter(c => c.avlResult === "OK")
      .map(c => Number(c.cabinPrice ?? 0))
      .filter(p => Number.isFinite(p) && p > 0)
    result.push({
      group: groupName,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      categories: cats
    })
  }

  for (const [groupName, cats] of groupMap) {
    if (GROUP_ORDER.includes(groupName)) continue
    const prices = cats
      .filter(c => c.avlResult === "OK")
      .map(c => Number(c.cabinPrice ?? 0))
      .filter(p => Number.isFinite(p) && p > 0)
    result.push({
      group: groupName,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      categories: cats
    })
  }

  return result
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : null
}


export function getCruiseCode(cruise) {
  return cruise?.code ?? cruise?.id ?? null
}

export function getCruiseDisplayId(cruise) {
  return getCruiseCode(cruise) ?? "--"
}

export function getCruiseRouteLabel(cruise) {
  return cruise?.routeLabel ?? ([cruise?.portFrom, cruise?.portTo].filter(Boolean).join(" -> ") || "--")
}

export function getLoadFactor(cruise) {
  const total = Number(cruise?.totalCapacity ?? 0)
  const avail = Number(cruise?.seatsAvailable ?? 0)
  if (!total) return 0
  const used = total - avail
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)))
}

export function getSafeSeatsAvailable(cruise) {
  return Math.max(0, Number(cruise?.seatsAvailable ?? 0))
}

export function getCruiseShipStats(cruise) {
  const shipDetails = cruise?.shipDetails ?? {}
  return {
    cabins: normalizeInteger(shipDetails.cabins),
    guests: normalizeInteger(shipDetails.guests)
  }
}

export function normalizeCabinCategory(category = {}) {
  const promos = Array.isArray(category.promos)
    ? category.promos
    : Array.isArray(category.promotions)
      ? category.promotions.map(p => (typeof p === "string" ? p : p?.name)).filter(Boolean)
      : []

  return {
    ...category,
    group: category.group ?? mapCategoryToGroup(category.code),
    promos,
    totalCabins: normalizeInteger(category.totalCabins),
    avail:       normalizeInteger(category.avail) ?? normalizeInteger(category.available),
    available:   normalizeInteger(category.available) ?? normalizeInteger(category.avail)
  }
}

export function normalizeCruise(cruise = {}) {
  const shipStats       = getCruiseShipStats(cruise)
  const code            = getCruiseCode(cruise)
  const cabinCategories = (cruise.cabinCategories ?? []).map(normalizeCabinCategory)

  const seatsAvailable = cabinCategories
    .filter(c => c.avlResult === "OK")
    .reduce((sum, c) => sum + (normalizeInteger(c.avail) ?? 0), 0)
  const totalCapacity = cabinCategories
    .reduce((sum, c) => sum + (normalizeInteger(c.totalCabins) ?? 0), 0)

  return {
    ...cruise,
    id:             cruise.id ?? code,
    code,
    routeLabel:     getCruiseRouteLabel(cruise),
    shipDetails: {
      ...cruise.shipDetails,
      cabins: shipStats.cabins,
      guests: shipStats.guests
    },
    cabinCategories,
    cabinGroups:     cruise.cabinGroups ?? buildCabinGroups(cabinCategories),
    itineraryStops:  Array.isArray(cruise.itineraryStops) ? cruise.itineraryStops : [],
    seatsAvailable,
    totalCapacity
  }
}

export function dedupeCruises(cruises = []) {
  const normalized = cruises.map(normalizeCruise)
  const codes = new Set(normalized.map(getCruiseCode).filter(Boolean))

  return normalized.filter(cruise => {
    if (!String(getCruiseCode(cruise) ?? "").startsWith(LEGACY_CODE_PREFIX)) {
      return true
    }

    return !(cruise.legacyReplacementCode && codes.has(cruise.legacyReplacementCode))
  })
}

export function normalizeCruiseResponsePayload(payload) {
  return {
    ...payload,
    data: dedupeCruises(payload?.data ?? [])
  }
}
