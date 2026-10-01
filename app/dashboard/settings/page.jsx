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
  Activity
} from "lucide-react"

import {
  fetchAppSettings,
  getScraperBaseUrl,
  updateAppSetting,
  SCRAPER_URL_STORAGE_KEY
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

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      // 1. Load Backend API URL
      const currentApi = getApiBaseUrl() || DEFAULT_API_URL
      setApiUrl(currentApi)
      setSavedApiUrl(currentApi)

      // 2. Load Scraper Backend URL
      try {
        const res = await fetchAppSettings()
        const row = (res?.data ?? []).find((s) => s.key === SCRAPER_URL_STORAGE_KEY)
        let val = row?.value || DEFAULT_SCRAPER_URL
        if (val === "http://localhost:3001") {
          val = "http://localhost:3001/api"
        }
        setSavedScraperUrl(val)
        setScraperUpdatedAt(row?.updatedAt ?? null)
        setScraperUrl(val)
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

  // ── Test Backend API URL ───────────────────────────────────────────────────
  const handleTestApi = async () => {
    const target = apiUrl.trim().replace(/\/+$/, "")
    if (!target) return
    setTestingApi(true)
    setApiTestResult(null)
    const started = Date.now()

    try {
      // Test the API endpoint directly or base health
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

  // ── Save Backend API URL ───────────────────────────────────────────────────
  const handleSaveApi = () => {
    const target = apiUrl.trim().replace(/\/+$/, "")
    if (!target) return
    setSavingApi(true)
    setError("")
    setNotice("")

    try {
      setApiBaseUrl(target)
      setSavedApiUrl(target)
      setNotice("Backend API URL saved. All catalog, users, and cruise data requests will now use this URL.")
      setTimeout(() => setNotice(""), 5000)
    } catch (err) {
      setError(err?.message || "Could not save Backend API URL")
    } finally {
      setSavingApi(false)
    }
  }

  // ── Reset Backend API URL ───────────────────────────────────────────────────
  const handleResetApi = () => {
    setApiUrl(DEFAULT_API_URL)
    setApiBaseUrl(DEFAULT_API_URL)
    setSavedApiUrl(DEFAULT_API_URL)
    setApiTestResult(null)
    setNotice(`Backend API URL reset to default (${DEFAULT_API_URL}).`)
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

  // ── Save Scraper Backend URL ───────────────────────────────────────────────
  const handleSaveScraper = async () => {
    const target = scraperUrl.trim().replace(/\/+$/, "")
    if (!target) return
    setSavingScraper(true)
    setError("")
    setNotice("")

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SCRAPER_URL_STORAGE_KEY, target)
      }

      try {
        const res = await updateAppSetting(SCRAPER_URL_STORAGE_KEY, target)
        setSavedScraperUrl(res?.data?.value ?? target)
        setScraperUpdatedAt(res?.data?.updatedAt ?? new Date().toISOString())
      } catch {
        setSavedScraperUrl(target)
      }

      setNotice("Scraper Backend URL saved. Real-time cabin refresh and scraping tasks will now use this URL.")
      setTimeout(() => setNotice(""), 5000)
    } catch (err) {
      setError(err?.message || "Could not save Scraper URL")
    } finally {
      setSavingScraper(false)
    }
  }

  // ── Reset Scraper URL ──────────────────────────────────────────────────────
  const handleResetScraper = () => {
    setScraperUrl(DEFAULT_SCRAPER_URL)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCRAPER_URL_STORAGE_KEY, DEFAULT_SCRAPER_URL)
    }
    setSavedScraperUrl(DEFAULT_SCRAPER_URL)
    setScraperTestResult(null)
    setNotice(`Scraper Backend URL reset to default (${DEFAULT_SCRAPER_URL}).`)
    setTimeout(() => setNotice(""), 5000)
  }

  const isApiDirty = apiUrl.trim().replace(/\/+$/, "") !== (savedApiUrl || "").replace(/\/+$/, "")
  const isScraperDirty = scraperUrl.trim().replace(/\/+$/, "") !== (savedScraperUrl || "").replace(/\/+$/, "")

  return (
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-6 py-5 space-y-5">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-teal-200/80 bg-white px-2.5 py-0.5 text-[11px] font-bold text-teal-800 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
              </span>
              <span>Runtime Config · Microservice Endpoints</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              System Settings & Endpoint Configuration
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
              Configure dynamic microservice endpoints for the Core Backend API and Scraper Worker. Changes take effect immediately without redeploying.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-2xs text-xs font-bold text-slate-700">
              <Activity className="size-3.5 text-teal-700" />
              <span>Configured Endpoints: 2</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold shadow-2xs">
          <XCircle className="size-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold shadow-2xs">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12 text-xs font-semibold text-slate-500 gap-2">
          <Loader2 className="size-4 animate-spin text-teal-700" />
          <span>Loading configuration...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ── Card 1: Core Backend API URL ─────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-2xs space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
                  <Database className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Backend API URL</h2>
                  <p className="text-xs text-slate-500 font-medium">Core database, cruise inventory, users & RBAC</p>
                </div>
              </div>

              <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                Primary API
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Base URL where the core Cruise Saga backend is hosted. Every catalog search, user auth, deck plan, and tag operation is sent here.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Backend API Endpoint URL</span>
                <span className="text-[11px] font-mono text-slate-400 font-normal">Default: {DEFAULT_API_URL}</span>
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
            <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestApi}
                  disabled={testingApi || !apiUrl.trim()}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                >
                  {testingApi ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5 text-teal-700" />}
                  <span>Test Connection</span>
                </button>

                <button
                  onClick={handleResetApi}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                  title="Reset to default URL"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset Default</span>
                </button>
              </div>

              <button
                onClick={handleSaveApi}
                disabled={savingApi || !isApiDirty || !apiUrl.trim()}
                className="inline-flex items-center gap-1.5 h-8.5 px-5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
              >
                {savingApi ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                <span>Save API URL</span>
              </button>
            </div>

            {/* Test Results Output */}
            {apiTestResult && (
              <div
                className={`flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium border ${
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
                <div>
                  <span className="font-bold">{apiTestResult.ok ? "Reachable" : "Connection Failed"}: </span>
                  <span>{apiTestResult.detail}</span>
                  <span className="font-mono text-[11px] ml-1.5 opacity-80">({apiTestResult.ms}ms)</span>
                </div>
              </div>
            )}

            {/* Footer Status Metadata */}
            <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-400">Currently in use:</span>
                <code className="px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-800 font-bold text-xs">
                  {getApiBaseUrl()}
                </code>
              </div>
            </div>
          </div>

          {/* ── Card 2: Scraper Backend URL ─────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-2xs space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
                  <Server className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Scraper Backend URL</h2>
                  <p className="text-xs text-slate-500 font-medium">Scraping worker, session management & cabin pricing refresher</p>
                </div>
              </div>

              <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                Worker Endpoint
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Base URL where the scraper worker service (<code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800 font-semibold text-xs">scrapper-backend</code>) is hosted. Every live pricing refresh and crawl task connects here.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Scraper Base Endpoint URL</span>
                <span className="text-[11px] font-mono text-slate-400 font-normal">Default: {DEFAULT_SCRAPER_URL}</span>
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
            <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestScraper}
                  disabled={testingScraper || !scraperUrl.trim()}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                >
                  {testingScraper ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5 text-teal-700" />}
                  <span>Test Connection</span>
                </button>

                <button
                  onClick={handleResetScraper}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                  title="Reset to default URL"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset Default</span>
                </button>
              </div>

              <button
                onClick={handleSaveScraper}
                disabled={savingScraper || !isScraperDirty || !scraperUrl.trim()}
                className="inline-flex items-center gap-1.5 h-8.5 px-5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
              >
                {savingScraper ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                <span>Save Scraper URL</span>
              </button>
            </div>

            {/* Test Results Output */}
            {scraperTestResult && (
              <div
                className={`flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium border ${
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
                <div>
                  <span className="font-bold">{scraperTestResult.ok ? "Reachable" : "Connection Failed"}: </span>
                  <span>{scraperTestResult.detail}</span>
                  <span className="font-mono text-[11px] ml-1.5 opacity-80">({scraperTestResult.ms}ms)</span>
                </div>
              </div>
            )}

            {/* Footer Status Metadata */}
            <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-400">Currently in use:</span>
                <code className="px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-800 font-bold text-xs">
                  {getScraperBaseUrl()}
                </code>
              </div>
              {scraperUpdatedAt && (
                <div className="text-[11px] text-slate-400">
                  Last updated: {new Date(scraperUpdatedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
