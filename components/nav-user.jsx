"use client"

import React, { useState, useEffect } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOutIcon, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { getUserRoleName } from "@/lib/auth"

export function NavUser({ user }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Dynamic user data
  const displayName = mounted && user?.name ? user.name : "User"
  const displayEmail = mounted && user?.email ? user.email : "user@cruisesaga.com"
  const roleName = mounted ? getUserRoleName(user) : "User"

  // Dynamic initials
  const getInitials = (userName) => {
    if (!userName || userName === "Guest") return "US"
    const parts = userName.trim().split(" ")
    return parts.length === 1
      ? parts[0].slice(0, 2).toUpperCase()
      : (parts[0][0] + parts[1][0]).toUpperCase()
  }

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    localStorage.removeItem("permissions")
    router.push("/login")
  }

  const triggerContent = (
    <>
      <div className="hidden sm:flex flex-col text-right leading-tight max-w-[170px]" suppressHydrationWarning>
        <span className="truncate text-xs font-bold text-slate-800">{displayName}</span>
        <span className="truncate text-[11px] text-slate-500 font-medium">
          {displayEmail}
        </span>
      </div>

      <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-md bg-[#0d6d63] text-white font-bold text-xs shadow-xs" suppressHydrationWarning>
        {getInitials(displayName)}
      </div>
    </>
  )

  if (!mounted) {
    return (
      <div className="relative" suppressHydrationWarning>
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200/90 bg-white shadow-2xs">
          {triggerContent}
        </div>
      </div>
    )
  }

  return (
    <div className="relative" suppressHydrationWarning>
      <DropdownMenu>
        <DropdownMenuTrigger
          id="nav-user-dropdown-trigger"
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer outline-none focus:outline-none focus:ring-0 shadow-2xs"
        >
          {triggerContent}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-64 rounded-xl p-2 shadow-xl border border-slate-200/90 bg-white mt-1"
          side="bottom"
          align="end"
          sideOffset={6}
        >
          <div className="flex items-center gap-3 p-2.5 bg-slate-50/90 rounded-lg border border-slate-100">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#0d6d63] text-white font-bold text-xs shadow-xs">
              {getInitials(displayName)}
            </div>

            <div className="grid flex-1 text-left text-xs leading-tight min-w-0" suppressHydrationWarning>
              <span className="truncate font-bold text-slate-900">{displayName}</span>
              <span className="truncate text-[11px] text-slate-500 font-medium mt-0.5">
                {displayEmail}
              </span>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200/60 text-[10px] font-bold text-teal-800 tracking-tight">
                  <ShieldCheck size={11} className="text-teal-600" />
                  {roleName}
                </span>
                <span className="text-[10px] text-slate-400 font-medium ml-auto">
                  v0.0.3
                </span>
              </div>
            </div>
          </div>

          <DropdownMenuSeparator className="my-1.5 bg-slate-100" />

          <DropdownMenuItem
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition"
          >
            <LogOutIcon size={14} />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}