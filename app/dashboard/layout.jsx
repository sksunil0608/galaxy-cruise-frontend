"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { syncScraperUrlFromSettings } from "./api"

export default function DashboardLayout({ children }) {

  const pathname = usePathname()
  const router = useRouter()
  const hasToken =
    typeof window !== "undefined" && Boolean(localStorage.getItem("token"))

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

  const title = pathname?.startsWith("/dashboard/vendors/")
    ? "Vendor Detail"
    : titles[pathname] || "Dashboard"

  useEffect(() => {
    if (!hasToken) {
      router.replace("/login")
    }
  }, [hasToken, router])

  // Pull the configured scraper URL into localStorage once per dashboard load,
  // so scraperBase() resolves to it instead of the build-time env value.
  useEffect(() => {
    if (hasToken) syncScraperUrlFromSettings()
  }, [hasToken])

  if (!hasToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Redirecting to login...
      </div>
    )
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)"
      }}
    >

      <AppSidebar variant="inset" />

      <SidebarInset>

        <SiteHeader title={title} />

        <div className="flex flex-1 flex-col">

          <div className="@container/main flex flex-1 flex-col gap-2">

            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {children}

            </div>

          </div>

        </div>

      </SidebarInset>

    </SidebarProvider>
  )
}
