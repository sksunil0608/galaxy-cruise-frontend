"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Permissions are now managed inside User Management (open a role to view/add
// its permissions) — this route redirects so old links keep working.
export default function PermissionRedirect(){
  const router = useRouter()
  useEffect(()=>{ router.replace("/dashboard/users") },[router])
  return null
}
