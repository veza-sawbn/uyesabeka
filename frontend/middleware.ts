import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { verifyToken } from "@/lib/auth";

// Edge middleware: verify the access-token JWT on every dashboard route and
// bounce unauthenticated users to /login (spec §9.1).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("access_token")?.value;
  const session = token ? await verifyToken(token) : null;

  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? "/dashboard" : "/login", req.url));
  }

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/learners/:path*",
    "/attendance/:path*",
    "/stipends/:path*",
  ],
};
