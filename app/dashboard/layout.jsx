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
      } else {
        syncScraperUrlFromSettings()
      }
    } catch {
      // In case localStorage is disabled or restricted
    }
  }, [router])

  return (
    <SidebarProvider
      defaultOpen={true}
      style={{
        "--sidebar-width": "16.5rem",
        "--header-height": "4rem"
      }}
    >
      <AppSidebar variant="sidebar" />

      <SidebarInset className="bg-[#f8fafc] min-h-screen flex flex-col m-0 rounded-none shadow-none w-full max-w-full min-w-0">
        <SiteHeader title={title} />
        <div className="flex-1 w-full max-w-full min-w-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
