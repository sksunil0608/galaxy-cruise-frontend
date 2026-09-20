"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar"

import {
  LayoutDashboardIcon,
  SearchIcon,
  Layers3Icon,
  ActivityIcon,
  TerminalIcon,
  UsersIcon,
  Tag,
  MousePointerClickIcon,
  ExternalLinkIcon,
  MapIcon,
  SettingsIcon
} from "lucide-react"

export function AppSidebar(props) {

  const pathname = usePathname()
  const { setOpen } = useSidebar()
  const closeTimerRef = React.useRef(null)

  const handleMouseEnter = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setOpen(true)
  }, [setOpen])

  const handleMouseLeave = React.useCallback(() => {
    // A brief delay before collapsing avoids flicker when the cursor briefly
    // crosses the sidebar's edge while it's still animating open/closed —
    // without this, the width change under a stationary cursor can trigger a
    // spurious mouseleave mid-transition, causing it to snap shut and reopen.
    closeTimerRef.current = setTimeout(() => setOpen(false), 150)
  }, [setOpen])

  React.useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [])

  const [user,setUser] = React.useState(null)

  React.useEffect(()=>{
    const u = localStorage.getItem("user")
    if(u) setUser(JSON.parse(u))
  },[])

  const navMain = [
    {
      title:"Dashboard",
      url:"/dashboard",
      icon:<LayoutDashboardIcon/>,
      active: pathname === "/dashboard"
    },
    {
      title:"Search Cruise",
      url:"/dashboard/search-cruise",
      icon:<SearchIcon/>,
      active: pathname === "/dashboard/search-cruise"
    },
    {
      title:"Tagged Cruises",
      url:"/dashboard/tagged-cruises",
      icon:<Tag/>,
      active: pathname === "/dashboard/tagged-cruises"
    },
    {
      title:"Manage Decks",
      url:"/dashboard/ship-decks",
      icon:<Layers3Icon/>,
      active: pathname === "/dashboard/ship-decks"
    },
    {
      title:"Itinerary Manager",
      url:"/dashboard/itinerary-manager",
      icon:<MapIcon/>,
      active: pathname === "/dashboard/itinerary-manager"
    },
  ]

  const adminSection = [
    {
      title:"Operational Health",
      url:"/dashboard/operational-health",
      icon:<ActivityIcon/>,
      active: pathname === "/dashboard/operational-health"
    },
    {
      title:"Ops Console",
      url:"/dashboard/ops-console",
      icon:<TerminalIcon/>,
      active: pathname === "/dashboard/ops-console"
    },
    {
      title:"Vendor Sites",
      url:"/dashboard/vendor-sites",
      icon:<ExternalLinkIcon/>,
      active: pathname === "/dashboard/vendor-sites"
    },
    {
      title:"User Activity",
      url:"/dashboard/user-activity",
      icon:<MousePointerClickIcon/>,
      active: pathname === "/dashboard/user-activity"
    },
    {
      title:"User Management",
      url:"/dashboard/users",
      icon:<UsersIcon/>,
      active: pathname === "/dashboard/users" || pathname === "/dashboard/permission" || pathname === "/dashboard/roles"
    },
    {
      title:"Settings",
      url:"/dashboard/settings",
      icon:<SettingsIcon/>,
      active: pathname === "/dashboard/settings"
    }
  ]

  const sidebarUser = {
    name:user?.name || "Guest",
    email:user?.email || "",
    avatar:"/avatars/default.jpg"
  }

  return (

    <Sidebar
      collapsible="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >

      <SidebarContent>

        <NavMain items={navMain} />

        <SidebarGroupLabel className="pt-4 uppercase tracking-wide">
          Administration
        </SidebarGroupLabel>

        <NavMain items={adminSection} />

      </SidebarContent>


      <SidebarFooter>

        <NavUser user={sidebarUser} />

      </SidebarFooter>

    </Sidebar>

  )
}
