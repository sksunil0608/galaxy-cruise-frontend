"use client"

import { LoginForm } from "@/components/login-form"
import { ShipIcon } from "lucide-react"

export default function LoginPage() {
  return (
    <div
      className="relative flex min-h-svh flex-col items-center justify-center p-6 md:p-10"
      style={{
        backgroundImage: "url('https://t4.ftcdn.net/jpg/01/71/45/49/360_F_171454970_ESzMFnymIcJOHjTL8iTUHhCkMZYLQoDV.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50"></div>

      {/* Content */}
      <div className="relative flex w-full max-w-xl flex-col gap-6 rounded-xl  p-6 backdrop-blur">
        
     

        {/* Login Form */}
        <LoginForm />

      </div>
    </div>
  )
}