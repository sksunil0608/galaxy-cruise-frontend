"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LogoutPage() {

  const router = useRouter()

  useEffect(() => {

    // remove local storage
    localStorage.removeItem("token")
    localStorage.removeItem("permissions")
    localStorage.removeItem("user")

    // remove cookie
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;"

    router.replace("/login")

  }, [])

  return (
    <div className="flex items-center justify-center h-screen">
      Logging out...
    </div>
  )
}