import { NextRequest, NextResponse } from "next/server";
import { StaffSessionState } from "@/contracts";

/** Page admission only; private business APIs still verify sessions in their own transactions. */
export async function middleware(request: NextRequest) {
  // NextURL normalizes 127.0.0.1 to localhost. Preserve the browser's actual
  // authority so redirects and internal session checks stay on the same host.
  const site = new URL(request.url);
  site.host = request.headers.get("host") ?? site.host;
  const role = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/") ? "admin" : "provider";
  let authenticated = false;
  try {
    const response = await fetch(new URL(`/api/auth/${role}`, site), {
      headers: { cookie: request.headers.get("cookie") ?? "" }, cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const body = await response.json();
      const state = StaffSessionState.safeParse(body.data);
      authenticated = body.ok === true && body.meta?.source === "live" && state.success
        && state.data.status === "signed_in" && state.data.identity.role === role;
    }
  } catch { /* Unavailable authentication never permits page admission. */ }
  if (authenticated) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const login = new URL(`/login/${role}`, site);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.redirect(login);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/provider/:path*", "/admin/:path*"] };
