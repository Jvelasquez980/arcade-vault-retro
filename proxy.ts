import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Rutas que exigen sesión → destino si no hay. Barrera optimista (getClaims);
// la autorización real sigue en páginas/Server Actions con getUser().
const PROTECTED: Record<string, string> = {
  "/auth/username": "/auth",
  "/auth/nueva-clave": "/auth/recuperar",
};

export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);

  const redirectTo = PROTECTED[request.nextUrl.pathname];
  if (redirectTo && !claims) {
    const redirect = NextResponse.redirect(new URL(redirectTo, request.url));
    // Conserva las cookies refrescadas por updateSession.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "cache-control")
        redirect.headers.set(key, value);
    });
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Excluye _next/static, _next/image, favicon.ico e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
