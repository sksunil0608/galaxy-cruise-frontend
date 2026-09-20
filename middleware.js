import { NextResponse } from "next/server"

export function middleware(request) {

  const token = request.cookies.get("token")
  const { pathname } = request.nextUrl

  const publicRoutes = [
    "/login",
    "/register",
    "/api"
  ]

  const isPublic = publicRoutes.some(route =>
    pathname.startsWith(route)
  )

  // if route is not public and no token → redirect
  if (!isPublic && !token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // if logged in and trying to access login page
  if (token && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next|static|favicon.ico).*)",
  ]
}