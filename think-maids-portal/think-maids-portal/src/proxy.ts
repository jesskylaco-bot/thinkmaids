import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "tm_session";
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "think-maids-dev-secret-change-me"
);

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let role: string | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      role = (payload as { role?: string }).role ?? null;
    } catch {
      role = null;
    }
  }

  const isApi = pathname.startsWith("/api");

  if (!role) {
    if (isApi) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (isAdminRoute && role !== "admin") {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/login).*)",
  ],
};
