"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function RegisterForm({ className, ...props }) {

  const router = useRouter()

  const [name,setName] = useState("")
  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)

  const handleRegister = async (e) => {

    e.preventDefault()

    try {

      setLoading(true)

      await api("/auth/register",{
        method:"POST",
        body: JSON.stringify({
          name,
          email,
          password
        })
      })

      toast.success("Account created successfully")

      router.push("/login")

    } catch(err) {

      toast.error(err.message)

    } finally {

      setLoading(false)

    }

  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>

      <Card>

        <CardHeader className="text-center">
          <CardTitle className="text-xl">Register</CardTitle>
          <CardDescription>Create Cruise Saga account</CardDescription>
        </CardHeader>

        <CardContent>

          <form onSubmit={handleRegister}>

            <FieldGroup>

              <Field>
                <FieldLabel>Name</FieldLabel>
                <Input
                  type="text"
                  value={name}
                  onChange={(e)=>setName(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel>Password</FieldLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating account..." : "Register"}
                </Button>

                <FieldDescription className="text-center">
                  Already have an account? <a href="/login">Login</a>
                </FieldDescription>

              </Field>

            </FieldGroup>

          </form>

        </CardContent>

      </Card>

    </div>
  )
}