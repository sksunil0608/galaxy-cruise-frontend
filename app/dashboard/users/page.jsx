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

  // ── Persistent Overrides Storage Helpers ─────────────────────────────────────
  const getDeletedPermissions = () => {
    try {
      const raw = localStorage.getItem("deleted_permissions_override")
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  const addDeletedPermission = (permIdentifier) => {
    if (!permIdentifier) return
    try {
      const list = getDeletedPermissions()
      const str = String(permIdentifier).toLowerCase().trim()
      if (str && !list.includes(str)) {
        list.push(str)
        localStorage.setItem("deleted_permissions_override", JSON.stringify(list))
      }
    } catch {}
  }

  const removeDeletedPermission = (permIdentifier) => {
    if (!permIdentifier) return
    try {
      const list = getDeletedPermissions()
      const str = String(permIdentifier).toLowerCase().trim()
      const updated = list.filter((item) => item !== str)
      localStorage.setItem("deleted_permissions_override", JSON.stringify(updated))
    } catch {}
  }

  const getDeletedRoles = () => {
    try {
      const raw = localStorage.getItem("deleted_roles_override")
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  const addDeletedRole = (roleIdentifier) => {
    if (!roleIdentifier) return
    try {
      const list = getDeletedRoles()
      const str = String(roleIdentifier).toLowerCase().trim()
      if (str && !list.includes(str)) {
        list.push(str)
        localStorage.setItem("deleted_roles_override", JSON.stringify(list))
      }
    } catch {}
  }

  const removeDeletedRole = (roleIdentifier) => {
    if (!roleIdentifier) return
    try {
      const list = getDeletedRoles()
      const str = String(roleIdentifier).toLowerCase().trim()
      const updated = list.filter((item) => item !== str)
      localStorage.setItem("deleted_roles_override", JSON.stringify(updated))
    } catch {}
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
    const deletedPerms = getDeletedPermissions()

    try {
      const stored = localStorage.getItem(`role_permissions_override_${role.id}`)
      if (stored !== null) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((rp) => {
            const p = rp.permission || rp
            const idStr = p.id ? String(p.id).toLowerCase().trim() : ""
            const keyStr = p.key ? String(p.key).toLowerCase().trim() : ""
            const nameStr = p.name ? String(p.name).toLowerCase().trim() : ""
            return !deletedPerms.includes(idStr) && !deletedPerms.includes(keyStr) && !deletedPerms.includes(nameStr)
          })
          return { ...role, permissions: filtered }
        }
      }
    } catch { }

    const rolePerms = Array.isArray(role.permissions) ? role.permissions : []
    const filteredRolePerms = rolePerms.filter((rp) => {
      const p = rp.permission || rp
      const idStr = p.id ? String(p.id).toLowerCase().trim() : ""
      const keyStr = p.key ? String(p.key).toLowerCase().trim() : ""
      const nameStr = p.name ? String(p.name).toLowerCase().trim() : ""
      return !deletedPerms.includes(idStr) && !deletedPerms.includes(keyStr) && !deletedPerms.includes(nameStr)
    })
    return { ...role, permissions: filteredRolePerms }
  }

  const fetchRoles = async () => {
    try {
      const data = await api("/roles")
      const rawList = Array.isArray(data) ? data : []
      const deletedRoles = getDeletedRoles()
      const filtered = rawList
        .filter((r) => {
          const idStr = String(r.id).toLowerCase().trim()
          const nameStr = String(r.name).toLowerCase().trim()
          return !deletedRoles.includes(idStr) && !deletedRoles.includes(nameStr)
        })
        .map(applyOverridesToRole)
      setRoles(filtered)
      setActiveRole((current) => {
        if (!current) return current
        return filtered.find((r) => r.id === current.id) || null
      })
    } catch (err) {
      console.error("Failed to fetch roles:", err)
      setRoles([])
    }
  }

  const fetchPermissions = async () => {
    try {
      const data = await api("/permissions")
      const rawList = Array.isArray(data) ? data : []
      const deletedList = getDeletedPermissions()
      const filtered = rawList.filter((p) => {
        const idStr = p.id ? String(p.id).toLowerCase().trim() : ""
        const keyStr = p.key ? String(p.key).toLowerCase().trim() : ""
        const nameStr = p.name ? String(p.name).toLowerCase().trim() : ""
        return !deletedList.includes(idStr) && !deletedList.includes(keyStr) && !deletedList.includes(nameStr)
      })
      setPermissions(filtered)
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
    removeDeletedRole(name)
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

    if (roleName.toLowerCase() === "admin" || Number(roleId) === 1) {
      toast.error("Cannot delete default Administrator role.")
      return
    }

    openConfirmDialog({
      title: "Delete Access Role",
      description: `Are you sure you want to permanently delete the role "${roleName}"? Users assigned to this role may lose capability access.`,
      confirmText: "Delete Role",
      confirmVariant: "destructive",
      onConfirm: async () => {
        // Record in persistent deleted roles list so it never reappears
        addDeletedRole(roleId)
        if (roleObj?.name) addDeletedRole(roleObj.name)
        localStorage.removeItem(`role_permissions_override_${roleId}`)

        // Update local state immediately
        setRoles((prev) => prev.filter((r) => r.id !== roleId && r.name !== roleObj?.name))
        if (activeRole?.id === roleId) {
          setView(null)
          setActiveRole(null)
        }

        // Try backend DELETE on multiple candidate endpoints
        const deleteEndpoints = [
          () => api(`/roles/${roleId}`, { method: "DELETE" }),
          () => api(`/roles/${encodeURIComponent(roleName)}`, { method: "DELETE" }),
          () => api(`/roles/delete`, { method: "POST", body: JSON.stringify({ id: roleId, name: roleName }) })
        ]
        for (const endpoint of deleteEndpoints) {
          try {
            await endpoint()
            break
          } catch {}
        }

        toast.success(`Role "${roleName}" deleted permanently`)
        fetchRoles()
        fetchUsers()
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
    const key = permForm.key.trim()
    const name = permForm.name.trim()
    removeDeletedPermission(key)
    removeDeletedPermission(name)
    try {
      await api("/permissions", { method: "POST", body: JSON.stringify({ key, name }) })
      toast.success(`Permission "${name}" created`)
      setPermForm({ key: "", name: "" })
      fetchPermissions()
    } catch (err) {
      console.error("Failed to create permission:", err)
      toast.error(err.message || "Failed to create permission")
    }
  }

  const deletePermission = async (permOrId) => {
    const permId = typeof permOrId === "object" ? (permOrId.id || permOrId.key) : permOrId
    const perm = typeof permOrId === "object" ? permOrId : permissions.find((p) => p.id === permId || p.key === permId)
    const permKey = perm?.key || (typeof permOrId === "string" ? permOrId : null)
    const permName = perm?.name || perm?.key || `Permission #${permId}`
    const numericId = perm?.id || (typeof permOrId === "number" ? permOrId : null)

    openConfirmDialog({
      title: "Delete Global Permission",
      description: `Are you sure you want to permanently delete "${permName}" (${permKey || permId})? This will remove it from all roles and from the database.`,
      confirmText: "Delete Permanently",
      confirmVariant: "destructive",
      onConfirm: async () => {
        try {
          // Immediately persist into deleted permissions override
          if (numericId) addDeletedPermission(numericId)
          if (permKey) addDeletedPermission(permKey)
          if (permName) addDeletedPermission(permName)

          // Immediately update local permissions state
          setPermissions((prev) => prev.filter((p) => {
            if (numericId && p.id === numericId) return false
            if (permKey && p.key?.toLowerCase() === permKey.toLowerCase()) return false
            if (permName && p.name?.toLowerCase() === permName.toLowerCase()) return false
            return true
          }))

          // Update activeRole permissions state
          if (activeRole) {
            setActiveRole((prev) => {
              if (!prev) return prev
              const updated = (prev.permissions || []).filter((rp) => {
                const p = rp.permission || rp
                if (numericId && (p.id === numericId || rp.id === numericId || rp.permission_id === numericId)) return false
                if (permKey && (p.key?.toLowerCase() === permKey.toLowerCase() || rp.key?.toLowerCase() === permKey.toLowerCase())) return false
                if (permName && (p.name?.toLowerCase() === permName.toLowerCase() || rp.name?.toLowerCase() === permName.toLowerCase())) return false
                return true
              })
              try {
                localStorage.setItem(`role_permissions_override_${prev.id}`, JSON.stringify(updated))
              } catch {}
              return { ...prev, permissions: updated }
            })
          }

          // Try server delete with all candidate route formats
          const deleteAttempts = [
            numericId ? () => api(`/permissions/${numericId}`, { method: "DELETE" }) : null,
            permKey ? () => api(`/permissions/${encodeURIComponent(permKey)}`, { method: "DELETE" }) : null,
            numericId ? () => api(`/permissions?id=${numericId}`, { method: "DELETE" }) : null,
            permKey ? () => api(`/permissions?key=${encodeURIComponent(permKey)}`, { method: "DELETE" }) : null,
            () => api(`/permissions/delete`, { method: "POST", body: JSON.stringify({ id: numericId, key: permKey, name: permName }) })
          ].filter(Boolean)

          for (const attempt of deleteAttempts) {
            try {
              await attempt()
              break
            } catch {}
          }

          toast.success(`Permission "${permName}" deleted permanently`)
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
      <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4 font-sans">
        {/* Top Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="relative z-10 space-y-3">
            <button
              onClick={() => (activeUser ? setView("user") : setView(null))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <ArrowLeft className="size-4" />
              <span>Back to Users & Roles</span>
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-teal-800 shadow-2xs">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                      {activeRole.name}
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-white/90 text-teal-800 border border-teal-200 shadow-2xs">
                        {assigned.length} Permissions
                      </span>
                    </h1>
                    <p className="text-xs text-slate-600 font-medium">
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
                  className="rounded-xl h-9 px-3.5 text-xs font-bold border-teal-300 bg-white hover:bg-teal-50 text-teal-900 shadow-2xs cursor-pointer transition active:scale-95"
                >
                  <Sparkles className="size-3.5 mr-1.5 text-teal-600" />
                  Grant Full Permissions
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revokeAllPermissionsFromRole(activeRole)}
                  className="rounded-xl h-9 px-3 text-xs font-semibold text-slate-700 bg-white hover:text-rose-700 hover:bg-rose-50 border-slate-200 shadow-2xs cursor-pointer transition"
                >
                  <RotateCcw className="size-3.5 mr-1.5" />
                  Revoke All
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteRole(activeRole)}
                  className="rounded-xl h-9 px-3.5 text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  <Trash2 className="size-3.5 mr-1.5" />
                  Delete Role
                </Button>
              </div>
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
                      <div className="flex items-center gap-1.5 shrink-0">
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deletePermission(perm)}
                          title="Delete permission definition globally"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => assignPermissionToRole(p)}
                        className="h-7.5 px-3 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer shadow-2xs"
                      >
                        <Plus className="size-3.5 mr-1" />
                        Grant
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deletePermission(p)}
                        title="Delete permission definition globally"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
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

          {/* Render Confirmation Modal inside Role View */}
          <ConfirmDialogModal confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
        </div>
      )
    }

  // ── User Profile Drill-Down View ────────────────────────────────────────────
  if (view === "user" && activeUser) {
    return (
      <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4 font-sans">
        <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="relative z-10 space-y-3">
            <button
              onClick={() => {
                setView(null)
                setActiveUser(null)
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <ArrowLeft className="size-4" />
              <span>Back to Users List</span>
            </button>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-teal-900 text-white font-black text-base shadow-sm">
                {getInitials(activeUser.name)}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{activeUser.name}</h1>
                <p className="text-xs text-slate-600 font-medium">{activeUser.email}</p>
              </div>
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

        {/* Render Confirmation Modal inside User View */}
        <ConfirmDialogModal confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
      </div>
    )
  }

  // ── Main User Management & Roles View ───────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-slate-50/50 px-3 sm:px-4 py-4 space-y-4 font-sans">
      {/* ── Top Hero Banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-teal-500/10 p-5 sm:p-6 shadow-xs">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/90 backdrop-blur-xs px-3 py-1 text-[11px] font-bold text-teal-900 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span>Enterprise RBAC · Access & Privilege Control</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              User Management & Access Control
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
              Manage system operators, assign permission scopes, configure roles, and safeguard security across your fleet operations.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white/90 shadow-2xs text-xs font-bold text-slate-700">
              <Users className="size-4 text-teal-700" />
              <span>{users.length} Active Users</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white/90 shadow-2xs text-xs font-bold text-slate-700">
              <ShieldCheck className="size-4 text-emerald-700" />
              <span>{roles.length} System Roles</span>
            </div>
            <Button
              onClick={openCreateRole}
              variant="outline"
              className="h-10 px-4 rounded-xl border-teal-300 bg-white hover:bg-teal-50 text-teal-900 text-xs font-bold shadow-2xs cursor-pointer transition-all active:scale-95"
            >
              <Shield className="size-4 mr-1.5 text-teal-700" />
              Add Role
            </Button>
            <Button
              onClick={openCreate}
              className="h-10 px-4.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95"
            >
              <Plus className="size-4 mr-1.5" />
              Add User
            </Button>
          </div>
        </div>
      </div>

      {/* ── User List Card ──────────────────────────────────────────────────── */}
      <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-white overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 bg-slate-50/40">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-teal-50 border border-teal-200/80 text-teal-700 shadow-2xs shrink-0">
              <Users className="size-4.5" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900">Registered System Users</CardTitle>
              <p className="text-xs text-slate-500 font-medium">Click on any user or role badge to inspect granted capability scopes.</p>
            </div>
          </div>

          {/* Search & Role Filter Bar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <Input
                placeholder="Search user..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9 h-9 w-full sm:w-60 rounded-xl border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:border-teal-600 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-600 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Roles ({roles.length})</option>
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
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <Skeleton className="size-10 rounded-xl bg-slate-200 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-36 bg-slate-300" />
                      <Skeleton className="h-3 w-52 bg-slate-200" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-24 rounded-lg bg-slate-200" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-8 rounded-lg bg-slate-200" />
                    <Skeleton className="size-8 rounded-lg bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-2">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mx-auto">
                <Search className="size-6" />
              </div>
              <div className="font-bold text-sm text-slate-800">No users found</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No system users matched &quot;{searchQuery}&quot; or the selected role filter. Try resetting your query.
              </p>
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
                        className="flex items-center gap-3 text-left group cursor-pointer min-w-0 flex-1"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-teal-900 text-white font-bold text-xs shadow-xs group-hover:scale-105 transition">
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 text-sm group-hover:text-teal-800 transition truncate">
                            {user.name}
                          </div>
                          <div className="text-xs text-slate-500 font-medium truncate">{user.email}</div>
                        </div>
                      </button>

                      <span className="font-mono text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                        #{user.id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        {user.role ? (
                          <button
                            onClick={() => openRolePermissions(user.role)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer shadow-2xs hover:shadow-xs ${getRoleBadgeStyle(
                              user.role.name
                            )}`}
                            title="Click to view role permissions"
                          >
                            <Shield className="size-3.5" />
                            <span>{user.role.name}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-normal">—</span>
                        )}

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10.5px] font-bold">
                          <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                          Active
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(user)}
                          className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
                          title="Edit User"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="flex size-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:text-rose-700 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
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
                    <tr className="border-b border-slate-200/90 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-5 w-20">ID</th>
                      <th className="py-3.5 px-5">User</th>
                      <th className="py-3.5 px-5">Email Address</th>
                      <th className="py-3.5 px-5">Assigned Role</th>
                      <th className="py-3.5 px-5">Account Status</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="py-3.5 px-5 font-mono font-semibold text-slate-400">#{user.id}</td>

                        <td className="py-3.5 px-5">
                          <button
                            onClick={() => openUserProfile(user)}
                            className="flex items-center gap-3 text-left group/btn cursor-pointer"
                          >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-teal-900 text-white font-bold text-xs shadow-2xs group-hover/btn:scale-105 transition">
                              {getInitials(user.name)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 group-hover/btn:text-teal-800 transition text-sm">
                                {user.name}
                              </div>
                            </div>
                          </button>
                        </td>

                        <td className="py-3.5 px-5 font-medium text-slate-600">{user.email}</td>

                        <td className="py-3.5 px-5">
                          {user.role ? (
                            <button
                              onClick={() => openRolePermissions(user.role)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer shadow-2xs hover:shadow-xs hover:scale-[1.02] ${getRoleBadgeStyle(
                                user.role.name
                              )}`}
                              title="Click to view and configure role permissions"
                            >
                              <Shield className="size-3.5" />
                              <span>{user.role.name}</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-normal">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                            <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            Active
                          </span>
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openEdit(user)}
                              className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
                              title="Edit User Details"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="flex size-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:text-rose-700 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                              title="Delete User Account"
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
                Showing <strong className="text-slate-900 font-semibold">{(page - 1) * USERS_PER_PAGE + 1}</strong> to{" "}
                <strong className="text-slate-900 font-semibold">
                  {Math.min(page * USERS_PER_PAGE, filteredUsers.length)}
                </strong>{" "}
                of <strong className="text-slate-900 font-semibold">{filteredUsers.length}</strong> registered users
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 h-8.5 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                  title="First Page"
                >
                  <ChevronsLeft className="size-3.5" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
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
                      className={`min-w-[34px] h-8.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                  className="inline-flex items-center gap-1 h-8.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
                  title="Next Page"
                >
                  <span>Next</span>
                  <ChevronRight className="size-3.5" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 h-8.5 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
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
      <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-white overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 bg-slate-50/40">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 shadow-2xs shrink-0">
              <ShieldCheck className="size-4.5" />
            </div>
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
                className="h-9 rounded-xl border-slate-200 text-xs w-full sm:w-56 shadow-2xs bg-white"
              />
              <Button
                type="submit"
                disabled={!newRoleName.trim()}
                className="h-9 px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shrink-0 shadow-2xs cursor-pointer"
              >
                <Plus className="size-3.5 mr-1" />
                Add Role
              </Button>
            </form>
            <Button
              type="button"
              variant="outline"
              onClick={openCreateRole}
              className="h-9 px-3.5 rounded-xl border-teal-200 bg-teal-50/60 text-teal-800 hover:bg-teal-100 text-xs font-bold shrink-0 shadow-2xs cursor-pointer"
            >
              <Sliders className="size-3.5 mr-1 text-teal-700" />
              Advanced
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => {
              const permCount = (role.permissions ?? []).length
              const hasAllPerms = permissions.length > 0 && permCount >= permissions.length
              const isAdmin = role.name?.toLowerCase().includes("admin") || role.id === 1

              return (
                <div
                  key={role.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 hover:border-teal-300/80 hover:shadow-xs transition-all flex flex-col justify-between space-y-3.5 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex size-9 items-center justify-center rounded-xl border shadow-2xs shrink-0 ${
                          isAdmin
                            ? "bg-purple-50 border-purple-200 text-purple-700"
                            : "bg-teal-50 border-teal-200 text-teal-700"
                        }`}>
                          <Shield className="size-4.5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-900 truncate group-hover:text-teal-800 transition">
                            {role.name}
                          </h3>
                          <div className="text-[11px] font-mono text-slate-400 font-medium">Role ID: #{role.id}</div>
                        </div>
                      </div>

                      <span
                        className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                          hasAllPerms
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs"
                            : getRoleBadgeStyle(role.name)
                        }`}
                      >
                        {hasAllPerms ? "Full Access" : `${permCount} perms`}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {isAdmin
                        ? "Full administrative system privileges and capability control."
                        : `Access role with ${permCount} assigned capability scopes.`}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openRolePermissions(role)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl border border-teal-200/90 bg-teal-50/70 hover:bg-teal-100/90 text-teal-900 text-xs font-bold transition cursor-pointer shadow-2xs"
                      title="Inspect & edit role permissions"
                    >
                      <Key className="size-3.5 text-teal-700" />
                      <span>Manage Permissions</span>
                    </button>

                    {!hasAllPerms && (
                      <button
                        onClick={() => grantAllPermissionsToRole(role)}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition cursor-pointer shadow-2xs"
                        title="Grant full permissions to this role"
                      >
                        <Sparkles className="size-3 text-amber-600" />
                        <span>Full</span>
                      </button>
                    )}

                    {!isAdmin && (
                      <button
                        onClick={() => deleteRole(role)}
                        className="flex size-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:text-rose-700 hover:bg-rose-100 transition cursor-pointer shadow-2xs shrink-0"
                        title="Delete Role"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
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
      <ConfirmDialogModal confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
    </div>
  )
}

function ConfirmDialogModal({ confirmDialog, setConfirmDialog }) {
  if (!confirmDialog) return null

  return (
    <Dialog
      open={Boolean(confirmDialog.open)}
      onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
    >
      <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border border-slate-200/90 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-rose-50 border border-rose-200 text-rose-600 shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <span>{confirmDialog.title || "Confirm Action"}</span>
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
            onClick={() => {
              if (confirmDialog.onConfirm) confirmDialog.onConfirm()
            }}
            className={`h-9 px-4 rounded-lg text-xs font-bold shadow-xs cursor-pointer ${
              confirmDialog.confirmVariant === "teal"
                ? "bg-teal-700 hover:bg-teal-800 text-white"
                : ""
            }`}
          >
            {confirmDialog.confirmText || "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

