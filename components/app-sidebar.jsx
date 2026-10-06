"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"

import {
  LayoutDashboard,
  Search,
  Tag,
  Layers,
  MapPin,
  Activity,
  Terminal,
  ExternalLink,
  MousePointerClick,
  Users,
  Settings,
  LogOut
} from "lucide-react"
import { getUserRoleName, hasRouteAccess } from "@/lib/auth"

export function AppSidebar(props) {
  const pathname = usePathname()
  const router = useRouter()
  const { toggleSidebar, open, isMobile } = useSidebar()
  const [user, setUser] = React.useState(null)
  const [mounted, setMounted] = React.useState(false)

  const syncUserFromStorage = React.useCallback(() => {
    try {
      const u = localStorage.getItem("user")
      if (u) {
        setUser(JSON.parse(u))
      }
    } catch { }
  }, [])

  React.useEffect(() => {
    setMounted(true)
    syncUserFromStorage()

    const handleStorageChange = () => syncUserFromStorage()
    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("auth-update", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("auth-update", handleStorageChange)
    }
  }, [syncUserFromStorage])

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    localStorage.removeItem("permissions")
    router.push("/login")
  }

  const name = user?.name || "User"
  const roleName = getUserRoleName(user)
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "US"

  const rawOverview = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      title: "Search Cruise",
      url: "/dashboard/search-cruise",
      icon: Search,
      active: pathname === "/dashboard/search-cruise",
    },
    {
      title: "Tagged Cruises",
      url: "/dashboard/tagged-cruises",
      icon: Tag,
      active: pathname === "/dashboard/tagged-cruises",
    },
    {
      title: "Manage Decks",
      url: "/dashboard/ship-decks",
      icon: Layers,
      active: pathname === "/dashboard/ship-decks",
    },
    {
      title: "Itinerary Manager",
      url: "/dashboard/itinerary-manager",
      icon: MapPin,
      active: pathname === "/dashboard/itinerary-manager",
    }
  ]

  const rawAdmin = [
    {
      title: "Operational Health",
      url: "/dashboard/operational-health",
      icon: Activity,
      active: pathname === "/dashboard/operational-health",
    },
    {
      title: "Ops Console",
      url: "/dashboard/ops-console",
      icon: Terminal,
      active: pathname === "/dashboard/ops-console",
    },
    {
      title: "Vendor Sites",
      url: "/dashboard/vendor-sites",
      icon: ExternalLink,
      active: pathname === "/dashboard/vendor-sites",
    },
    {
      title: "User Activity",
      url: "/dashboard/user-activity",
      icon: MousePointerClick,
      active: pathname === "/dashboard/user-activity",
    },
    {
      title: "User Management",
      url: "/dashboard/users",
      icon: Users,
      active: pathname === "/dashboard/users" || pathname === "/dashboard/permission" || pathname === "/dashboard/roles",
    }
  ]

  const rawSettings = [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings,
      active: pathname === "/dashboard/settings",
    }
  ]

  // Filter items according to permissions / role access (only after mounted on client)
  const navOverview = React.useMemo(() => {
    if (!mounted) return rawOverview
    return rawOverview.filter((item) => hasRouteAccess(item.url, user))
  }, [rawOverview, user, mounted])

  const navAdmin = React.useMemo(() => {
    if (!mounted) return rawAdmin
    return rawAdmin.filter((item) => hasRouteAccess(item.url, user))
  }, [rawAdmin, user, mounted])

  const navSettings = React.useMemo(() => {
    if (!mounted) return rawSettings
    return rawSettings.filter((item) => hasRouteAccess(item.url, user))
  }, [rawSettings, user, mounted])

  const renderNavGroup = (label, items) => {
    if (!items || items.length === 0) return null

    return (
      <SidebarGroup className="p-0">
        <SidebarGroupLabel className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 select-none">
          {label}
        </SidebarGroupLabel>
        <SidebarMenu className="space-y-1">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                render={<a href={item.url} />}
                className={`group flex h-10 w-full items-center gap-3.5 rounded-xl px-3.5 text-[13px] transition-all duration-150 cursor-pointer ${item.active
                    ? "bg-[#0d6d63] text-white font-semibold shadow-sm shadow-[#0d6d63]/25"
                    : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-2xs font-medium"
                  }`}
              >
                <item.icon
                  size={17}
                  strokeWidth={item.active ? 2.2 : 1.9}
                  className={`shrink-0 transition-colors ${item.active ? "text-teal-200" : "text-slate-500 group-hover:text-slate-800"
                    }`}
                />
                <span className="truncate flex-1">{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    )
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-[#dbe7e4] bg-[#f0f5f4] text-slate-800 shadow-[1px_0_10px_rgba(0,0,0,0.015)]"
      suppressHydrationWarning
      {...props}
    >
      {/* ── Brand Header with 2-Color Galaxy Cruise Title ─────────────── */}
      <SidebarHeader className="flex flex-row h-16 shrink-0 items-center justify-start px-4.5 border-b border-[#dbe7e4] bg-[#f0f5f4]">
        <a
          href="/dashboard"
          className="flex items-center gap-2 overflow-hidden py-1 transition-opacity hover:opacity-90 select-none"
        >
          <span className="font-black text-[19px] tracking-tight leading-none">
            <span className="text-[#0d6d63]">Galaxy</span>{" "}
            <span className="text-[#d97736]">Cruise</span>
          </span>
        </a>
      </SidebarHeader>

      {/* ── Sidebar Navigation Categories ──────────────────────────────── */}
      <SidebarContent className="px-3.5 py-4 space-y-5 bg-[#f0f5f4] overflow-y-auto" suppressHydrationWarning>
        {renderNavGroup("Overview", navOverview)}
        {renderNavGroup("Fleet Operations", navAdmin)}
        {renderNavGroup("Settings", navSettings)}
      </SidebarContent>

      {/* ── Sidebar User Footer ─────────────────── */}
      <SidebarFooter className="border-t border-[#dbe7e4] p-3 bg-[#f0f5f4]" suppressHydrationWarning>
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/90 border border-[#dbe7e4] shadow-2xs">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-[#0d6d63] text-white font-bold text-xs shadow-xs">
              {mounted ? initials : "US"}
            </div>
            <div className="flex flex-col truncate min-w-0" suppressHydrationWarning>
              <span className="truncate text-xs font-bold text-slate-900 leading-tight">
                {mounted ? name : "User"}
              </span>
              <span className="text-[10.5px] font-semibold text-teal-700 truncate tracking-tight">
                {mounted ? roleName : "User"}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Log out"
            className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ml-1"
          >
            <LogOut size={15} />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
