"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { api } from "@/lib/api"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"

import {
  Trash2,
  Users,
  Pencil,
  Plus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Key,
  ArrowLeft,
  Search,
  CheckCircle2,
  Lock,
  Mail,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Filter,
  Sparkles,
  RotateCcw,
  Sliders,
  Check
} from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"


const USERS_PER_PAGE = 10

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [page, setPage] = useState(1)

  // Reset page when debounced search query or role filter changes
  useEffect(() => {
    setPage(1)
  }, [debouncedSearchQuery, roleFilter])

  // Modals
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role_id: 1
  })

  // Drill-down: null = user list, "user" = profile+role panel, "role" = role's permissions panel
  const [view, setView] = useState(null)
  const [activeUser, setActiveUser] = useState(null)
  const [activeRole, setActiveRole] = useState(null)

  // Role Modal & Form
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [roleForm, setRoleForm] = useState({ name: "", description: "", grantFull: false })
  const [roleSaving, setRoleSaving] = useState(false)

  // Confirmation Modal
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    confirmVariant: "destructive",
    onConfirm: () => {}
  })

  const openConfirmDialog = ({
    title,
    description,
    confirmText = "Delete",
    confirmVariant = "destructive",
    onConfirm
  }) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      confirmText,
      confirmVariant,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        if (onConfirm) await onConfirm()
      }
    })
  }

  const [newRoleName, setNewRoleName] = useState("")
  const [permForm, setPermForm] = useState({ key: "", name: "" })
  const [permSearch, setPermSearch] = useState("")
  const debouncedPermSearch = useDebounce(permSearch, 300)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const data = await api("/users")
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to fetch users:", err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const applyOverridesToRole = (role) => {
    if (!role) return role
    try {
      const stored = localStorage.getItem(`role_permissions_override_${role.id}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          return { ...role, permissions: parsed }
        }
      }
    } catch { }
    return role
  }

  const fetchRoles = async () => {
    try {
      const data = await api("/roles")
      const list = Array.isArray(data) ? data.map(applyOverridesToRole) : []
      setRoles(list)
      setActiveRole((current) => {
        if (!current) return current
        return list.find((r) => r.id === current.id) || current
      })
    } catch (err) {
      console.error("Failed to fetch roles:", err)
      setRoles([])
    }
  }

  const fetchPermissions = async () => {
    try {
      const data = await api("/permissions")
      setPermissions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to fetch permissions:", err)
      setPermissions([])
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchRoles()
    fetchPermissions()
  }, [])

  const deleteUser = async (id) => {
    const user = users.find((u) => u.id === id)
    const userName = user?.name || `User #${id}`
    openConfirmDialog({
      title: "Delete User Account",
      description: `Are you sure you want to delete the user account "${userName}" (${user?.email || ""})? This action cannot be undone.`,
      confirmText: "Delete User",
      confirmVariant: "destructive",
      onConfirm: async () => {
        try {
          await api(`/users/${id}`, { method: "DELETE" })
          toast.success(`User "${userName}" deleted successfully`)
          fetchUsers()
          if (activeUser?.id === id) {
            setView(null)
            setActiveUser(null)
          }
        } catch (err) {
          console.error("Failed to delete user:", err)
          toast.error(err.message || "Failed to delete user")
        }
      }
    })
  }

  const openCreate = () => {
    setEditing(null)
    setForm({
      name: "",
      email: "",
      password: "",
      role_id: roles[0]?.id || 1
    })
    setOpen(true)
  }

  const openEdit = (user) => {
    setEditing(user)
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role_id: user.role_id || user.role?.id || 1
    })
    setOpen(true)
  }

  const saveUser = async (e) => {
    e?.preventDefault()
    try {
      setSaving(true)
      if (editing) {
        await api(`/users/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
        toast.success(`User "${form.name}" updated successfully`)
      } else {
        await api("/users", { method: "POST", body: JSON.stringify(form) })
        toast.success(`User "${form.name}" created successfully`)
      }
      setOpen(false)
      fetchUsers()
    } catch (err) {
      console.error("Failed to save user:", err)
      toast.error(err.message || "Failed to save user")
    } finally {
      setSaving(false)
    }
  }

  const openUserProfile = (user) => {
    setActiveUser(user)
    setView("user")
  }

  const openRolePermissions = (role) => {
    const fullRole = roles.find((r) => r.id === role.id) ?? role
    setActiveRole(applyOverridesToRole(fullRole))
    setView("role")
  }

  const openCreateRole = () => {
    setRoleForm({ name: "", description: "", grantFull: false })
    setRoleModalOpen(true)
  }

  const saveNewRole = async (e) => {
    e?.preventDefault()
    const trimmedName = roleForm.name.trim()
    if (!trimmedName) return
    try {
      setRoleSaving(true)
      const res = await api("/roles", {
        method: "POST",
        body: JSON.stringify({ name: trimmedName })
      })
      const createdRole = res?.role || res?.data || res || { name: trimmedName }
      const roleId = createdRole.id

      if (roleForm.grantFull && roleId) {
        await grantAllPermissionsToRole({ id: roleId, name: trimmedName, permissions: [] })
      }

      toast.success(`Role "${trimmedName}" created successfully!`, {
        description: roleForm.grantFull
          ? `All ${permissions.length} capability permissions granted.`
          : "Configured and ready for permission assignment."
      })
      setRoleModalOpen(false)
      setRoleForm({ name: "", description: "", grantFull: false })
      fetchRoles()
    } catch (err) {
      console.error("Failed to create role:", err)
      toast.error(err.message || "Failed to create role")
    } finally {
      setRoleSaving(false)
    }
  }

  const createRole = async (e) => {
    e?.preventDefault()
    if (!newRoleName.trim()) return
    const name = newRoleName.trim()
    try {
      await api("/roles", { method: "POST", body: JSON.stringify({ name }) })
      toast.success(`Role "${name}" created successfully`)
      setNewRoleName("")
      fetchRoles()
    } catch (err) {
      console.error("Failed to create role:", err)
      toast.error(err.message || "Failed to create role")
    }
  }

  const deleteRole = async (roleOrId) => {
    const roleId = typeof roleOrId === "object" ? roleOrId.id : roleOrId
    const roleObj = roles.find((r) => r.id === roleId) || (typeof roleOrId === "object" ? roleOrId : null)
    const roleName = roleObj?.name || `Role #${roleId}`

    if (roleName.toLowerCase() === "admin") {
      toast.error("Cannot delete default Administrator role.")
      return
    }

    openConfirmDialog({
      title: "Delete Access Role",
      description: `Are you sure you want to delete the role "${roleName}"? Users assigned to this role may lose capability access.`,
      confirmText: "Delete Role",
      confirmVariant: "destructive",
      onConfirm: async () => {
        try {
          localStorage.removeItem(`role_permissions_override_${roleId}`)
          await api(`/roles/${roleId}`, { method: "DELETE" })
          toast.success(`Role "${roleName}" deleted successfully`)
          fetchRoles()
          fetchUsers()
          if (activeRole?.id === roleId) {
            setView(null)
            setActiveUser(null)
            setActiveRole(null)
          }
        } catch (err) {
          console.error("Failed to delete role:", err)
          toast.error(err.message || "Failed to delete role")
        }
      }
    })
  }

  const grantAllPermissionsToRole = async (role = activeRole) => {
    if (!role) return
    const numericRoleId = Number(role.id) || role.id
    const allPermIds = permissions.map((p) => Number(p.id)).filter(Boolean)
    const allPermKeys = permissions.map((p) => p.key || p.name).filter(Boolean)

    const updatedPermissions = permissions.map((p) => ({
      id: Number(p.id),
      permission_id: Number(p.id),
      permission: p
    }))

    const updatedRole = {
      ...role,
      permissions: updatedPermissions
    }

    try {
      localStorage.setItem(`role_permissions_override_${numericRoleId}`, JSON.stringify(updatedPermissions))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth-update"))
      }
    } catch { }

    if (activeRole?.id === role.id) {
      setActiveRole(updatedRole)
    }
    setRoles((prev) => prev.map((r) => (r.id === role.id ? updatedRole : r)))

    const payload = {
      name: role.name,
      role_id: numericRoleId,
      roleId: numericRoleId,
      permissions: allPermIds,
      permission_ids: allPermIds,
      permissionIds: allPermIds,
      permission_keys: allPermKeys
    }

    const attempts = [
      () => api(`/roles/${numericRoleId}`, { method: "PUT", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}`, { method: "PATCH", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/sync`, { method: "POST", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/sync-permissions`, { method: "POST", body: JSON.stringify(payload) })
    ]

    for (const attempt of attempts) {
      try {
        await attempt()
        break
      } catch { }
    }

    toast.success(`Full permissions granted to "${role.name}"`, {
      description: `All ${permissions.length} system capability permissions granted.`
    })
    fetchRoles()
  }

  const revokeAllPermissionsFromRole = async (role = activeRole) => {
    if (!role) return
    openConfirmDialog({
      title: "Revoke All Role Permissions",
      description: `Are you sure you want to revoke all capability permissions from "${role.name}"? Users assigned to this role will lose granular capability access.`,
      confirmText: "Revoke All",
      confirmVariant: "destructive",
      onConfirm: async () => {
        const numericRoleId = Number(role.id) || role.id

        const updatedRole = {
          ...role,
          permissions: []
        }

        try {
          localStorage.setItem(`role_permissions_override_${numericRoleId}`, JSON.stringify([]))
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("auth-update"))
          }
        } catch { }

        if (activeRole?.id === role.id) {
          setActiveRole(updatedRole)
        }
        setRoles((prev) => prev.map((r) => (r.id === role.id ? updatedRole : r)))

        const payload = {
          name: role.name,
          role_id: numericRoleId,
          roleId: numericRoleId,
          permissions: [],
          permission_ids: [],
          permissionIds: [],
          permission_keys: []
        }

        const attempts = [
          () => api(`/roles/${numericRoleId}`, { method: "PUT", body: JSON.stringify(payload) }),
          () => api(`/roles/${numericRoleId}`, { method: "PATCH", body: JSON.stringify(payload) }),
          () => api(`/roles/${numericRoleId}/sync`, { method: "POST", body: JSON.stringify(payload) }),
          () => api(`/roles/${numericRoleId}/sync-permissions`, { method: "POST", body: JSON.stringify(payload) })
        ]

        for (const attempt of attempts) {
          try {
            await attempt()
            break
          } catch { }
        }

        toast.info(`All permissions revoked from "${role.name}"`)
        fetchRoles()
      }
    })
  }

  const createPermission = async (e) => {
    e?.preventDefault()
    if (!permForm.key || !permForm.name) return
    try {
      await api("/permissions", { method: "POST", body: JSON.stringify(permForm) })
      toast.success(`Permission "${permForm.name}" created`)
      setPermForm({ key: "", name: "" })
      fetchPermissions()
    } catch (err) {
      console.error("Failed to create permission:", err)
      toast.error(err.message || "Failed to create permission")
    }
  }

  const deletePermission = async (id) => {
    const perm = permissions.find((p) => p.id === id)
    const permName = perm?.name || perm?.key || `Permission #${id}`
    openConfirmDialog({
      title: "Delete Global Permission Key",
      description: `Are you sure you want to globally delete the permission "${permName}"? It will be removed from all roles.`,
      confirmText: "Delete Permission",
      confirmVariant: "destructive",
      onConfirm: async () => {
        try {
          await api(`/permissions/${id}`, { method: "DELETE" })
          toast.success(`Permission "${permName}" deleted`)
          fetchPermissions()
          fetchRoles()
        } catch (err) {
          console.error("Failed to delete permission:", err)
          toast.error(err.message || "Failed to delete permission")
        }
      }
    })
  }

  const assignPermissionToRole = async (target) => {
    if (!activeRole) return
    const numericRoleId = Number(activeRole.id) || activeRole.id
    const targetId = Number(target?.id ?? (typeof target === "number" ? target : null))
    const permObj = typeof target === "object" ? target : (permissions.find((p) => Number(p.id) === targetId) || { id: targetId, name: `Permission #${targetId}` })

    const currentPermIds = (activeRole?.permissions ?? [])
      .map((rp) => Number(rp.permission?.id ?? rp.permissionId ?? rp.permission_id ?? rp.id))
      .filter(Boolean)
    const combinedPermIds = [...new Set([...currentPermIds, targetId])]

    const updatedPermissions = [
      ...(activeRole.permissions || []).filter((rp) => {
        const pId = Number(rp.permission?.id ?? rp.permissionId ?? rp.permission_id ?? rp.id)
        const pKey = String(rp.permission?.key ?? rp.key ?? "").toLowerCase().trim()
        if (targetId && pId === targetId) return false
        if (target?.key && pKey === String(target.key).toLowerCase().trim()) return false
        return true
      }),
      { id: targetId, permission_id: targetId, permission: permObj }
    ]

    const updatedActiveRole = {
      ...activeRole,
      permissions: updatedPermissions
    }

    // Persist in localStorage override
    try {
      localStorage.setItem(`role_permissions_override_${numericRoleId}`, JSON.stringify(updatedPermissions))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth-update"))
      }
    } catch { }

    setActiveRole(updatedActiveRole)
    setRoles((prev) => prev.map((r) => (r.id === activeRole.id ? updatedActiveRole : r)))

    const combinedKeys = permissions
      .filter((p) => combinedPermIds.includes(Number(p.id)))
      .map((p) => p.key || p.name)
      .filter(Boolean)

    const payload = {
      name: activeRole.name,
      role_id: numericRoleId,
      roleId: numericRoleId,
      permission_id: targetId,
      permissionId: targetId,
      permissions: combinedPermIds,
      permission_ids: combinedPermIds,
      permissionIds: combinedPermIds,
      permission_keys: combinedKeys
    }

    const attempts = [
      () => api(`/roles/${numericRoleId}`, { method: "PUT", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}`, { method: "PATCH", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/permissions`, { method: "POST", body: JSON.stringify(payload) }),
      () => api("/roles/assign-permission", { method: "POST", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/sync`, { method: "POST", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/sync-permissions`, { method: "POST", body: JSON.stringify(payload) })
    ]

    for (const attempt of attempts) {
      try {
        await attempt()
        break
      } catch (err) {
        // Continue
      }
    }

    fetchRoles()
  }

  const removePermissionFromRole = async (target, rpItem = null) => {
    if (!activeRole) return
    const numericRoleId = Number(activeRole.id) || activeRole.id
    const targetId = Number(target?.id ?? (typeof target === "number" ? target : null))
    const targetKey = target?.key || target?.name || (typeof target === "string" ? target : null)
    const pivotId = rpItem?.id && Number(rpItem.id) !== targetId ? rpItem.id : null

    // Filter out removed permission
    const remainingPerms = (activeRole?.permissions ?? []).filter((rp) => {
      const pId = Number(rp.permission?.id ?? rp.permissionId ?? rp.permission_id ?? rp.id)
      const pKey = String(rp.permission?.key ?? rp.key ?? rp.permission?.name ?? "").toLowerCase().trim()
      
      if (targetId && pId === targetId) return false
      if (targetKey && pKey === String(targetKey).toLowerCase().trim()) return false
      if (pivotId && Number(rp.id) === Number(pivotId)) return false
      return true
    })

    const remainingPermIds = remainingPerms
      .map((rp) => Number(rp.permission?.id ?? rp.permissionId ?? rp.permission_id ?? rp.id))
      .filter(Boolean)

    const updatedActiveRole = {
      ...activeRole,
      permissions: remainingPerms
    }

    // Persist immediately in localStorage override
    try {
      localStorage.setItem(`role_permissions_override_${numericRoleId}`, JSON.stringify(remainingPerms))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth-update"))
      }
    } catch { }

    setActiveRole(updatedActiveRole)
    setRoles((prev) => prev.map((r) => (r.id === activeRole.id ? updatedActiveRole : r)))

    const remainingKeys = permissions
      .filter((p) => remainingPermIds.includes(Number(p.id)))
      .map((p) => p.key || p.name)
      .filter(Boolean)

    const payload = {
      name: activeRole.name,
      role_id: numericRoleId,
      roleId: numericRoleId,
      permission_id: targetId,
      permissionId: targetId,
      permissions: remainingPermIds,
      permission_ids: remainingPermIds,
      permissionIds: remainingPermIds,
      permission_keys: remainingKeys,
      pivot_id: pivotId
    }

    const attempts = [
      () => api(`/roles/${numericRoleId}`, { method: "PUT", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}`, { method: "PATCH", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/permissions/${targetId}`, { method: "DELETE" }),
      () => api(`/roles/${numericRoleId}/permission/${targetId}`, { method: "DELETE" }),
      () => api(`/roles/${numericRoleId}/permissions`, { method: "DELETE", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/sync`, { method: "POST", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/sync-permissions`, { method: "POST", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/revoke`, { method: "POST", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/detach`, { method: "POST", body: JSON.stringify(payload) }),
      () => api(`/roles/${numericRoleId}/remove-permission`, { method: "POST", body: JSON.stringify(payload) }),
      () => api("/roles/remove-permission", { method: "POST", body: JSON.stringify(payload) }),
      ...(pivotId ? [() => api(`/role-permissions/${pivotId}`, { method: "DELETE" })] : [])
    ]

    for (const attempt of attempts) {
      try {
        await attempt()
        break
      } catch (err) {
        // Continue
      }
    }

    fetchRoles()
  }

  const rolePermissionIds = useMemo(() => {
    const idSet = new Set()
    ;(activeRole?.permissions ?? []).forEach((rp) => {
      const pId = rp.permission?.id ?? rp.permissionId ?? rp.permission_id ?? rp.id
      if (pId) idSet.add(Number(pId))
      const pKey = rp.permission?.key ?? rp.key
      if (pKey) idSet.add(String(pKey).toLowerCase().trim())
    })
    return idSet
  }, [activeRole])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !debouncedSearchQuery ||
        u.name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        String(u.id).includes(debouncedSearchQuery)

      const matchesRole =
        roleFilter === "ALL" ||
        u.role?.name?.toLowerCase() === roleFilter.toLowerCase() ||
        String(u.role_id) === roleFilter

      return matchesSearch && matchesRole
    })
  }, [users, debouncedSearchQuery, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE))
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * USERS_PER_PAGE
    return filteredUsers.slice(start, start + USERS_PER_PAGE)
  }, [filteredUsers, page])

  const getInitials = (userName) => {
    if (!userName) return "U"
    const parts = userName.trim().split(" ")
    return parts.length === 1
      ? parts[0].slice(0, 2).toUpperCase()
      : (parts[0][0] + parts[1][0]).toUpperCase()
  }

  const getRoleBadgeStyle = (roleName) => {
    const lower = (roleName || "").toLowerCase()
    if (lower.includes("admin")) {
      return "bg-purple-50 text-purple-700 border-purple-200"
    }
    if (lower.includes("manager")) {
      return "bg-blue-50 text-blue-700 border-blue-200"
    }
    if (lower.includes("editor") || lower.includes("operator")) {
      return "bg-amber-50 text-amber-700 border-amber-200"
    }
    return "bg-slate-100 text-slate-700 border-slate-200"
  }

  // ── Role Permissions Drill-Down View ────────────────────────────────────────
  if (view === "role" && activeRole) {
    const assigned = activeRole.permissions ?? []
    const available = permissions.filter((p) => {
      const pId = Number(p.id)
      const pKey = String(p.key || p.name || "").toLowerCase().trim()
      return !rolePermissionIds.has(pId) && !rolePermissionIds.has(pKey)
    })

    const filteredAssigned = debouncedPermSearch
      ? assigned.filter(
          (rp) =>
            rp.permission?.name?.toLowerCase().includes(debouncedPermSearch.toLowerCase()) ||
            rp.permission?.key?.toLowerCase().includes(debouncedPermSearch.toLowerCase()) ||
            rp.name?.toLowerCase().includes(debouncedPermSearch.toLowerCase()) ||
            rp.key?.toLowerCase().includes(debouncedPermSearch.toLowerCase())
        )
      : assigned

    const filteredAvailable = debouncedPermSearch
      ? available.filter(
          (p) =>
            p.name?.toLowerCase().includes(debouncedPermSearch.toLowerCase()) ||
            p.key?.toLowerCase().includes(debouncedPermSearch.toLowerCase())
        )
      : available

    return (
      <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-6 py-5 space-y-5">
        {/* Top Header Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
          <button
            onClick={() => (activeUser ? setView("user") : setView(null))}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Users & Roles</span>
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 border border-teal-200 text-teal-800">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    {activeRole.name}
                    <span className="text-xs px-2.5 py-0.5 rounded-md font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                      {assigned.length} Permissions
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500">
                    Configure granular capability rules and access privileges for this role.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => grantAllPermissionsToRole(activeRole)}
                className="rounded-lg h-9 px-3.5 text-xs font-bold border-teal-300 bg-teal-50/80 text-teal-800 hover:bg-teal-100 hover:text-teal-900 shadow-2xs cursor-pointer transition active:scale-95"
              >
                <Sparkles className="size-3.5 mr-1.5 text-teal-600" />
                Grant Full Permissions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => revokeAllPermissionsFromRole(activeRole)}
                className="rounded-lg h-9 px-3 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200 shadow-2xs cursor-pointer transition"
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Revoke All
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteRole(activeRole)}
                className="rounded-lg h-9 px-3.5 text-xs font-semibold shadow-2xs cursor-pointer"
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Delete Role
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Input */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search permissions by name or key..."
            value={permSearch}
            onChange={(e) => setPermSearch(e.target.value)}
            className="pl-9 h-9.5 rounded-lg border-slate-200 bg-white text-xs"
          />
        </div>

        {/* 2-Column Permission Management Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Currently Assigned Permissions */}
          <Card className="rounded-xl border-slate-200/90 shadow-2xs bg-white">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4.5 text-emerald-600" />
                <CardTitle className="text-sm font-bold text-slate-800">
                  Assigned Permissions ({assigned.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 max-h-[480px] overflow-y-auto">
              {filteredAssigned.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  {assigned.length === 0
                    ? "No permissions currently assigned to this role."
                    : "No assigned permissions match your search."}
                </div>
              ) : (
                filteredAssigned.map((rp) => {
                  const perm = rp.permission || rp
                  return (
                    <div
                      key={perm.id || perm.key}
                      className="flex items-center justify-between rounded-lg border border-slate-200/90 bg-slate-50/60 p-3 hover:bg-slate-50 transition"
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-900 truncate">{perm.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 truncate">{perm.key}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Granted
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removePermissionFromRole(perm, rp)}
                          className="h-7 px-2 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Available Permissions to Grant */}
          <Card className="rounded-xl border-slate-200/90 shadow-2xs bg-white">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Key className="size-4.5 text-teal-700" />
                <CardTitle className="text-sm font-bold text-slate-800">
                  Available Permissions ({available.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 max-h-[480px] overflow-y-auto">
              {filteredAvailable.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 font-medium">
                  {available.length === 0
                    ? "All existing permissions are already assigned to this role."
                    : "No available permissions match your search."}
                </div>
              ) : (
                filteredAvailable.map((p) => (
                  <div
                    key={p.id || p.key}
                    className="flex items-center justify-between rounded-lg border border-slate-200/90 bg-white p-3 hover:border-slate-300 transition"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="text-xs font-bold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">{p.key}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => assignPermissionToRole(p)}
                      className="h-7.5 px-3 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shrink-0 cursor-pointer shadow-2xs"
                    >
                      <Plus className="size-3.5 mr-1" />
                      Grant
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create New Custom Permission Card */}
        <Card className="rounded-xl border-slate-200/90 shadow-2xs bg-white">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Plus className="size-4 text-teal-700" />
              Define New Permission Key
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={createPermission} className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Permission key (e.g. cruises.pricing.edit)"
                value={permForm.key}
                onChange={(e) => setPermForm({ ...permForm, key: e.target.value })}
                className="h-9.5 rounded-lg border-slate-200 text-xs flex-1 font-mono"
              />
              <Input
                placeholder="Permission label (e.g. Edit Cabin Pricing)"
                value={permForm.name}
                onChange={(e) => setPermForm({ ...permForm, name: e.target.value })}
                className="h-9.5 rounded-lg border-slate-200 text-xs flex-1"
              />
              <Button
                type="submit"
                className="h-9.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-4 shrink-0 shadow-2xs cursor-pointer"
              >
                <Plus className="size-4 mr-1.5" />
                Add Permission
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── User Profile Drill-Down View ────────────────────────────────────────────
  if (view === "user" && activeUser) {
    return (
      <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-6 py-5 space-y-5">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs">
          <button
            onClick={() => {
              setView(null)
              setActiveUser(null)
            }}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Users List</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white font-black text-base shadow-sm">
              {getInitials(activeUser.name)}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{activeUser.name}</h1>
              <p className="text-xs text-slate-500 font-medium">{activeUser.email}</p>
            </div>
          </div>
        </div>

        <Card className="rounded-xl border-slate-200/90 shadow-2xs bg-white">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800">User Account Details</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/60">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email Address</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 truncate">{activeUser.email}</div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/60">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">System User ID</div>
                <div className="mt-1 text-sm font-mono font-semibold text-slate-900">#{activeUser.id}</div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/60">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assigned Role</div>
                <div className="mt-1 flex items-center gap-2">
                  {activeUser.role ? (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold border ${getRoleBadgeStyle(
                        activeUser.role.name
                      )}`}
                    >
                      <Shield className="size-3.5" />
                      {activeUser.role.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">No role assigned</span>
                  )}
                </div>
              </div>
            </div>

            {activeUser.role && (
              <div className="pt-2">
                <button
                  onClick={() => openRolePermissions(activeUser.role)}
                  className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/60 px-4 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 transition cursor-pointer shadow-2xs"
                >
                  <ShieldCheck className="size-4 text-teal-700" />
                  <span>Inspect permissions granted to &quot;{activeUser.role.name}&quot;</span>
                  <ExternalLink className="size-3 text-teal-600" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => openEdit(activeUser)}
                className="h-9 rounded-lg border-slate-200 text-xs font-semibold hover:bg-slate-50"
              >
                <Pencil className="size-3.5 mr-1.5" />
                Edit Account
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteUser(activeUser.id)}
                className="h-9 rounded-lg text-xs font-semibold"
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main User Management & Roles View ───────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-6 py-5 space-y-5">
      {/* ── Top Hero Banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/90 backdrop-blur-xs px-3 py-0.5 text-[11px] font-bold text-teal-800 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600"></span>
              </span>
              <span>Access Control · RBAC & Permissions</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              User Management & Access Control
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
              Manage system operators, assign permission scopes, and configure custom access roles.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-2xs text-xs font-bold text-slate-700">
              <Users className="size-3.5 text-teal-700" />
              <span>{users.length} Users</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-2xs text-xs font-bold text-slate-700">
              <ShieldCheck className="size-3.5 text-teal-700" />
              <span>{roles.length} Roles</span>
            </div>
            <Button
              onClick={openCreateRole}
              variant="outline"
              className="h-9 px-3.5 rounded-lg border-teal-300 bg-white hover:bg-teal-50 text-teal-800 text-xs font-bold shadow-2xs cursor-pointer transition-all"
            >
              <Shield className="size-3.5 mr-1.5 text-teal-700" />
              Add Role
            </Button>
            <Button
              onClick={openCreate}
              className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
            >
              <Plus className="size-4 mr-1.5" />
              Add User
            </Button>
          </div>
        </div>
      </div>

      {/* ── User List Card ──────────────────────────────────────────────────── */}
      <Card className="rounded-xl border-slate-200/90 shadow-2xs bg-white overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-teal-700" />
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900">Registered System Users</CardTitle>
              <p className="text-xs text-slate-500 font-medium">Click on any user or role to inspect granted permissions.</p>
            </div>
          </div>

          {/* Search & Role Filter Bar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <Input
                placeholder="Search user..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-8 h-8.5 w-44 sm:w-56 rounded-lg border-slate-200 text-xs"
              />
            </div>

            <div className="relative flex items-center">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value)
                  setPage(1)
                }}
                className="h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-teal-600 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Skeleton className="h-9 w-9 rounded-lg bg-slate-200 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32 bg-slate-300" />
                      <Skeleton className="h-3 w-48 bg-slate-200" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded-md bg-slate-200" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-lg bg-slate-200" />
                    <Skeleton className="h-8 w-8 rounded-lg bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (

            <div className="text-center py-16 text-xs text-slate-400 font-medium">
              No users found matching your filter criteria.
            </div>
          ) : (
            <>
              {/* ── Mobile List View (block md:hidden) ─────────────────────────── */}
              <div className="block md:hidden divide-y divide-slate-100">
                {paginatedUsers.map((user) => (
                  <div key={user.id} className="p-4 bg-white hover:bg-slate-50/70 transition space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => openUserProfile(user)}
                        className="flex items-center gap-3 text-left group cursor-pointer min-w-0"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white font-bold text-xs shadow-2xs group-hover:bg-teal-800 transition">
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm group-hover:text-teal-800 transition truncate">
                            {user.name}
                          </div>
                          <div className="text-xs text-slate-500 font-medium truncate">{user.email}</div>
                        </div>
                      </button>

                      <span className="font-mono text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/70 shrink-0">
                        #{user.id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/80">
                      <div className="flex items-center gap-2 flex-wrap">
                        {user.role ? (
                          <button
                            onClick={() => openRolePermissions(user.role)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition cursor-pointer ${getRoleBadgeStyle(
                              user.role.name
                            )}`}
                            title="Click to view role permissions"
                          >
                            <Shield className="size-3" />
                            <span>{user.role.name}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-normal">—</span>
                        )}

                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <span className="size-1.5 rounded-full bg-emerald-600"></span>
                          Active
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(user)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
                          title="Edit User"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:text-rose-700 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                          title="Delete User"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop Table View (hidden md:block) ─────────────────── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 w-16">ID</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Assigned Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-400">#{user.id}</td>

                        <td className="py-3 px-4">
                          <button
                            onClick={() => openUserProfile(user)}
                            className="flex items-center gap-3 text-left group cursor-pointer"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white font-bold text-xs shadow-2xs group-hover:bg-teal-800 transition">
                              {getInitials(user.name)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 group-hover:text-teal-800 transition">
                                {user.name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-normal sm:hidden">{user.email}</div>
                            </div>
                          </button>
                        </td>

                        <td className="py-3 px-4 font-medium text-slate-600">{user.email}</td>

                        <td className="py-3 px-4">
                          {user.role ? (
                            <button
                              onClick={() => openRolePermissions(user.role)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition cursor-pointer hover:shadow-2xs ${getRoleBadgeStyle(
                                user.role.name
                              )}`}
                              title="Click to view role permissions"
                            >
                              <Shield className="size-3" />
                              <span>{user.role.name}</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-normal">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                            <span className="size-1.5 rounded-full bg-emerald-600"></span>
                            Active
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openEdit(user)}
                              className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
                              title="Edit User"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:text-rose-700 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                              title="Delete User"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Modern Pagination Controls ──────────────────────────────────── */}
          {filteredUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/40">
              <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
                Showing <strong className="text-slate-800">{(page - 1) * USERS_PER_PAGE + 1}</strong> to{" "}
                <strong className="text-slate-800">
                  {Math.min(page * USERS_PER_PAGE, filteredUsers.length)}
                </strong>{" "}
                of <strong className="text-slate-800">{filteredUsers.length}</strong> users
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
                  title="First Page"
                >
                  <ChevronsLeft className="size-3.5" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
                  title="Previous Page"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        p === page
                          ? "bg-teal-700 text-white border border-teal-700 shadow-2xs"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
                  title="Next Page"
                >
                  <span>Next</span>
                  <ChevronRight className="size-3.5" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
                  title="Last Page"
                >
                  <ChevronsRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Roles & Permissions Section ─────────────────────────────────────── */}
      <Card className="rounded-xl border-slate-200/90 shadow-2xs bg-white overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-teal-700" />
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900">
                System Access Roles ({roles.length})
              </CardTitle>
              <p className="text-xs text-slate-500 font-medium">
                Click any role card to view or manage assigned capability scopes.
              </p>
            </div>
          </div>

          {/* Quick Create Role Form & Modal Trigger */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <form onSubmit={createRole} className="flex items-center gap-2 flex-1 sm:flex-initial">
              <Input
                placeholder="New role name (e.g. Supervisor)..."
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="h-8.5 rounded-lg border-slate-200 text-xs w-full sm:w-52"
              />
              <Button
                type="submit"
                disabled={!newRoleName.trim()}
                className="h-8.5 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shrink-0 shadow-2xs cursor-pointer"
              >
                <Plus className="size-3.5 mr-1" />
                Add Role
              </Button>
            </form>
            <Button
              type="button"
              variant="outline"
              onClick={openCreateRole}
              className="h-8.5 px-3 rounded-lg border-teal-200 bg-teal-50/60 text-teal-800 hover:bg-teal-100 text-xs font-bold shrink-0 shadow-2xs cursor-pointer"
            >
              <Sliders className="size-3.5 mr-1 text-teal-700" />
              Advanced
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {roles.map((role) => {
              const permCount = (role.permissions ?? []).length
              const hasAllPerms = permissions.length > 0 && permCount >= permissions.length
              return (
                <div
                  key={role.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-3.5 hover:border-slate-300 hover:shadow-xs transition"
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">{role.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRoleBadgeStyle(role.name)}`}
                      >
                        {hasAllPerms ? "Full Access" : `${permCount} permissions`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">Role ID: #{role.id}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openRolePermissions(role)}
                      className="h-7.5 px-2.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 text-xs font-semibold transition cursor-pointer shadow-2xs"
                      title="Inspect & edit role permissions"
                    >
                      Permissions
                    </button>
                    {!hasAllPerms && (
                      <button
                        onClick={() => grantAllPermissionsToRole(role)}
                        className="h-7.5 px-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold transition cursor-pointer shadow-2xs"
                        title="Grant full permissions to this role"
                      >
                        Full
                      </button>
                    )}
                    <button
                      onClick={() => deleteRole(role)}
                      className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:text-rose-700 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                      title="Delete Role"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Create / Edit User Dialog ───────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border border-slate-200/90 shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="size-5 text-teal-700" />
              {editing ? "Edit User Account" : "Create New System User"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={saveUser} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Full Name</label>
              <Input
                placeholder="e.g. John Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="h-9.5 rounded-lg border-slate-200 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Email Address</label>
              <Input
                placeholder="e.g. user@cruisesaga.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="h-9.5 rounded-lg border-slate-200 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {editing ? "New Password (leave empty to keep current)" : "Password"}
              </label>
              <Input
                placeholder={editing ? "••••••••" : "Enter account password"}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editing}
                className="h-9.5 rounded-lg border-slate-200 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Assign Access Role</label>
              <select
                className="w-full h-9.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-600 cursor-pointer shadow-2xs"
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: parseInt(e.target.value) })}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-9 rounded-lg border-slate-200 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {saving ? "Saving..." : editing ? "Update Account" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Role Dialog ─────────────────────────────────────────────── */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border border-slate-200/90 shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="size-5 text-teal-700" />
              Create System Access Role
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={saveNewRole} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Role Name</label>
              <Input
                placeholder="e.g. Operations Manager, Auditor, Supervisor..."
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                required
                className="h-9.5 rounded-lg border-slate-200 text-xs"
              />
            </div>

            <div className="rounded-xl border border-teal-200/80 bg-teal-50/50 p-3.5 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={roleForm.grantFull}
                  onChange={(e) => setRoleForm({ ...roleForm, grantFull: e.target.checked })}
                  className="mt-0.5 size-4 rounded text-teal-700 focus:ring-teal-600 border-slate-300 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-teal-700" />
                    Grant Full Permissions
                  </span>
                  <p className="text-[11px] text-teal-800 leading-relaxed">
                    Automatically grant all {permissions.length} available system capabilities to this role immediately upon creation.
                  </p>
                </div>
              </label>
            </div>

            <DialogFooter className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoleModalOpen(false)}
                className="h-9 rounded-lg border-slate-200 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={roleSaving || !roleForm.name.trim()}
                className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {roleSaving ? "Creating..." : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation Modal Dialog ──────────────────────────────────────── */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border border-slate-200/90 shadow-2xl">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-rose-50 border border-rose-200 text-rose-600 shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <span>{confirmDialog.title}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {confirmDialog.description}
          </div>

          <DialogFooter className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
              className="h-9 rounded-lg border-slate-200 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirmDialog.confirmVariant === "destructive" ? "destructive" : "default"}
              onClick={confirmDialog.onConfirm}
              className={`h-9 px-4 rounded-lg text-xs font-bold shadow-xs cursor-pointer ${
                confirmDialog.confirmVariant === "teal"
                  ? "bg-teal-700 hover:bg-teal-800 text-white"
                  : ""
              }`}
            >
              {confirmDialog.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
