"use client"

import React from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { NavUser } from "@/components/nav-user"
import { usePathname } from "next/navigation"

export function SiteHeader({ title }) {
  const pathname = usePathname()
  const [user, setUser] = React.useState({
    name: "Admin User",
    email: "admin@cruisesaga.com",
    avatar: "/avatars/default.jpg"
  })

  React.useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user")
      if (storedUser) {
        const parsed = JSON.parse(storedUser)
        setUser({
          name: parsed.name || "Admin User",
          email: parsed.email || "admin@cruisesaga.com",
          avatar: parsed.avatar || "/avatars/default.jpg"
        })
      }
    } catch {
      // Keep default
    }
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3 sm:px-4 backdrop-blur-md transition-all">
      {/* ── Left Title / Breadcrumb ────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1 text-slate-500 hover:text-slate-900" />
        <Separator orientation="vertical" className="mx-2 h-4" />
        <span className="text-sm font-semibold text-slate-900">{title}</span>
      </div>

      {/* ── Right User Profile Menu ────────────────────────────────────── */}
      <div className="max-w-xs">
        <NavUser user={user} />
      </div>
    </header>
  )
}