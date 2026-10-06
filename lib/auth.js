"use client"

/**
 * Authentication and Role-Based Access Control (RBAC) Utilities
 */

export function getCurrentUser() {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("user")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getUserRoleName(user) {
  if (!user) {
    const stored = getCurrentUser()
    if (stored) user = stored
  }
  if (!user) return "User"

  let rawRole = null

  if (typeof user.role === "string" && user.role.trim()) {
    rawRole = user.role
  } else if (user.role && typeof user.role.name === "string") {
    rawRole = user.role.name
  } else if (typeof user.role_name === "string") {
    rawRole = user.role_name
  } else if (Array.isArray(user.roles) && user.roles.length > 0) {
    const first = user.roles[0]
    rawRole = typeof first === "string" ? first : first?.name
  } else if (user.isAdmin || user.is_admin) {
    rawRole = "Admin"
  }

  if (!rawRole) return "User"

  // Format nicely (e.g. "superadmin" -> "Super Admin", "admin" -> "Admin")
  const trimmed = rawRole.trim()
  if (trimmed.toLowerCase() === "superadmin") return "Super Admin"
  if (trimmed.toLowerCase() === "admin") return "Admin"
  if (trimmed.toLowerCase() === "devops") return "DevOps"
  
  // Title Case words
  return trimmed
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

export function getUserPermissions(user) {
  const permSet = new Set()

  // 1. Direct permissions from localStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("permissions")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          parsed.forEach((p) => {
            if (typeof p === "string") permSet.add(p.toLowerCase().trim())
            else if (p?.key) permSet.add(String(p.key).toLowerCase().trim())
            else if (p?.name) permSet.add(String(p.name).toLowerCase().trim())
          })
        }
      }
    } catch { }
  }

  // 2. User object permissions
  const u = user || getCurrentUser()
  if (u) {
    if (Array.isArray(u.permissions)) {
      u.permissions.forEach((p) => {
        if (typeof p === "string") permSet.add(p.toLowerCase().trim())
        else if (p?.key) permSet.add(String(p.key).toLowerCase().trim())
        else if (p?.name) permSet.add(String(p.name).toLowerCase().trim())
      })
    }

    // Role permissions attached to user.role or local role overrides
    const roleId = u.role_id || u.role?.id
    let rolePerms = null
    if (typeof window !== "undefined" && roleId) {
      try {
        const stored = localStorage.getItem(`role_permissions_override_${roleId}`)
        if (stored) rolePerms = JSON.parse(stored)
      } catch { }
    }
    if (!rolePerms && u.role && Array.isArray(u.role.permissions)) {
      rolePerms = u.role.permissions
    }

    if (Array.isArray(rolePerms)) {
      rolePerms.forEach((rp) => {
        const p = rp.permission || rp
        if (typeof p === "string") permSet.add(p.toLowerCase().trim())
        else if (p?.key) permSet.add(String(p.key).toLowerCase().trim())
        else if (p?.name) permSet.add(String(p.name).toLowerCase().trim())
      })
    }
  }

  return Array.from(permSet)
}

export function isUserAdmin(user) {
  const u = user || getCurrentUser()
  if (!u) return false
  if (u.isAdmin === true || u.is_admin === true || u.role_id === 1) return true

  const roleName = getUserRoleName(u).toLowerCase()
  if (roleName.includes("admin") || roleName.includes("super")) return true

  const perms = getUserPermissions(u)
  if (perms.includes("*") || perms.includes("all") || perms.includes("admin")) return true

  return false
}

