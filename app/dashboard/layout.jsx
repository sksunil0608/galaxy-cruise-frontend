"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { ShieldAlert, ArrowLeft } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { syncScraperUrlFromSettings } from "./api"
import { hasRouteAccess } from "@/lib/auth"

export default function DashboardLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(true)

  const titles = {
    "/dashboard": "Dashboard",
    "/dashboard/search-cruise": "Search Cruise",
    "/dashboard/tagged-cruises": "Tagged Cruises",
    "/dashboard/ship-decks": "Manage Decks",
    "/dashboard/itinerary-manager": "Itinerary Manager",
    "/dashboard/operational-health": "Operational Health",
    "/dashboard/vendors": "All Vendors",
    "/dashboard/ops-console": "Ops Console",
    "/dashboard/vendor-sites": "Vendor Sites",
    "/dashboard/debug-console": "Debug Console",
    "/dashboard/users": "User Management",
    "/dashboard/teams": "Team Management",
    "/dashboard/permission": "User Management",
    "/dashboard/roles": "User Management",
    "/dashboard/settings": "Settings"
  }

  const normalizedPathname = pathname ? pathname.replace(/\/+$/, "") || "/dashboard" : "/dashboard"

  const title = normalizedPathname.startsWith("/dashboard/vendors/")
    ? "Vendor Detail"
    : titles[normalizedPathname] || "Dashboard"

  useEffect(() => {
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        router.replace("/login")
        return
      }

      syncScraperUrlFromSettings()

      // Route-level permission check
      const hasAccess = hasRouteAccess(normalizedPathname)
      if (!hasAccess && normalizedPathname !== "/dashboard") {
        setAuthorized(false)
        toast.error("Access Restricted", {
          description: "You do not have permission to access this page."
        })
        router.replace("/dashboard")
      } else {
        setAuthorized(true)
      }
    } catch {
      // In case localStorage is disabled or restricted
    }
  }, [router, normalizedPathname])

  return (
    <SidebarProvider
      defaultOpen={true}
      style={{
        "--sidebar-width": "16.5rem",
        "--header-height": "4rem"
      }}
    >
      <AppSidebar variant="sidebar" />

      <SidebarInset className="bg-[#f8fafc] min-h-screen flex flex-col m-0 rounded-none shadow-none w-full max-w-full min-w-0 overflow-x-hidden">
        <SiteHeader title={title} />
        <div className="flex-1 w-full max-w-full min-w-0 overflow-x-hidden">
          {!authorized && normalizedPathname !== "/dashboard" ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mb-4 shadow-xs">
                <ShieldAlert size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Access Restricted</h2>
              <p className="text-sm text-slate-500 max-w-md mb-6">
                Your account role does not have permission to access this section. Please contact your system administrator if you believe this is an error.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2 px-4 py-2 bg-[#0d6d63] hover:bg-[#0b5b52] text-white text-sm font-semibold rounded-xl shadow-xs transition"
              >
                <ArrowLeft size={16} />
                Return to Dashboard
              </button>
            </div>
          ) : (
            children
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

