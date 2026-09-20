const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:8000/api"

export async function api(url, options = {}) {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("token")
    : null

  const requestUrl = `${API_URL}${url}`

  const res = await fetch(requestUrl, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {})
    }
  })

  const contentType = res.headers.get("content-type") || ""
  const isJson = contentType.includes("application/json")
  const rawBody = await res.text()
  const data = isJson && rawBody ? JSON.parse(rawBody) : null

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
    throw new Error(data.message || "API Error")
  }

  return data
}