export const ROUTE_ACCESS_CONFIG = {
  "/dashboard": {
    isPublic: true,
  },
  "/dashboard/search-cruise": {
    permissions: ["cruises", "cruises:read", "cruises:search", "search", "search_cruise", "view:cruises", "read:cruises"],
    roles: ["admin", "superadmin", "manager", "editor", "operator", "staff", "agent", "user", "viewer"],
  },
  "/dashboard/tagged-cruises": {
    permissions: ["tags", "tags:read", "tags:manage", "tagged_cruises", "tagged:cruises", "view:tags", "cruises:tag"],
    roles: ["admin", "superadmin", "manager", "editor", "operator", "staff", "agent", "user", "viewer"],
  },
  "/dashboard/ship-decks": {
    permissions: ["decks", "decks:read", "decks:manage", "ship_decks", "manage_decks", "view:decks", "ships:decks"],
    roles: ["admin", "superadmin", "manager", "editor", "operator"],
  },
  "/dashboard/itinerary-manager": {
    permissions: ["itinerary", "itinerary:read", "itinerary:manage", "itinerary_manager", "view:itinerary", "manage:itinerary"],
    roles: ["admin", "superadmin", "manager", "editor", "operator"],
  },
  "/dashboard/operational-health": {
    permissions: ["health", "health:read", "operational_health", "ops:health", "view:health", "ops"],
    roles: ["admin", "superadmin", "manager", "operator", "ops", "devops"],
  },
  "/dashboard/ops-console": {
    permissions: ["ops_console", "ops:console", "ops:manage", "ops:read", "console:read", "console:manage", "ops", "scraper", "scraper:manage", "view:ops"],
    roles: ["admin", "superadmin", "manager", "operator", "ops", "devops"],
  },
  "/dashboard/vendor-sites": {
    permissions: ["vendors", "vendor_sites", "vendors:read", "vendors:manage", "view:vendors", "read:vendors"],
    roles: ["admin", "superadmin", "manager", "operator", "editor"],
  },
  "/dashboard/user-activity": {
    permissions: ["activity", "user_activity", "activity:read", "logs:read", "view:activity", "audit:read", "activity_logs"],
    roles: ["admin", "superadmin", "manager"],
  },
  "/dashboard/users": {
    permissions: ["users", "user_management", "users:read", "users:manage", "roles:manage", "permissions:manage", "manage:users", "view:users"],
    roles: ["admin", "superadmin"],
  },
  "/dashboard/roles": {
    permissions: ["roles", "roles:manage", "users:manage", "manage:users", "permissions:manage"],
    roles: ["admin", "superadmin"],
  },
  "/dashboard/permission": {
    permissions: ["permissions", "permissions:manage", "users:manage", "manage:users", "roles:manage"],
    roles: ["admin", "superadmin"],
  },
  "/dashboard/settings": {
    permissions: ["settings", "settings:read", "settings:manage", "view:settings", "manage:settings"],
    roles: ["admin", "superadmin", "manager"],
  },
}

/**
 * Check if the user has access to a given route url
 */
export function hasRouteAccess(url, user = null) {
  // During server-side rendering, allow all items to render consistently
  if (typeof window === "undefined") {
    return true
  }

  const u = user || getCurrentUser()
  if (!u && !localStorage.getItem("token")) {
    return false
  }

  if (isUserAdmin(u)) {
    return true
  }

  const normalizedUrl = url ? url.split("?")[0].replace(/\/+$/, "") || "/dashboard" : "/dashboard"
  const config = ROUTE_ACCESS_CONFIG[normalizedUrl]

  // If no config rule exists or is marked public, allow authenticated access
  if (!config || config.isPublic) {
    return true
  }

  const userPerms = getUserPermissions(u)
  const roleName = getUserRoleName(u).toLowerCase()

  // 1. Check if user has any explicit matching permissions
  if (config.permissions && config.permissions.length > 0) {
    const hasMatchingPerm = config.permissions.some((p) =>
      userPerms.includes(p.toLowerCase()) ||
      userPerms.some((up) => up.includes(p.toLowerCase()) || p.toLowerCase().includes(up))
    )
    if (hasMatchingPerm) return true
  }

  // 2. If user permissions array was empty or no match, fallback to role check
  if (config.roles && config.roles.length > 0) {
    const hasMatchingRole = config.roles.some((r) =>
      roleName.includes(r.toLowerCase()) || r.toLowerCase().includes(roleName)
    )
    if (hasMatchingRole) return true
  }

  return false
}
