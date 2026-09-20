"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Roles are now managed inside User Management (click a user's role, or the
// Roles card on that page) — this route redirects so old links keep working.
export default function RolesRedirect(){
  const router = useRouter()
  useEffect(()=>{ router.replace("/dashboard/users") },[router])
  return null
}
