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
    },
    {
      title: "Search Cruise",
      url: "/dashboard/search-cruise",
      icon: Search,
      active: pathname === "/dashboard/search-cruise",
      color: "text-teal-600",
    },
    {
      title: "Tagged Cruises",
      url: "/dashboard/tagged-cruises",
      icon: Tag,
      active: pathname === "/dashboard/tagged-cruises",
      color: "text-amber-500",
    },
    {
      title: "Manage Decks",
      url: "/dashboard/ship-decks",
      icon: Layers,
      active: pathname === "/dashboard/ship-decks",
      color: "text-purple-600",
    },
    {
      title: "Itinerary Manager",
      url: "/dashboard/itinerary-manager",
      icon: MapPin,
      active: pathname === "/dashboard/itinerary-manager",
      color: "text-rose-500",
    }
  ]

  const navAdmin = [
    {
      title: "Operational Health",
      url: "/dashboard/operational-health",
      icon: Activity,
      active: pathname === "/dashboard/operational-health",
      color: "text-emerald-600",
    },
    {
      title: "Ops Console",
      url: "/dashboard/ops-console",
      icon: Terminal,
      active: pathname === "/dashboard/ops-console",
      color: "text-cyan-600",
    },
    {
      title: "Vendor Sites",
      url: "/dashboard/vendor-sites",
      icon: ExternalLink,
      active: pathname === "/dashboard/vendor-sites",
      color: "text-blue-600",
    },
    {
      title: "User Activity",
      url: "/dashboard/user-activity",
      icon: MousePointerClick,
      active: pathname === "/dashboard/user-activity",
      color: "text-orange-500",
    },
    {
      title: "User Management",
      url: "/dashboard/users",
      icon: Users,
      active: pathname === "/dashboard/users" || pathname === "/dashboard/permission" || pathname === "/dashboard/roles",
      color: "text-fuchsia-600",
    }
  ]

  const navSettings = [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings,
      active: pathname === "/dashboard/settings",
      color: "text-slate-600",
    }
  ]

  const renderNavGroup = (label, items) => (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] select-none">
        {label}
      </SidebarGroupLabel>
      <SidebarMenu className="space-y-1.5">
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              render={<a href={item.url} />}
              className={`group flex h-10.5 w-full items-center gap-3.5 rounded-xl px-3.5 text-[13.5px] transition-colors duration-150 ${
                item.active
                  ? "bg-[#e6f4f1] text-[#0d6d63] font-semibold"
                  : "text-[#334155] hover:bg-black/[0.04] hover:text-[#0f172a] font-medium"
              }`}
            >
              <item.icon
                size={18}
                strokeWidth={item.active ? 2.1 : 1.8}
                className={item.active ? "text-[#0d6d63] shrink-0" : "text-[#475569] group-hover:text-[#0f172a] shrink-0"}
              />
              <span className="truncate flex-1">{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-[#e5e7eb] bg-[#f4f5f7] text-slate-800"
      {...props}
    >
      {/* ── Brand Header with Official Logo ─────────────────────────────── */}
      <SidebarHeader className="flex h-16 shrink-0 items-center justify-between px-4.5 border-b border-[#e5e7eb] bg-[#f4f5f7]">
        <a
          href="/dashboard"
          className="flex items-center gap-2 overflow-hidden py-1 transition-opacity hover:opacity-90"
        >
          <img
            src="https://cruisesaga.com/cruisesaga.png"
            alt="Cruise Saga"
            className="h-8 w-auto object-contain"
          />
        </a>
      </SidebarHeader>

      {/* ── Sidebar Navigation Categories ──────────────────────────────── */}
      <SidebarContent className="px-3.5 py-4 space-y-6 bg-[#f4f5f7] overflow-y-auto">
        {renderNavGroup("Overview", navOverview)}
        {renderNavGroup("Fleet Operations", navAdmin)}
        {renderNavGroup("Settings", navSettings)}
      </SidebarContent>

      {/* ── Sidebar User Footer ─────────────────── */}
      <SidebarFooter className="border-t border-[#e5e7eb] p-3.5 bg-[#f4f5f7]">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e2e8f0] text-[#475569] font-bold text-xs">
              <Users size={16} />
            </div>
            <div className="flex flex-col truncate">
              <span className="truncate text-[13px] font-bold text-slate-900 leading-tight">{name}</span>
              <span className="text-[10.5px] font-semibold text-[#64748b] uppercase tracking-wider">Admin</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Log out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] hover:text-slate-900 hover:bg-black/[0.04] transition cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
