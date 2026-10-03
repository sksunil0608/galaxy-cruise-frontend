"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Globe, KeyRound, RefreshCw, ShieldCheck } from "lucide-react"

import { checkAllVendorAuth, getVendorSchedules } from "../api"

// Real vendor portal login URLs — for manually opening the actual site to
// log in and verify data by eye, separate from the automated scraper runs.
const VENDOR_SITE_URLS = {
  celestyal:               "https://sale.celestyal.com",
  azamara:                 "https://connect.azamara.com/login",
  cruisingpower:           "https://secure.cruisingpower.com/login",
  msc:                     "https://www.mscbook.com/",
  goccl:                   "https://www.goccl.com/",
  completecruisesolutionA: "https://www.completecruisesolution.com/Login.aspx",
  completecruisesolutionB: "https://www.completecruisesolution.com/Login.aspx",
  gohal:                   "https://gohal.com/",
  firstmates:              "https://www.firstmates.com/login",
  seawebagents:            "https://seawebagents.ncl.com/Security/login/",
}

const VENDOR_PRETTY_NAMES = {
  celestyal:               "Celestyal Cruises",
  azamara:                 "Azamara Club Cruises",
  cruisingpower:           "Cruising Power (RCL / Celebrity / Silversea)",
  msc:                     "MSC Cruises Bookings",
  goccl:                   "GOCCL (Carnival Cruise Line)",
  completecruisesolutionA: "Complete Cruise Solution A (P&O / Cunard)",
  completecruisesolutionB: "Complete Cruise Solution B (Princess)",
  gohal:                   "Go HAL (Holland America Line)",
  firstmates:              "FirstMates (Virgin Voyages)",
  seawebagents:            "SeaWeb (Norwegian Cruise Line)",
}

function authStatusStyle(status) {
  if (status === "ok")       return "bg-emerald-50 text-emerald-800 border-emerald-200"
  if (status === "skipped")  return "bg-slate-100 text-slate-600 border-slate-200"
  if (status === "checking") return "bg-sky-50 text-sky-700 border-sky-200"
  return "bg-rose-50 text-rose-700 border-rose-200"
}

export default function VendorSitesPage() {
  const [loading, setLoading]         = useState(true)
  const [vendorKeys, setVendorKeys]   = useState([])
  const [authResults, setAuthResults] = useState({})
  const [authRunning, setAuthRunning] = useState(false)

  useEffect(() => {
    getVendorSchedules()
      .then(res => {
        const keys = [...new Set((res.schedules ?? []).map(s => s.vendorKey))]
        setVendorKeys(keys.length > 0 ? keys : Object.keys(VENDOR_SITE_URLS))
      })
      .catch(() => setVendorKeys(Object.keys(VENDOR_SITE_URLS)))
      .finally(() => setLoading(false))
  }, [])

  async function runAuthCheck() {
    setAuthRunning(true)
    const checking = {}
    for (const key of vendorKeys) checking[key] = { status: "checking" }
    setAuthResults(checking)
    try {
      const res = await checkAllVendorAuth()
      const map = {}
      for (const v of res.vendors ?? []) map[v.key] = v
      setAuthResults(map)
    } catch (err) {
      setAuthResults({ _error: err.message })
    } finally {
      setAuthRunning(false)
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4">
      {/* ── Top Header Banner ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/90 backdrop-blur-xs px-3 py-0.5 text-[11px] font-bold text-teal-800 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
              </span>
              <span>Carrier Portals · External Live Access Directory</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Vendor Sites & Booking Portals
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">
              Direct access to vendor booking portals to verify login credentials, active agent sessions, and scraped inventory accuracy.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={runAuthCheck}
              disabled={authRunning}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 h-9 text-xs font-bold text-white shadow-xs transition hover:bg-teal-800 active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              <KeyRound size={13} className={authRunning ? "animate-spin" : ""} />
              <span>{authRunning ? "Verifying Credentials…" : "Verify All Auth"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Vendor Table & Mobile List */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        {/* Mobile List View (block md:hidden) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="px-4 py-12 text-center text-xs text-slate-400 font-medium">
              Loading vendor directories…
            </div>
          ) : (
            vendorKeys.map(key => {
              const auth = authResults[key]
              const url = VENDOR_SITE_URLS[key]
              const prettyName = VENDOR_PRETTY_NAMES[key] || key

              return (
                <div key={key} className="p-4 bg-white hover:bg-slate-50/70 transition space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 border border-teal-200/80 text-teal-800 font-bold text-xs shadow-2xs">
                        {key.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">{prettyName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{key}</div>
                      </div>
                    </div>

                    {auth && (
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0 ${authStatusStyle(auth.status)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        <span>{auth.status === "ok" ? "Authenticated" : auth.status}</span>
                      </span>
                    )}
                  </div>

                  {url && (
                    <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-2.5 flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-[11px] text-slate-500 truncate" title={url}>
                        {url.replace(/^https?:\/\//, "")}
                      </span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shrink-0 shadow-2xs"
                      >
                        <span>Launch</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Desktop Table View (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Carrier / Vendor Key</th>
                <th className="px-4 py-3">Portal URL</th>
                <th className="px-4 py-3">Authentication Status</th>
                <th className="px-4 py-3 text-right">Direct Launch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                    Loading vendor directories…
                  </td>
                </tr>
              ) : (
                vendorKeys.map(key => {
                  const auth = authResults[key]
                  const url = VENDOR_SITE_URLS[key]
                  const prettyName = VENDOR_PRETTY_NAMES[key] || key

                  return (
                    <tr key={key} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 border border-teal-200/80 text-teal-800 font-bold text-xs">
                            {key.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{prettyName}</div>
                            <div className="font-mono text-[10px] text-slate-400">{key}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {url ? (
                          <span className="font-mono text-[11px] text-slate-500 max-w-xs truncate block" title={url}>
                            {url.replace(/^https?:\/\//, "")}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {auth ? (
                          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${authStatusStyle(auth.status)}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            <span>{auth.status === "ok" ? "Authenticated" : auth.status}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 h-8 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                          >
                            <span>Open Portal</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
