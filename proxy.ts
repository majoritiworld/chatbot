import { type NextRequest, NextResponse } from "next/server";
import {
  getEntrevistaIdByEmail,
  homePathForRol,
  isPortalRole,
  isStakeholderRole,
  stakeholderNeedsInterviewLanding,
} from "@/lib/consultoria/roles";
import { updateSession } from "@/lib/supabase/middleware";

const LEGACY_STAKEHOLDER = /^\/admin\/stakeholder\/([0-9a-f-]{36})$/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong");
  }

  const { supabase, supabaseResponse, user } = await updateSession(request);
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  const isPublicAuth =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/");

  if (
    !user &&
    !isPublicAuth &&
    (pathname.startsWith("/api/") ||
      pathname === "/" ||
      pathname.startsWith("/chat") ||
      pathname.startsWith("/portal") ||
      pathname.startsWith("/admin"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/admin")
      ? `${base}/login/admin`
      : `${base}/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (
    user &&
    (pathname === "/login" ||
      pathname.startsWith("/login/") ||
      pathname === "/register")
  ) {
    const { data: perfil } = await supabase
      .from("usuario")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    const entrevistaId = isStakeholderRole(perfil?.rol)
      ? await getEntrevistaIdByEmail(supabase, user.email)
      : null;
    const url = request.nextUrl.clone();
    url.pathname = `${base}${homePathForRol(perfil?.rol, entrevistaId)}`;
    url.searchParams.delete("error");
    return NextResponse.redirect(url);
  }

  // Role routing lives here rather than in the pages: those stream under
  // Suspense (Cache Components), which would downgrade a redirect to a
  // client-side meta refresh.
  const isPortal = pathname.startsWith("/portal");
  const isAdmin = pathname.startsWith("/admin");

  if (user && (pathname === "/" || isPortal || isAdmin)) {
    const { data: perfil } = await supabase
      .from("usuario")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    const portalRole = isPortalRole(perfil?.rol);
    const isMajoriti = perfil?.rol === "majoriti";
    const url = request.nextUrl.clone();
    const entrevistaId = isStakeholderRole(perfil?.rol)
      ? await getEntrevistaIdByEmail(supabase, user.email)
      : null;
    const home = `${base}${homePathForRol(perfil?.rol, entrevistaId)}`;

    if (pathname === "/") {
      url.pathname = home;
      return NextResponse.redirect(url);
    }

    if (isPortal && !portalRole) {
      url.pathname = isMajoriti ? `${base}/admin` : `${base}/sin-acceso`;
      return NextResponse.redirect(url);
    }

    if (
      isStakeholderRole(perfil?.rol) &&
      entrevistaId &&
      stakeholderNeedsInterviewLanding(pathname)
    ) {
      url.pathname = home;
      return NextResponse.redirect(url);
    }

    if (isAdmin && !isMajoriti) {
      url.pathname = portalRole ? home : `${base}/sin-acceso`;
      return NextResponse.redirect(url);
    }

    // Legacy URL from before the admin was split per project. Same reason as
    // above: a page-level redirect would stream instead of being a real one.
    const legacy = LEGACY_STAKEHOLDER.exec(pathname);
    if (isMajoriti && legacy) {
      const { data: stakeholder } = await supabase
        .from("stakeholder")
        .select("proyecto_id")
        .eq("id", legacy[1])
        .maybeSingle();

      if (stakeholder) {
        url.pathname = `${base}/admin/${stakeholder.proyecto_id}/stakeholder/${legacy[1]}`;
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/portal/:path*",
    "/admin/:path*",
    "/api/:path*",
    "/login",
    "/login/:path*",
    "/register",
    "/auth/:path*",
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
