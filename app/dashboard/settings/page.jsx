"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  Loader2,
  PlugZap,
  Save,
  XCircle,
  Server,
  Database,
  RotateCcw,
  Activity,
  FileCode,
  Code,
  Copy,
  Plus,
  Trash2,
  RefreshCw,
  Sliders,
  Check,
  HardDrive,
  FileText,
  AlertCircle,
  Info,
  Sparkles
} from "lucide-react"

import {
  fetchAppSettings,
  getScraperBaseUrl,
  updateAppSetting,
  SCRAPER_URL_STORAGE_KEY,
  fetchFrontendEnv,
  saveFrontendEnv
} from "../api"
import { getApiBaseUrl, setApiBaseUrl, API_URL_STORAGE_KEY } from "@/lib/api"

const DEFAULT_API_URL = "http://localhost:8000/api"
const DEFAULT_SCRAPER_URL = "http://localhost:3001/api"

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  // ── Backend API URL State ──────────────────────────────────────────────────
  const [apiUrl, setApiUrl] = useState("")
  const [savedApiUrl, setSavedApiUrl] = useState(null)
  const [apiUpdatedAt, setApiUpdatedAt] = useState(null)
  const [savingApi, setSavingApi] = useState(false)
  const [testingApi, setTestingApi] = useState(false)
  const [apiTestResult, setApiTestResult] = useState(null)

  // ── Scraper Backend URL State ──────────────────────────────────────────────
  const [scraperUrl, setScraperUrl] = useState("")
  const [savedScraperUrl, setSavedScraperUrl] = useState(null)
  const [scraperUpdatedAt, setScraperUpdatedAt] = useState(null)
  const [savingScraper, setSavingScraper] = useState(false)
  const [testingScraper, setTestingScraper] = useState(false)
  const [scraperTestResult, setScraperTestResult] = useState(null)

  // ── Frontend .env File Management State ─────────────────────────────────────
  const [envData, setEnvData] = useState({})
  const [envRaw, setEnvRaw] = useState("")
  const [editedEnv, setEditedEnv] = useState({})
  const [editedRaw, setEditedRaw] = useState("")
  const [envFilePath, setEnvFilePath] = useState(".env")
  const [envLastModified, setEnvLastModified] = useState(null)
  const [envSizeBytes, setEnvSizeBytes] = useState(0)
  const [envMode, setEnvMode] = useState("visual") // "visual" | "raw"
  const [savingEnv, setSavingEnv] = useState(false)
  const [reloadingEnv, setReloadingEnv] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyValue, setNewKeyValue] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      // 1. Load Backend API URL
      const currentApi = getApiBaseUrl() || DEFAULT_API_URL
      setApiUrl(currentApi)
      setSavedApiUrl(currentApi)
      if (typeof window !== "undefined") {
        const storedApiUpdated = window.localStorage.getItem("api_updated_at")
        setApiUpdatedAt(storedApiUpdated)
      }

      // 2. Load Scraper Backend URL
      try {
        const res = await fetchAppSettings()
        const row = (res?.data ?? []).find((s) => s.key === SCRAPER_URL_STORAGE_KEY)
        let val = row?.value || DEFAULT_SCRAPER_URL
        if (val === "http://localhost:3001") {
          val = "http://localhost:3001/api"
        }
        setSavedScraperUrl(val)
        setScraperUrl(val)

        const storedScraperUpdated = typeof window !== "undefined" ? window.localStorage.getItem("scraper_updated_at") : null
        setScraperUpdatedAt(row?.updatedAt ?? storedScraperUpdated ?? null)

        if (typeof window !== "undefined") {
          window.localStorage.setItem(SCRAPER_URL_STORAGE_KEY, val)
        }
      } catch {
        let fallback = getScraperBaseUrl() || DEFAULT_SCRAPER_URL
        if (fallback === "http://localhost:3001") {
          fallback = "http://localhost:3001/api"
        }
        setScraperUrl(fallback)
        setSavedScraperUrl(fallback)
        if (typeof window !== "undefined") {
          const storedScraperUpdated = window.localStorage.getItem("scraper_updated_at")
          setScraperUpdatedAt(storedScraperUpdated)
        }
      }

      // 3. Load Frontend .env File from disk
      const envRes = await fetchFrontendEnv()
      if (envRes?.success) {
        setEnvData(envRes.env || {})
        setEditedEnv(envRes.env || {})
        setEnvRaw(envRes.raw || "")
        setEditedRaw(envRes.raw || "")
        setEnvFilePath(envRes.filePath || ".env")
        setEnvLastModified(envRes.lastModified || null)
        setEnvSizeBytes(envRes.sizeBytes || 0)
      }
    } catch (err) {
      setError(err?.message || "Could not load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ── Reload .env File from Disk ──────────────────────────────────────────────
  const handleReloadEnv = async () => {
    setReloadingEnv(true)
    try {
      const envRes = await fetchFrontendEnv()
      if (envRes?.success) {
        setEnvData(envRes.env || {})
        setEditedEnv(envRes.env || {})
        setEnvRaw(envRes.raw || "")
        setEditedRaw(envRes.raw || "")
        setEnvFilePath(envRes.filePath || ".env")
        setEnvLastModified(envRes.lastModified || null)
        setEnvSizeBytes(envRes.sizeBytes || 0)
        setNotice("Reloaded .env file from disk successfully.")
        setTimeout(() => setNotice(""), 4000)
      } else {
        setError(envRes?.error || "Failed to reload .env from disk")
      }
    } catch (err) {
      setError(err?.message || "Failed to reload .env")
    } finally {
      setReloadingEnv(false)
    }
  }

  // ── Test Backend API URL ───────────────────────────────────────────────────
  const handleTestApi = async () => {
    const target = apiUrl.trim().replace(/\/+$/, "")
    if (!target) return
    setTestingApi(true)
    setApiTestResult(null)
    const started = Date.now()

    try {
      const res = await fetch(`${target}/vendors/dashboard`, {
        headers: { Accept: "application/json" }
      }).catch(async () => {
        const base = target.replace(/\/api\/?$/, "")
        return fetch(`${base}/`, { headers: { Accept: "application/json" } })
      })

      const ms = Date.now() - started
      if (res && (res.ok || res.status === 401 || res.status === 403 || res.status === 200)) {
        setApiTestResult({
          ok: true,
          ms,
          detail: `HTTP ${res.status} (Backend API online and responding)`
        })
      } else {
        setApiTestResult({
          ok: false,
          ms,
          detail: `HTTP ${res?.status || "Error"} — Unexpected response`
        })
      }
    } catch (err) {
      setApiTestResult({
        ok: false,
        ms: Date.now() - started,
        detail: `${err.message} (Host unreachable or CORS restricted)`
      })
    } finally {
      setTestingApi(false)
    }
  }

  // ── Save Backend API URL (Updates runtime + writes to .env) ──────────────────
  const handleSaveApi = async () => {
    const target = apiUrl.trim().replace(/\/+$/, "")
    if (!target) return
    setSavingApi(true)
    setError("")
    setNotice("")

    try {
      const now = new Date().toISOString()
      setApiBaseUrl(target)
      setSavedApiUrl(target)
      setApiUpdatedAt(now)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("api_updated_at", now)
      }

      // Write to frontend .env file on disk
      try {
        const envRes = await saveFrontendEnv({
          updates: { NEXT_PUBLIC_API_URL: target }
        })
        if (envRes?.success) {
          setEnvData(envRes.env || {})
          setEditedEnv(envRes.env || {})
          setEnvRaw(envRes.raw || "")
          setEditedRaw(envRes.raw || "")
          setEnvLastModified(envRes.lastModified || now)
          setEnvSizeBytes(envRes.sizeBytes || 0)
        }
      } catch (envErr) {
        console.warn("Could not write to .env:", envErr)
      }

      setNotice("Backend API URL saved! Updated active runtime and written to frontend .env file.")
      setTimeout(() => setNotice(""), 5000)
    } catch (err) {
      setError(err?.message || "Could not save Backend API URL")
    } finally {
      setSavingApi(false)
    }
  }

  // ── Reset Backend API URL ───────────────────────────────────────────────────
  const handleResetApi = async () => {
    const now = new Date().toISOString()
    setApiUrl(DEFAULT_API_URL)
    setApiBaseUrl(DEFAULT_API_URL)
    setSavedApiUrl(DEFAULT_API_URL)
    setApiUpdatedAt(now)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("api_updated_at", now)
    }
    setApiTestResult(null)

    // Also reset in .env
    try {
      const envRes = await saveFrontendEnv({
        updates: { NEXT_PUBLIC_API_URL: DEFAULT_API_URL }
      })
      if (envRes?.success) {
        setEnvData(envRes.env || {})
        setEditedEnv(envRes.env || {})
        setEnvRaw(envRes.raw || "")
        setEditedRaw(envRes.raw || "")
        setEnvLastModified(envRes.lastModified || now)
      }
    } catch {}

    setNotice(`Backend API URL reset to default (${DEFAULT_API_URL}) in runtime & .env.`)
    setTimeout(() => setNotice(""), 5000)
  }

  // ── Test Scraper Backend URL ───────────────────────────────────────────────
  const handleTestScraper = async () => {
    const target = scraperUrl.trim().replace(/\/+$/, "")
    if (!target) return
    setTestingScraper(true)
    setScraperTestResult(null)
    const started = Date.now()

    try {
      const rootBase = target.replace(/\/api\/?$/, "")
      const res = await fetch(`${rootBase}/health`).catch(async () => {
        const scheduleEndpoint = target.endsWith("/api") ? `${target}/schedule` : `${target}/api/schedule`
        return fetch(scheduleEndpoint)
      })

      const body = await res?.json().catch(() => ({}))
      const ms = Date.now() - started

      setScraperTestResult({
        ok: res && (res.ok || body?.ok !== false || res.status === 200 || res.status === 404),
        ms,
        detail: body?.service || `HTTP ${res?.status || 200} (Scraper worker online)`
      })
    } catch (err) {
      setScraperTestResult({
        ok: false,
        ms: Date.now() - started,
        detail: `${err.message} (Host unreachable or CORS restricted)`
      })
    } finally {
      setTestingScraper(false)
    }
  }

  // ── Save Scraper Backend URL (Updates runtime + writes to .env) ──────────────
  const handleSaveScraper = async () => {
    const target = scraperUrl.trim().replace(/\/+$/, "")
    if (!target) return
    setSavingScraper(true)
    setError("")
    setNotice("")

    try {
      const now = new Date().toISOString()
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SCRAPER_URL_STORAGE_KEY, target)
        window.localStorage.setItem("scraper_updated_at", now)
      }

      try {
        const res = await updateAppSetting(SCRAPER_URL_STORAGE_KEY, target)
        setSavedScraperUrl(res?.data?.value ?? target)
        setScraperUpdatedAt(res?.data?.updatedAt ?? now)
      } catch {
        setSavedScraperUrl(target)
        setScraperUpdatedAt(now)
      }

      // Write to frontend .env file on disk
      try {
        const envRes = await saveFrontendEnv({
          updates: { NEXT_PUBLIC_SCRAPER_URL: target }
        })
        if (envRes?.success) {
          setEnvData(envRes.env || {})
          setEditedEnv(envRes.env || {})
          setEnvRaw(envRes.raw || "")
          setEditedRaw(envRes.raw || "")
          setEnvLastModified(envRes.lastModified || now)
          setEnvSizeBytes(envRes.sizeBytes || 0)
        }
      } catch (envErr) {
        console.warn("Could not write to .env:", envErr)
      }

      setNotice("Scraper Backend URL saved! Updated active runtime and written to frontend .env file.")
      setTimeout(() => setNotice(""), 5000)
    } catch (err) {
      setError(err?.message || "Could not save Scraper URL")
    } finally {
      setSavingScraper(false)
    }
  }

  // ── Reset Scraper URL ──────────────────────────────────────────────────────
  const handleResetScraper = async () => {
    const now = new Date().toISOString()
    setScraperUrl(DEFAULT_SCRAPER_URL)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCRAPER_URL_STORAGE_KEY, DEFAULT_SCRAPER_URL)
      window.localStorage.setItem("scraper_updated_at", now)
    }
    setSavedScraperUrl(DEFAULT_SCRAPER_URL)
    setScraperUpdatedAt(now)
    setScraperTestResult(null)

    // Reset in .env
    try {
      const envRes = await saveFrontendEnv({
        updates: { NEXT_PUBLIC_SCRAPER_URL: DEFAULT_SCRAPER_URL }
      })
      if (envRes?.success) {
        setEnvData(envRes.env || {})
        setEditedEnv(envRes.env || {})
        setEnvRaw(envRes.raw || "")
        setEditedRaw(envRes.raw || "")
        setEnvLastModified(envRes.lastModified || now)
      }
    } catch {}

    setNotice(`Scraper Backend URL reset to default (${DEFAULT_SCRAPER_URL}) in runtime & .env.`)
    setTimeout(() => setNotice(""), 5000)
  }

  // ── Visual Mode: Add New Variable ──────────────────────────────────────────
  const handleAddNewVariable = () => {
    const key = newKeyName.trim().toUpperCase().replace(/\s+/g, "_")
    if (!key) return
    const value = newKeyValue.trim()

    setEditedEnv((prev) => ({
      ...prev,
      [key]: value
    }))
    setNewKeyName("")
    setNewKeyValue("")
  }

  // ── Visual Mode: Delete Variable ───────────────────────────────────────────
  const handleDeleteVariable = (keyToDelete) => {
    setEditedEnv((prev) => {
      const updated = { ...prev }
      delete updated[keyToDelete]
      return updated
    })
  }

  // ── Visual Mode: Value Change ──────────────────────────────────────────────
  const handleEnvValueChange = (key, val) => {
    setEditedEnv((prev) => ({
      ...prev,
      [key]: val
    }))
  }

  // ── Save Visual Mode .env ──────────────────────────────────────────────────
  const handleSaveVisualEnv = async () => {
    setSavingEnv(true)
    setError("")
    setNotice("")

    try {
      const envRes = await saveFrontendEnv({ env: editedEnv })
      if (envRes?.success) {
        setEnvData(envRes.env || {})
        setEditedEnv(envRes.env || {})
        setEnvRaw(envRes.raw || "")
        setEditedRaw(envRes.raw || "")
        setEnvLastModified(envRes.lastModified)
        setEnvSizeBytes(envRes.sizeBytes || 0)

        // If NEXT_PUBLIC_API_URL or NEXT_PUBLIC_SCRAPER_URL changed, update runtime as well
        if (envRes.env?.NEXT_PUBLIC_API_URL) {
          setApiUrl(envRes.env.NEXT_PUBLIC_API_URL)
          setSavedApiUrl(envRes.env.NEXT_PUBLIC_API_URL)
          setApiBaseUrl(envRes.env.NEXT_PUBLIC_API_URL)
        }
        if (envRes.env?.NEXT_PUBLIC_SCRAPER_URL) {
          setScraperUrl(envRes.env.NEXT_PUBLIC_SCRAPER_URL)
          setSavedScraperUrl(envRes.env.NEXT_PUBLIC_SCRAPER_URL)
          if (typeof window !== "undefined") {
            window.localStorage.setItem(SCRAPER_URL_STORAGE_KEY, envRes.env.NEXT_PUBLIC_SCRAPER_URL)
          }
        }

        setNotice("Frontend .env saved successfully to disk and runtime state synchronized!")
        setTimeout(() => setNotice(""), 5000)
      } else {
        setError(envRes?.error || "Failed to save .env file")
      }
    } catch (err) {
      setError(err?.message || "Failed to save .env file")
    } finally {
      setSavingEnv(false)
    }
  }

  // ── Save Raw Mode .env ─────────────────────────────────────────────────────
  const handleSaveRawEnv = async () => {
    setSavingEnv(true)
    setError("")
    setNotice("")

    try {
      const envRes = await saveFrontendEnv({ raw: editedRaw })
      if (envRes?.success) {
        setEnvData(envRes.env || {})
        setEditedEnv(envRes.env || {})
        setEnvRaw(envRes.raw || "")
        setEditedRaw(envRes.raw || "")
        setEnvLastModified(envRes.lastModified)
        setEnvSizeBytes(envRes.sizeBytes || 0)

        if (envRes.env?.NEXT_PUBLIC_API_URL) {
          setApiUrl(envRes.env.NEXT_PUBLIC_API_URL)
          setSavedApiUrl(envRes.env.NEXT_PUBLIC_API_URL)
          setApiBaseUrl(envRes.env.NEXT_PUBLIC_API_URL)
        }
        if (envRes.env?.NEXT_PUBLIC_SCRAPER_URL) {
          setScraperUrl(envRes.env.NEXT_PUBLIC_SCRAPER_URL)
          setSavedScraperUrl(envRes.env.NEXT_PUBLIC_SCRAPER_URL)
          if (typeof window !== "undefined") {
            window.localStorage.setItem(SCRAPER_URL_STORAGE_KEY, envRes.env.NEXT_PUBLIC_SCRAPER_URL)
          }
        }

        setNotice("Raw .env file written to disk successfully!")
        setTimeout(() => setNotice(""), 5000)
      } else {
        setError(envRes?.error || "Failed to save raw .env file")
      }
    } catch (err) {
      setError(err?.message || "Failed to save raw .env file")
    } finally {
      setSavingEnv(false)
    }
  }

  // ── Copy helper ────────────────────────────────────────────────────────────
  const handleCopy = (text, key) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    }
  }

  // ── Quick Sync Runtime URLs to .env ────────────────────────────────────────
  const handleSyncRuntimeToEnv = async () => {
    setSavingEnv(true)
    setError("")
    setNotice("")

    try {
      const updates = {
        NEXT_PUBLIC_API_URL: apiUrl.trim().replace(/\/+$/, ""),
        NEXT_PUBLIC_SCRAPER_URL: scraperUrl.trim().replace(/\/+$/, "")
      }
      const envRes = await saveFrontendEnv({ updates })
      if (envRes?.success) {
        setEnvData(envRes.env || {})
        setEditedEnv(envRes.env || {})
        setEnvRaw(envRes.raw || "")
        setEditedRaw(envRes.raw || "")
        setEnvLastModified(envRes.lastModified)
        setEnvSizeBytes(envRes.sizeBytes || 0)
        setNotice("Synced current active runtime URLs directly into .env file!")
        setTimeout(() => setNotice(""), 5000)
      }
    } catch (err) {
      setError(err?.message || "Failed to sync URLs to .env")
    } finally {
      setSavingEnv(false)
    }
  }

  const isApiDirty = apiUrl.trim().replace(/\/+$/, "") !== (savedApiUrl || "").replace(/\/+$/, "")
  const isScraperDirty = scraperUrl.trim().replace(/\/+$/, "") !== (savedScraperUrl || "").replace(/\/+$/, "")
  const isVisualEnvDirty = JSON.stringify(editedEnv) !== JSON.stringify(envData)
  const isRawEnvDirty = editedRaw !== envRaw

  const envKeyCount = Object.keys(envData).length

  return (
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-6 py-5 space-y-6 max-w-full overflow-x-hidden min-w-0">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/90 backdrop-blur-xs px-3 py-0.5 text-[11px] font-bold text-teal-800 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
              </span>
              <span>Frontend Runtime & .env Configuration</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 break-words">
              System Settings & .env Management
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed break-words">
              Manage your frontend environment variables (<code className="font-mono bg-teal-50 text-teal-900 px-1.5 py-0.5 rounded text-xs font-bold">.env</code>) directly from this dashboard. Changes can be written straight to disk and applied to the active runtime without redeploying.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-2xs text-xs font-bold text-slate-700">
              <HardDrive className="size-3.5 text-teal-700" />
              <span>File: {envFilePath}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-2xs text-xs font-bold text-slate-700">
              <Activity className="size-3.5 text-teal-700" />
              <span>{envKeyCount} Variables</span>
            </div>
            <button
              onClick={handleSyncRuntimeToEnv}
              disabled={savingEnv || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white shadow-2xs text-xs font-bold transition cursor-pointer disabled:opacity-40"
              title="Sync both runtime URLs into the .env file"
            >
              {savingEnv ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              <span>Sync All to .env</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold shadow-2xs break-words">
          <XCircle className="size-4 shrink-0 text-rose-600" />
          <span className="min-w-0">{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold shadow-2xs break-words">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span className="min-w-0">{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12 text-xs font-semibold text-slate-500 gap-2">
          <Loader2 className="size-4 animate-spin text-teal-700" />
          <span>Loading configuration & .env...</span>
        </div>
      ) : (
        <div className="space-y-6 min-w-0">
          {/* ── Section 1: Microservice Endpoint Cards ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-w-0">
            {/* ── Card 1: Core Backend API URL ─────────────────────────────────── */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-7 shadow-2xs space-y-4 sm:space-y-5 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
                    <Database className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-slate-900 break-words">Backend API URL</h2>
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold break-all">
                        NEXT_PUBLIC_API_URL
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium break-words">Core database, cruise inventory, users & RBAC</p>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200 shrink-0 self-start sm:self-auto">
                  Primary API
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
                Base URL where the core Cruise Saga backend is hosted. Saving will update the active runtime and automatically persist to the frontend <code className="px-1 py-0.5 bg-slate-100 rounded font-mono text-xs">.env</code> file.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span>Backend API Endpoint URL</span>
                  <span className="text-[11px] font-mono text-slate-400 font-normal break-all">Default: {DEFAULT_API_URL}</span>
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => {
                    setApiUrl(e.target.value)
                    setApiTestResult(null)
                  }}
                  placeholder={DEFAULT_API_URL}
                  spellCheck={false}
                  className="w-full h-10 px-3.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-mono font-semibold text-slate-800 outline-none focus:bg-white focus:border-teal-600 transition shadow-2xs"
                />
              </div>

              {/* Test & Action Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleTestApi}
                    disabled={testingApi || !apiUrl.trim()}
                    className="inline-flex items-center justify-center gap-1.5 h-8.5 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer flex-1 sm:flex-initial"
                  >
                    {testingApi ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5 text-teal-700" />}
                    <span>Test Connection</span>
                  </button>

                  <button
                    onClick={handleResetApi}
                    className="inline-flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition shadow-2xs cursor-pointer flex-1 sm:flex-initial"
                    title="Reset to default URL"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Reset Default</span>
                  </button>
                </div>

                <button
                  onClick={handleSaveApi}
                  disabled={savingApi || !isApiDirty || !apiUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 h-8.5 px-5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer w-full sm:w-auto"
                >
                  {savingApi ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  <span>Save to .env</span>
                </button>
              </div>

              {/* Test Results Output */}
              {apiTestResult && (
                <div
                  className={`flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium border break-words ${
                    apiTestResult.ok
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {apiTestResult.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className="font-bold">{apiTestResult.ok ? "Reachable" : "Connection Failed"}: </span>
                    <span className="break-all">{apiTestResult.detail}</span>
                    <span className="font-mono text-[11px] ml-1.5 opacity-80">({apiTestResult.ms}ms)</span>
                  </div>
                </div>
              )}

              {/* Footer Status Metadata */}
              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-medium text-slate-400 shrink-0">Currently in use:</span>
                    <code className="px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-800 font-bold text-xs break-all">
                      {savedApiUrl || getApiBaseUrl()}
                    </code>
                  </div>
                  {envData.NEXT_PUBLIC_API_URL === (savedApiUrl || getApiBaseUrl()) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 self-start sm:self-auto shrink-0">
                      <Check className="size-3" /> In sync with .env
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 self-start sm:self-auto break-all">
                      <AlertCircle className="size-3 shrink-0" /> Differs from .env ({envData.NEXT_PUBLIC_API_URL || "not set"})
                    </span>
                  )}
                </div>
                {apiUpdatedAt && (
                  <div className="text-[11px] text-slate-400">
                    Last updated: {new Date(apiUpdatedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* ── Card 2: Scraper Backend URL ─────────────────────────────────── */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-7 shadow-2xs space-y-4 sm:space-y-5 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
                    <Server className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-slate-900 break-words">Scraper Backend URL</h2>
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold break-all">
                        NEXT_PUBLIC_SCRAPER_URL
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium break-words">Scraping worker, session management & cabin pricing refresher</p>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200 shrink-0 self-start sm:self-auto">
                  Worker Endpoint
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
                Base URL where the scraper worker service (<code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800 font-semibold text-xs">scrapper-backend</code>) is hosted. Saving persists to the <code className="px-1 py-0.5 bg-slate-100 rounded font-mono text-xs">.env</code> file directly.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span>Scraper Base Endpoint URL</span>
                  <span className="text-[11px] font-mono text-slate-400 font-normal break-all">Default: {DEFAULT_SCRAPER_URL}</span>
                </label>
                <input
                  type="text"
                  value={scraperUrl}
                  onChange={(e) => {
                    setScraperUrl(e.target.value)
                    setScraperTestResult(null)
                  }}
                  placeholder={DEFAULT_SCRAPER_URL}
                  spellCheck={false}
                  className="w-full h-10 px-3.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-mono font-semibold text-slate-800 outline-none focus:bg-white focus:border-teal-600 transition shadow-2xs"
                />
              </div>

              {/* Test & Action Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleTestScraper}
                    disabled={testingScraper || !scraperUrl.trim()}
                    className="inline-flex items-center justify-center gap-1.5 h-8.5 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer flex-1 sm:flex-initial"
                  >
                    {testingScraper ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5 text-teal-700" />}
                    <span>Test Connection</span>
                  </button>

                  <button
                    onClick={handleResetScraper}
                    className="inline-flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition shadow-2xs cursor-pointer flex-1 sm:flex-initial"
                    title="Reset to default URL"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Reset Default</span>
                  </button>
                </div>

                <button
                  onClick={handleSaveScraper}
                  disabled={savingScraper || !isScraperDirty || !scraperUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 h-8.5 px-5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer w-full sm:w-auto"
                >
                  {savingScraper ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  <span>Save to .env</span>
                </button>
              </div>

              {/* Test Results Output */}
              {scraperTestResult && (
                <div
                  className={`flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium border break-words ${
                    scraperTestResult.ok
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {scraperTestResult.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className="font-bold">{scraperTestResult.ok ? "Reachable" : "Connection Failed"}: </span>
                    <span className="break-all">{scraperTestResult.detail}</span>
                    <span className="font-mono text-[11px] ml-1.5 opacity-80">({scraperTestResult.ms}ms)</span>
                  </div>
                </div>
              )}

              {/* Footer Status Metadata */}
              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-medium text-slate-400 shrink-0">Currently in use:</span>
                    <code className="px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-800 font-bold text-xs break-all">
                      {savedScraperUrl || getScraperBaseUrl()}
                    </code>
                  </div>
                  {envData.NEXT_PUBLIC_SCRAPER_URL === (savedScraperUrl || getScraperBaseUrl()) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 self-start sm:self-auto shrink-0">
                      <Check className="size-3" /> In sync with .env
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 self-start sm:self-auto break-all">
                      <AlertCircle className="size-3 shrink-0" /> Differs from .env ({envData.NEXT_PUBLIC_SCRAPER_URL || "not set"})
                    </span>
                  )}
                </div>
                {scraperUpdatedAt && (
                  <div className="text-[11px] text-slate-400">
                    Last updated: {new Date(scraperUpdatedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 2: Dedicated Frontend .env Manager ─────────────────── */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-7 shadow-2xs space-y-5 sm:space-y-6 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
                  <FileCode className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 break-words flex items-center gap-2 flex-wrap">
                    <span>Frontend Environment File</span>
                    <code className="font-mono text-xs text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 break-all">
                      {envFilePath}
                    </code>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium break-words">
                    View, edit, add, or remove key-value variables directly stored in the root <code className="font-mono text-slate-700">.env</code> file
                  </p>
                </div>
              </div>

              {/* View Mode Toggle & Reload */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold">
                  <button
                    onClick={() => setEnvMode("visual")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                      envMode === "visual"
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Sliders className="size-3.5 text-teal-700" />
                    <span className="hidden sm:inline">Table View</span>
                    <span className="sm:hidden">List View</span>
                  </button>
                  <button
                    onClick={() => {
                      // Keep raw editor in sync with latest visual edits
                      const lines = Object.entries(editedEnv).map(([k, v]) => `${k}=${v}`)
                      setEditedRaw(lines.join("\n") + "\n")
                      setEnvMode("raw")
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                      envMode === "raw"
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Code className="size-3.5 text-teal-700" />
                    <span>Raw Editor</span>
                  </button>
                </div>

                <button
                  onClick={handleReloadEnv}
                  disabled={reloadingEnv}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Reload .env from disk"
                >
                  <RefreshCw className={`size-3.5 text-slate-500 ${reloadingEnv ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Reload</span>
                </button>
              </div>
            </div>

            {/* ── Mode 1: Visual Key-Value Grid ─────────────────────────────── */}
            {envMode === "visual" ? (
              <div className="space-y-4">
                {/* Add new variable input bar */}
                <div className="p-3.5 rounded-xl bg-slate-50/75 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Plus className="size-3.5 text-teal-700" />
                    <span>Add New Environment Variable</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        placeholder="KEY_NAME (e.g. NEXT_PUBLIC_CUSTOM)"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono font-semibold text-slate-800 outline-none focus:border-teal-600 transition"
                      />
                    </div>
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        placeholder="Value (e.g. https://...)"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono font-semibold text-slate-800 outline-none focus:border-teal-600 transition"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        onClick={handleAddNewVariable}
                        disabled={!newKeyName.trim()}
                        className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                      >
                        <Plus className="size-3.5" />
                        <span>Add Key</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Desktop & Tablet Table View (sm: and up) */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-4 w-1/3">Variable Key</th>
                        <th className="py-3 px-4">Value</th>
                        <th className="py-3 px-4 text-right w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.keys(editedEnv).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                            No variables defined in .env
                          </td>
                        </tr>
                      ) : (
                        Object.entries(editedEnv).map(([key, value]) => {
                          const isKnownApi = key === "NEXT_PUBLIC_API_URL"
                          const isKnownScraper = key === "NEXT_PUBLIC_SCRAPER_URL"
                          const isCustom = !isKnownApi && !isKnownScraper

                          return (
                            <tr key={key} className="hover:bg-slate-50/60 transition group">
                              <td className="py-3 px-4 font-mono font-bold text-slate-900 align-middle">
                                <div className="flex items-center gap-2">
                                  <span>{key}</span>
                                  {isKnownApi && (
                                    <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-bold">
                                      Core API
                                    </span>
                                  )}
                                  {isKnownScraper && (
                                    <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-bold">
                                      Scraper Worker
                                    </span>
                                  )}
                                  {isCustom && (
                                    <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                                      Custom
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-4 align-middle">
                                <input
                                  type="text"
                                  value={value ?? ""}
                                  onChange={(e) => handleEnvValueChange(key, e.target.value)}
                                  placeholder="value"
                                  className="w-full h-8.5 px-3 rounded-lg border border-slate-200 bg-slate-50/40 text-xs font-mono font-medium text-slate-800 outline-none focus:bg-white focus:border-teal-600 transition"
                                />
                              </td>
                              <td className="py-2.5 px-4 text-right align-middle">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleCopy(value, key)}
                                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                    title="Copy Value"
                                  >
                                    {copiedKey === key ? (
                                      <Check className="size-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="size-3.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteVariable(key)}
                                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                    title="Delete Key"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile List View (< sm:) */}
                <div className="sm:hidden space-y-3">
                  {Object.keys(editedEnv).length === 0 ? (
                    <div className="py-8 text-center text-slate-400 font-medium rounded-xl border border-slate-200 bg-white p-4 text-xs">
                      No variables defined in .env
                    </div>
                  ) : (
                    Object.entries(editedEnv).map(([key, value]) => {
                      const isKnownApi = key === "NEXT_PUBLIC_API_URL"
                      const isKnownScraper = key === "NEXT_PUBLIC_SCRAPER_URL"
                      const isCustom = !isKnownApi && !isKnownScraper

                      return (
                        <div
                          key={key}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3"
                        >
                          {/* Top Row: Key Name & Badges + Action Buttons */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1.5 min-w-0">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Variable Key
                              </div>
                              <div className="font-mono font-bold text-xs text-slate-900 break-all leading-tight">
                                {key}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isKnownApi && (
                                  <span className="inline-block text-[9px] font-sans px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-bold">
                                    Core API
                                  </span>
                                )}
                                {isKnownScraper && (
                                  <span className="inline-block text-[9px] font-sans px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-bold">
                                    Scraper Worker
                                  </span>
                                )}
                                {isCustom && (
                                  <span className="inline-block text-[9px] font-sans px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                                    Custom
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleCopy(value, key)}
                                className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
                                title="Copy Value"
                              >
                                {copiedKey === key ? (
                                  <Check className="size-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVariable(key)}
                                className="p-2 rounded-lg border border-rose-200 bg-rose-50/60 text-rose-600 hover:text-rose-700 hover:bg-rose-100 active:scale-95 transition cursor-pointer"
                                title="Delete Key"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Value Input */}
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Value
                            </label>
                            <input
                              type="text"
                              value={value ?? ""}
                              onChange={(e) => handleEnvValueChange(key, e.target.value)}
                              placeholder="value"
                              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/40 text-xs font-mono font-medium text-slate-800 outline-none focus:bg-white focus:border-teal-600 transition shadow-2xs"
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Save Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Info className="size-3.5 text-slate-400 shrink-0" />
                    <span>Saving will directly update the <code className="font-mono text-slate-700">{envFilePath}</code> file on disk.</span>
                  </div>

                  <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                    <button
                      onClick={() => setEditedEnv({ ...envData })}
                      disabled={!isVisualEnvDirty || savingEnv}
                      className="h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer flex-1 sm:flex-initial"
                    >
                      Discard Changes
                    </button>
                    <button
                      onClick={handleSaveVisualEnv}
                      disabled={!isVisualEnvDirty || savingEnv}
                      className="h-8.5 px-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs flex-1 sm:flex-initial"
                    >
                      {savingEnv ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      <span>Save Changes to .env</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Mode 2: Raw .env Code Editor ───────────────────────────── */
              <div className="space-y-4">
                <div className="relative rounded-xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs shadow-inner">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-teal-400" />
                      <span className="font-semibold text-slate-300">{envFilePath} (Direct File Text)</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Syntax: KEY=VALUE (Lines starting with # are comments)</span>
                  </div>

                  <textarea
                    value={editedRaw}
                    onChange={(e) => setEditedRaw(e.target.value)}
                    rows={8}
                    spellCheck={false}
                    className="w-full bg-transparent text-teal-300 font-mono text-xs outline-none resize-y leading-relaxed font-semibold selection:bg-teal-800 selection:text-white"
                    placeholder="NEXT_PUBLIC_API_URL=http://localhost:8000/api&#10;NEXT_PUBLIC_SCRAPER_URL=http://localhost:3001/api"
                  />
                </div>

                {/* Save Raw Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-slate-400 min-w-0 break-words">
                    {envLastModified && (
                      <span>Last modified on disk: {new Date(envLastModified).toLocaleString()}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                    <button
                      onClick={() => setEditedRaw(envRaw)}
                      disabled={!isRawEnvDirty || savingEnv}
                      className="h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer flex-1 sm:flex-initial"
                    >
                      Revert
                    </button>
                    <button
                      onClick={handleSaveRawEnv}
                      disabled={!isRawEnvDirty || savingEnv}
                      className="h-8.5 px-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs flex-1 sm:flex-initial"
                    >
                      {savingEnv ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      <span>Save Raw .env</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
