import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { DOMENA_PRODUKCYJNA } from "@/lib/adres";

// Stary adres przekierowuje na własną domenę (stare linki /r/ i /w/ z wysłanych maili działają dalej).
// API zostaje bez przekierowania: automat Vercela i webhooki wołają adres projektu.
const STARY_ADRES = "target-force.vercel.app";

export async function proxy(request: NextRequest) {
  if (request.headers.get("host") === STARY_ADRES && !request.nextUrl.pathname.startsWith("/api/")) {
    const cel = new URL(request.nextUrl.pathname + request.nextUrl.search, DOMENA_PRODUKCYJNA);
    return NextResponse.redirect(cel, 308);
  }
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
