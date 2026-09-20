"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"

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

function authStatusStyle(status) {
  if (status === "ok")       return "bg-emerald-100 text-emerald-700"
  if (status === "skipped")  return "bg-slate-100 text-slate-500"
  if (status === "checking") return "bg-sky-100 text-sky-600"
  return "bg-rose-100 text-rose-700"
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
        setVendorKeys(keys)
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
    <div className="min-h-screen bg-slate-50 px-6 py-4">
      <div className="mx-auto max-w-[900px] space-y-6">

        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Vendor Sites</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Real portal links</h1>
          <p className="mt-2 text-sm text-slate-500">
            Open any vendor's actual website to log in and verify data by eye.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={runAuthCheck}
            disabled={authRunning}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {authRunning ? "Checking auth…" : "Check All Auth"}
          </button>
        </div>

        {/* Vendor list */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Vendor</th>
                  <th className="px-5 py-3">Auth</th>
                  <th className="px-5 py-3 text-right">Real site</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-400">Loading vendors…</td></tr>
                ) : (
                  vendorKeys.map(key => {
                    const auth = authResults[key]
                    return (
                      <tr key={key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-900">{key}</td>
                        <td className="px-5 py-3">
                          {auth ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${authStatusStyle(auth.status)}`}>
                              {auth.status}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {VENDOR_SITE_URLS[key] ? (
                            <a
                              href={VENDOR_SITE_URLS[key]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            >
                              <ExternalLink size={12} />
                              Open
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
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
    </div>
  )
}
