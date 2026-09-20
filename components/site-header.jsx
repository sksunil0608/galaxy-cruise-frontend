"use client"

import React from "react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"
import { usePathname } from "next/navigation"

export function SiteHeader({ title }) {
  const pathname = usePathname()

  const [user, setUser] = React.useState(null)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)

    try {
      const storedUser = localStorage.getItem("user")
      if (storedUser) {
        const parsed = JSON.parse(storedUser)
        setUser(parsed)
      }
    } catch (error) {
      console.error("Invalid user data in localStorage")
      setUser(null)
    }
  }, [])

  // Prevent hydration mismatch
  if (!mounted) return null

  const sidebarUser = {
    name: user?.name ?? "Guest",
    email: user?.email ?? "",
    avatar: user?.avatar ?? "/avatars/default.jpg",
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center justify-between gap-2 border-b px-4 lg:px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4" />
        <img
          src="https://cruisesaga.com/cruisesaga.png"
          alt="Cruise Saga"
          className="h-7 w-auto"
        />
        <h1 className="text-base font-medium">{title}</h1>
      </div>

      <div className="max-w-lg">
        <NavUser user={sidebarUser} />
      </div>
      
    </header>
  )
}