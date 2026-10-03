export const API_URL_STORAGE_KEY = "apiUrl"

export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(API_URL_STORAGE_KEY)
    if (stored) return stored.trim().replace(/\/+$/, "")
  }
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").trim().replace(/\/+$/, "")
}

export function setApiBaseUrl(url) {
  if (typeof window !== "undefined") {
    if (url) {
      window.localStorage.setItem(API_URL_STORAGE_KEY, url.trim().replace(/\/+$/, ""))
    } else {
      window.localStorage.removeItem(API_URL_STORAGE_KEY)
    }
  }
}

export async function api(url, options = {}) {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("token")
    : null

  const baseUrl = getApiBaseUrl()
  const path = url.startsWith("/") ? url : `/${url}`
  const requestUrl = `${baseUrl}${path}`

  let res
  try {
    res = await fetch(requestUrl, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(options.headers || {})
      }
    })
  } catch (networkError) {
    throw new Error(
      `Unable to connect to backend server at ${baseUrl}. Please ensure the server is running and verify the API URL in Settings.`
    )
  }

  const contentType = res.headers.get("content-type") || ""
  const isJson = contentType.includes("application/json")
  const rawBody = await res.text()
  let data = null
  if (isJson && rawBody) {
    try {
      data = JSON.parse(rawBody)
    } catch {
      data = null
    }
  }

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token")
      localStorage.removeItem("permissions")
      localStorage.removeItem("user")

      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
    }

    throw new Error(data?.message || "Unauthorized")
  }

  if (!isJson) {
    throw new Error(`Expected JSON response from ${requestUrl} but received ${contentType || "non-JSON content"}`)
  }

  if (!res.ok) {
    throw new Error(data?.message || `API Error (${res.status})`)
  }

  return data
}
