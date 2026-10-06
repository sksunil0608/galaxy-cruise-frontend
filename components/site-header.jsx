"use client"

import React from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { NavUser } from "@/components/nav-user"
import { usePathname } from "next/navigation"

export function SiteHeader({ title }) {
  const pathname = usePathname()
  const [user, setUser] = React.useState(null)

  const syncUser = React.useCallback(() => {
    try {
      const storedUser = localStorage.getItem("user")
      if (storedUser) {
        setUser(JSON.parse(storedUser))
      }
    } catch {
      // Keep default
    }
  }, [])

  React.useEffect(() => {
    syncUser()
    const handleUpdate = () => syncUser()
    window.addEventListener("storage", handleUpdate)
    window.addEventListener("auth-update", handleUpdate)
    return () => {
      window.removeEventListener("storage", handleUpdate)
      window.removeEventListener("auth-update", handleUpdate)
    }
  }, [syncUser])

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full max-w-full min-w-0 shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3 sm:px-4 backdrop-blur-md transition-all">
      {/* ── Left Title / Breadcrumb ────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <SidebarTrigger className="ml-0.5 lg:-ml-1 text-slate-500 hover:text-slate-900 shrink-0" />
        <Separator orientation="vertical" className="mx-1 sm:mx-2 h-4 shrink-0" />
        <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{title}</span>
      </div>

      {/* ── Right User Profile Menu ────────────────────────────────────── */}
      <div className="max-w-[220px] sm:max-w-xs shrink-0">
        <NavUser user={user} />
      </div>
    </header>
  )
}