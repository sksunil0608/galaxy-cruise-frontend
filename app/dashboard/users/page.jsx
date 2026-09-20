"use client"

import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import DataTable from "@/components/DataTable"

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
  DialogTitle
} from "@/components/ui/dialog"

import { TrashIcon, UsersIcon, PencilIcon, PlusIcon, ShieldIcon, KeyIcon, ArrowLeftIcon } from "lucide-react"

export default function UsersPage(){

  const [users,setUsers] = useState([])
  const [roles,setRoles] = useState([])
  const [permissions,setPermissions] = useState([])
  const [loading,setLoading] = useState(false)

  const [open,setOpen] = useState(false)
  const [editing,setEditing] = useState(null)

  const [form,setForm] = useState({
    name:"",
    email:"",
    password:"",
    role_id:1
  })

  // Drill-down: null = user list, "user" = profile+role panel, "role" = role's permissions panel
  const [view,setView] = useState(null)
  const [activeUser,setActiveUser] = useState(null)
  const [activeRole,setActiveRole] = useState(null)

  const [newRoleName,setNewRoleName] = useState("")
  const [permForm,setPermForm] = useState({ key:"", name:"" })

  const fetchUsers = async ()=>{
    try{
      setLoading(true)
      const data = await api("/users")
      setUsers(data)
    }catch(err){
      console.error(err)
      setUsers([])
    }finally{
      setLoading(false)
    }
  }

  const fetchRoles = async ()=>{
    try{
      const data = await api("/roles")
      setRoles(data)
    }catch(err){
      console.error(err)
      setRoles([])
    }
  }

  const fetchPermissions = async ()=>{
    try{
      const data = await api("/permissions")
      setPermissions(data)
    }catch(err){
      console.error(err)
      setPermissions([])
    }
  }

  useEffect(()=>{
    fetchUsers()
    fetchRoles()
    fetchPermissions()
  },[])

  const deleteUser = async(id)=>{
    if(!confirm("Delete this user?")) return
    await api(`/users/${id}`,{method:"DELETE"})
    fetchUsers()
  }

  const openCreate = ()=>{
    setEditing(null)
    setForm({ name:"", email:"", password:"", role_id:1 })
    setOpen(true)
  }

  const openEdit = (user)=>{
    setEditing(user)
    setForm({ name:user.name, email:user.email, password:"", role_id:user.role_id })
    setOpen(true)
  }

  const saveUser = async ()=>{
    try{
      if(editing){
        await api(`/users/${editing.id}`,{ method:"PUT", body:JSON.stringify(form) })
      }else{
        await api(`/users`,{ method:"POST", body:JSON.stringify(form) })
      }
      setOpen(false)
      fetchUsers()
    }catch(err){
      console.error(err)
    }
  }

  const openUserProfile = (user)=>{
    setActiveUser(user)
    setView("user")
  }

  const openRolePermissions = (role)=>{
    // Role rows from /users may be a lean {id,name} — prefer the full record
    // (with its permissions already included) from /roles when we have it.
    const fullRole = roles.find(r => r.id === role.id) ?? role
    setActiveRole(fullRole)
    setView("role")
  }

  const createRole = async ()=>{
    if(!newRoleName) return
    await api("/roles",{ method:"POST", body:JSON.stringify({name:newRoleName}) })
    setNewRoleName("")
    fetchRoles()
  }

  const deleteRole = async(id)=>{
    if(!confirm("Delete this role?")) return
    await api(`/roles/${id}`,{method:"DELETE"})
    fetchRoles()
    if(activeRole?.id === id){ setView(null); setActiveUser(null); setActiveRole(null) }
  }

  const createPermission = async ()=>{
    if(!permForm.key || !permForm.name) return
    await api("/permissions",{ method:"POST", body:JSON.stringify(permForm) })
    setPermForm({ key:"", name:"" })
    fetchPermissions()
  }

  const deletePermission = async(id)=>{
    if(!confirm("Delete this permission?")) return
    await api(`/permissions/${id}`,{method:"DELETE"})
    fetchPermissions()
  }

  const assignPermissionToRole = async (permissionId)=>{
    if(!activeRole) return
    try{
      await api("/roles/assign-permission",{
        method:"POST",
        body:JSON.stringify({ role_id: activeRole.id, permission_id: permissionId })
      })
      await fetchRoles()
      // Refresh the panel's role snapshot from the reloaded list
      setActiveRole(prev => prev ? (roles.find(r => r.id === prev.id) ?? prev) : prev)
    }catch(err){
      console.error(err)
    }
  }

  const rolePermissionIds = useMemo(
    () => new Set((activeRole?.permissions ?? []).map(rp => rp.permission?.id ?? rp.permissionId)),
    [activeRole]
  )

  const columns = [
    { accessorKey:"id", header:"ID" },
    {
      accessorKey:"name",
      header:"Name",
      cell:({row}) => (
        <button
          onClick={()=>openUserProfile(row.original)}
          className="font-medium hover:underline text-left"
        >
          {row.original.name}
        </button>
      )
    },
    { accessorKey:"email", header:"Email" },
    {
      accessorKey:"role",
      header:"Role",
      cell:({row}) => (
        <button
          onClick={(e)=>{ e.stopPropagation(); if(row.original.role) openRolePermissions(row.original.role) }}
          className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/70 transition"
        >
          {row.original.role?.name || "-"}
        </button>
      )
    },
    {
      header:"Action",
      cell:({row}) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={(e)=>{ e.stopPropagation(); openEdit(row.original) }}>
            <PencilIcon className="size-4"/>
          </Button>
          <Button variant="destructive" size="sm" onClick={(e)=>{ e.stopPropagation(); deleteUser(row.original.id) }}>
            <TrashIcon className="size-4"/>
          </Button>
        </div>
      )
    }
  ]

  // ── Role permissions panel ──────────────────────────────────────────────────
  if (view === "role" && activeRole) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={()=> activeUser ? setView("user") : setView(null)}
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="size-4"/>
              Back
            </button>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ShieldIcon className="size-6"/>
              {activeRole.name}
            </h1>
            <p className="text-sm text-muted-foreground">Role permissions</p>
          </div>
          <Button variant="destructive" size="sm" onClick={()=>deleteRole(activeRole.id)}>
            <TrashIcon className="size-4 mr-1"/>
            Delete Role
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assigned permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(activeRole.permissions ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground py-4">No permissions assigned to this role yet.</div>
            )}
            {(activeRole.permissions ?? []).map(rp => (
              <div key={rp.permission?.id ?? rp.permissionId} className="flex items-center justify-between rounded border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{rp.permission?.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{rp.permission?.key}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyIcon className="size-5"/> Add permission to this role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {permissions.filter(p => !rolePermissionIds.has(p.id)).map(p => (
              <div key={p.id} className="flex items-center justify-between rounded border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.key}</div>
                </div>
                <Button size="sm" onClick={()=>assignPermissionToRole(p.id)}>Add</Button>
              </div>
            ))}
            {permissions.filter(p => !rolePermissionIds.has(p.id)).length === 0 && (
              <div className="text-sm text-muted-foreground py-2">All existing permissions are already assigned.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create a new permission</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="Permission key (e.g. cruises.view)"
              value={permForm.key}
              onChange={(e)=>setPermForm({...permForm,key:e.target.value})}
            />
            <Input
              placeholder="Permission name"
              value={permForm.name}
              onChange={(e)=>setPermForm({...permForm,name:e.target.value})}
            />
            <Button onClick={createPermission}>
              <PlusIcon className="size-4 mr-1"/>
              Create
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── User profile panel ──────────────────────────────────────────────────────
  if (view === "user" && activeUser) {
    return (
      <div className="p-6 space-y-6">
        <button
          onClick={()=>{ setView(null); setActiveUser(null) }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4"/>
          Back to users
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-5"/>
              {activeUser.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Email</div>
                <div className="mt-1">{activeUser.email}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">User ID</div>
                <div className="mt-1">{activeUser.id}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Role</div>
              {activeUser.role ? (
                <button
                  onClick={()=>openRolePermissions(activeUser.role)}
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted transition"
                >
                  <ShieldIcon className="size-4"/>
                  {activeUser.role.name}
                  <span className="text-xs text-muted-foreground">— view permissions</span>
                </button>
              ) : (
                <div className="text-sm text-muted-foreground">No role assigned.</div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={()=>openEdit(activeUser)}>
                <PencilIcon className="size-4 mr-1"/>
                Edit User
              </Button>
              <Button variant="destructive" onClick={()=>{ deleteUser(activeUser.id); setView(null); setActiveUser(null) }}>
                <TrashIcon className="size-4 mr-1"/>
                Delete User
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── User list (default view) ────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <UsersIcon className="size-6"/>
            Users
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage system users. Click a user to view their profile and role; click a role to view its permissions.
          </p>
        </div>

        <div className="flex gap-3">
          <span className="text-sm text-muted-foreground">
            {users.length} users
          </span>
          <Button onClick={openCreate}>
            <PlusIcon className="size-4 mr-1"/>
            Add User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">
              Loading users...
            </div>
          ) : (
            <DataTable columns={columns} data={users}/>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldIcon className="size-5"/> Roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="New role name"
              value={newRoleName}
              onChange={(e)=>setNewRoleName(e.target.value)}
            />
            <Button onClick={createRole}>
              <PlusIcon className="size-4 mr-1"/>
              Add Role
            </Button>
          </div>
          <div className="space-y-2">
            {roles.map(role => (
              <div key={role.id} className="flex items-center justify-between rounded border px-3 py-2">
                <button onClick={()=>openRolePermissions(role)} className="text-sm font-medium hover:underline">
                  {role.name}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{(role.permissions ?? []).length} permissions</span>
                  <Button variant="destructive" size="sm" onClick={()=>deleteRole(role.id)}>
                    <TrashIcon className="size-4"/>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit User Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit User" : "Create User"}
            </DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e)=>setForm({...form,name:e.target.value})}
          />

          <Input
            placeholder="Email"
            value={form.email}
            onChange={(e)=>setForm({...form,email:e.target.value})}
          />

          {!editing && (
            <Input
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e)=>setForm({...form,password:e.target.value})}
            />
          )}

          <select
            className="w-full h-9 rounded-md border px-3 text-sm"
            value={form.role_id}
            onChange={(e)=>setForm({...form,role_id:parseInt(e.target.value)})}
          >
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>

          <Button onClick={saveUser}>
            {editing ? "Update User" : "Create User"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
