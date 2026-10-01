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

export function AppSidebar(props) {
  const pathname = usePathname()
  const router = useRouter()
  const { toggleSidebar, open, isMobile } = useSidebar()
  const [user, setUser] = React.useState(null)

  React.useEffect(() => {
    try {
      const u = localStorage.getItem("user")
      if (u) setUser(JSON.parse(u))
    } catch {}
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    router.push("/login")
  }

  const name = user?.name || "Admin User"
  const email = user?.email || "admin@cruisesaga.com"

  const navOverview = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
      color: "text-sky-600",
      activeBg: "bg-sky-500/10 text-sky-950 border-l-4 border-sky-600"
    },
    {
      title: "Search Cruise",
      url: "/dashboard/search-cruise",
      icon: Search,
      active: pathname === "/dashboard/search-cruise",
      color: "text-teal-600",
      activeBg: "bg-teal-500/10 text-teal-950 border-l-4 border-teal-600"
    },
    {
      title: "Tagged Cruises",
      url: "/dashboard/tagged-cruises",
      icon: Tag,
      active: pathname === "/dashboard/tagged-cruises",
      color: "text-amber-500",
      activeBg: "bg-amber-500/10 text-amber-950 border-l-4 border-amber-500"
    },
    {
      title: "Manage Decks",
      url: "/dashboard/ship-decks",
      icon: Layers,
      active: pathname === "/dashboard/ship-decks",
      color: "text-purple-600",
      activeBg: "bg-purple-500/10 text-purple-950 border-l-4 border-purple-600"
    },
    {
      title: "Itinerary Manager",
      url: "/dashboard/itinerary-manager",
      icon: MapPin,
      active: pathname === "/dashboard/itinerary-manager",
      color: "text-rose-500",
      activeBg: "bg-rose-500/10 text-rose-950 border-l-4 border-rose-500"
    }
  ]

  const navAdmin = [
    {
      title: "Operational Health",
      url: "/dashboard/operational-health",
      icon: Activity,
      active: pathname === "/dashboard/operational-health",
      color: "text-emerald-600",
      activeBg: "bg-emerald-500/10 text-emerald-950 border-l-4 border-emerald-600"
    },
    {
      title: "Ops Console",
      url: "/dashboard/ops-console",
      icon: Terminal,
      active: pathname === "/dashboard/ops-console",
      color: "text-cyan-600",
      activeBg: "bg-cyan-500/10 text-cyan-950 border-l-4 border-cyan-600"
    },
    {
      title: "Vendor Sites",
      url: "/dashboard/vendor-sites",
      icon: ExternalLink,
      active: pathname === "/dashboard/vendor-sites",
      color: "text-blue-600",
      activeBg: "bg-blue-500/10 text-blue-950 border-l-4 border-blue-600"
    },
    {
      title: "User Activity",
      url: "/dashboard/user-activity",
      icon: MousePointerClick,
      active: pathname === "/dashboard/user-activity",
      color: "text-orange-500",
      activeBg: "bg-orange-500/10 text-orange-950 border-l-4 border-orange-500"
    },
    {
      title: "User Management",
      url: "/dashboard/users",
      icon: Users,
      active: pathname === "/dashboard/users" || pathname === "/dashboard/permission" || pathname === "/dashboard/roles",
      color: "text-fuchsia-600",
      activeBg: "bg-fuchsia-500/10 text-fuchsia-950 border-l-4 border-fuchsia-600"
    }
  ]

  const navSettings = [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings,
      active: pathname === "/dashboard/settings",
      color: "text-slate-600",
      activeBg: "bg-slate-500/10 text-slate-950 border-l-4 border-slate-700"
    }
  ]

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-slate-200/80 bg-white"
      {...props}
    >
      {/* ── Brand Header with Official Logo ─────────────────────────────── */}
      <SidebarHeader className="flex h-16 items-center px-4 border-b border-slate-200/80 bg-white">
        <a href="/dashboard" className="flex items-center gap-2 overflow-hidden py-1">
          <img
            src="https://cruisesaga.com/cruisesaga.png"
            alt="Cruise Saga"
            className="h-8 w-auto object-contain"
          />
        </a>
      </SidebarHeader>

      {/* ── Sidebar Navigation Categories ──────────────────────────────── */}
      <SidebarContent className="px-3 py-4 space-y-4 bg-white">
        {/* OVERVIEW Group */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Overview
          </SidebarGroupLabel>
          <SidebarMenu className="mt-1 space-y-1">
            {navOverview.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={<a href={item.url} />}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 ${
                    item.active
                      ? "bg-teal-50 text-teal-950 font-bold border-l-2 border-teal-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon
                    size={16}
                    className={item.active ? item.color : "text-slate-400 group-hover:text-slate-600"}
                  />
                  <span className="truncate">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* FLEET OPERATIONS Group */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Fleet Operations
          </SidebarGroupLabel>
          <SidebarMenu className="mt-1 space-y-1">
            {navAdmin.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={<a href={item.url} />}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 ${
                    item.active
                      ? "bg-teal-50 text-teal-950 font-bold border-l-2 border-teal-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon
                    size={16}
                    className={item.active ? item.color : "text-slate-400 group-hover:text-slate-600"}
                  />
                  <span className="truncate">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* SETTINGS Group */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Settings
          </SidebarGroupLabel>
          <SidebarMenu className="mt-1 space-y-1">
            {navSettings.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={<a href={item.url} />}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 ${
                    item.active
                      ? "bg-teal-50 text-teal-950 font-bold border-l-2 border-teal-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon
                    size={16}
                    className={item.active ? item.color : "text-slate-400 group-hover:text-slate-600"}
                  />
                  <span className="truncate">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Sidebar User Footer ─────────────────── */}
      <SidebarFooter className="border-t border-slate-200/80 p-3 bg-white">
        <div className="flex items-center justify-between rounded-lg bg-slate-50/80 p-2 border border-slate-200/80 transition">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-md bg-teal-700 text-white font-bold text-xs shadow-2xs">
              {name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col truncate">
              <span className="truncate text-xs font-bold text-slate-800 leading-tight">{name}</span>
              <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide">Administrator</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Log out"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-600 transition cursor-pointer"
          >
            <LogOut size={14} />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
