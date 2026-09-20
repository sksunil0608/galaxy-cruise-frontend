"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Loader2, PlugZap, Save, XCircle } from "lucide-react"

import {
  fetchAppSettings,
  getScraperBaseUrl,
  updateAppSetting
} from "../api"

const SCRAPER_KEY = "scraperUrl"

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [scraperUrl, setScraperUrl] = useState("")
  const [savedUrl, setSavedUrl] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  // null = not tested yet
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetchAppSettings()
      const row = (res?.data ?? []).find(s => s.key === SCRAPER_KEY)
      setSavedUrl(row?.value ?? null)
      setUpdatedAt(row?.updatedAt ?? null)
      // Show the effective URL when nothing has been saved yet, so the field
      // reflects what the app is actually calling rather than sitting empty.
      setScraperUrl(row?.value ?? getScraperBaseUrl())
    } catch (err) {
      setError(err?.message || "Could not load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleTest = async () => {
    const target = scraperUrl.trim().replace(/\/+$/, "")
    if (!target) return
    setTesting(true)
    setTestResult(null)
    const started = Date.now()
    try {
      const res = await fetch(`${target}/health`)
      const body = await res.json().catch(() => ({}))
      setTestResult({
        ok: res.ok && body?.ok !== false,
        ms: Date.now() - started,
        detail: body?.service ?? `HTTP ${res.status}`
      })
    } catch (err) {
      // A cross-origin block and a dead host both land here — say so plainly
      // instead of implying the URL is definitely wrong.
      setTestResult({
        ok: false,
        ms: Date.now() - started,
        detail: `${err.message} (host unreachable, or it isn't allowing requests from this origin)`
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const res = await updateAppSetting(SCRAPER_KEY, scraperUrl)
      setSavedUrl(res?.data?.value ?? null)
      setUpdatedAt(res?.data?.updatedAt ?? null)
      setScraperUrl(res?.data?.value ?? scraperUrl)
      setNotice("Saved. Scraper actions now use this URL.")
    } catch (err) {
      setError(err?.message || "Could not save")
    } finally {
      setSaving(false)
    }
  }

  const dirty = savedUrl !== null
    ? scraperUrl.trim().replace(/\/+$/, "") !== savedUrl
    : scraperUrl.trim() !== ""

  return (
    <div style={{ padding: "0 24px", maxWidth: 820 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
          Runtime configuration. Changes apply without redeploying the frontend.
        </p>
      </div>

      {error ? (
        <div style={banner("#fef2f2", "#fecaca", "#991b1b")}>{error}</div>
      ) : null}
      {notice ? (
        <div style={banner("#f0fdf4", "#bbf7d0", "#166534")}>{notice}</div>
      ) : null}

      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <PlugZap size={17} style={{ color: "#4f46e5" }} />
          <h2 style={{ fontSize: 15, fontWeight: 650, margin: 0 }}>Scraper backend URL</h2>
        </div>
        <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 14px" }}>
          Base URL where scrapper-backend is hosted. Every scraper action —
          triggering runs, refreshing cabins, health checks — is sent here.
        </p>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b" }}>
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <input
              value={scraperUrl}
              onChange={e => { setScraperUrl(e.target.value); setTestResult(null) }}
              placeholder="https://scraper.example.com"
              spellCheck={false}
              style={input}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={handleTest} disabled={testing || !scraperUrl.trim()} style={btnGhost}>
                {testing ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
                Test connection
              </button>
              <button onClick={handleSave} disabled={saving || !dirty || !scraperUrl.trim()} style={btnPrimary(!saving && dirty && !!scraperUrl.trim())}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </div>

            {testResult ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 12, fontSize: 12.5, color: testResult.ok ? "#166534" : "#991b1b" }}>
                {testResult.ok ? <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
                <span>
                  {testResult.ok ? "Reachable" : "Not reachable"} — {testResult.detail} ({testResult.ms}ms)
                </span>
              </div>
            ) : null}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
              <div>
                Currently in use:{" "}
                <code style={code}>{getScraperBaseUrl()}</code>
              </div>
              {savedUrl === null ? (
                <div style={{ marginTop: 6 }}>
                  Nothing saved yet — falling back to the build-time
                  <code style={code}>NEXT_PUBLIC_SCRAPER_URL</code> or localhost.
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  Last changed: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

const card = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20
}

const input = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 13.5,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  outline: "none",
  background: "#f8fafc"
}

const btnBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 9,
  cursor: "pointer"
}

const btnGhost = {
  ...btnBase,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155"
}

const btnPrimary = enabled => ({
  ...btnBase,
  border: "none",
  background: enabled ? "linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)" : "#cbd5e1",
  color: "#fff",
  cursor: enabled ? "pointer" : "not-allowed"
})

const code = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  background: "#f1f5f9",
  padding: "1px 6px",
  borderRadius: 5,
  fontSize: 11.5,
  margin: "0 3px"
}

const banner = (bg, border, color) => ({
  background: bg,
  border: `1px solid ${border}`,
  color,
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 13,
  marginBottom: 14
})
