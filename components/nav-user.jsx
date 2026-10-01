"use client"

import React, { useState, useEffect } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"

export function NavUser({ user }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Safe defaults
  const name = user?.name || "Admin User"
  const email = user?.email || "admin@cruisesaga.com"

  // Dynamic initials
  const getInitials = (userName) => {
    if (!userName || userName === "Guest") return "AU"
    const parts = userName.trim().split(" ")
    return parts.length === 1
      ? parts[0].slice(0, 2).toUpperCase()
      : (parts[0][0] + parts[1][0]).toUpperCase()
  }

  const handleLogout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    router.push("/login")
  }

  const triggerContent = (
    <>
      <div className="flex flex-col text-right leading-tight max-w-[170px]">
        <span className="truncate text-xs font-bold text-slate-800">{name}</span>
        <span className="truncate text-[11px] text-slate-500 font-medium">
          {email}
        </span>
      </div>

      <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-md bg-teal-700 text-white font-bold text-xs shadow-xs">
        {getInitials(name)}
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
    <div className="relative">
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-700 text-white font-bold text-xs shadow-xs">
              {getInitials(name)}
            </div>

            <div className="grid flex-1 text-left text-xs leading-tight">
              <span className="truncate font-bold text-slate-900">{name}</span>
              <span className="truncate text-[11px] text-slate-500 font-medium mt-0.5">
                {email}
              </span>
              <span className="truncate text-[10px] text-teal-700 font-bold mt-1">
                Version : 0.0.3
              </span>
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