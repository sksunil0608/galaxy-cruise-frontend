"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { logActivity } from "@/app/dashboard/api"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({ className, ...props }) {

  const router = useRouter()

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)

  const handleLogin = async (e) => {

    e.preventDefault()

    try {

      setLoading(true)

      const res = await api("/auth/login",{
        method:"POST",
        body: JSON.stringify({ email,password })
      })

      localStorage.setItem("token",res.token)
      localStorage.setItem("permissions",JSON.stringify(res.permissions))
      localStorage.setItem("user",JSON.stringify(res.user))

      document.cookie = `token=${res.token}; path=/; max-age=604800`

      logActivity("login", { email: res.user?.email, name: res.user?.name, role: res.user?.role })

      toast.success("Login successful")

      router.push("/dashboard")

    } catch(err) {

      toast.error(err.message)

    } finally {

      setLoading(false)

    }

  }

return (
  <div className={cn("flex flex-col", className)} {...props}>

    <Card className="
      bg-white/11
      backdrop-blur-xl
      border border-white/20
      shadow-2xl
      rounded-3xl
      px-10 py-8
    ">

      <CardHeader className="text-center space-y-5">

        <img
          src="https://cruisesaga.com/cruisesaga.png"
          alt="Cruise Saga"
          className="mx-auto h-20 w-auto"
        />

        <CardTitle className="text-3xl font-bold text-white">
          Cruise Saga
        </CardTitle>

        <CardDescription className="text-white/80 text-base">
          Access Cruise Saga dashboard
        </CardDescription>

      </CardHeader>

      <CardContent className="px-2">

        <form onSubmit={handleLogin}>
          <FieldGroup className="space-y-6">

            <Field>
              <FieldLabel className="text-white">Email</FieldLabel>
              <Input
                type="email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                required
                className="h-14 bg-white/20 border-white/30 text-white"
              />
            </Field>

            <Field>
              <FieldLabel className="text-white">Password</FieldLabel>
              <Input
                type="password"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                required
                className="h-14 bg-white/20 border-white/30 text-white"
              />
            </Field>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-lg font-semibold rounded-xl bg-black/80 hover:bg-black"
            >
              {loading ? "Logging in..." : "Login"}
            </Button>

          </FieldGroup>
        </form>

      </CardContent>
    </Card>
  </div>
)
}