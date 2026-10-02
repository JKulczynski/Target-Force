import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Odświeża sesję i odsyła niezalogowanych na /login. */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value as string),
          );
        },
      },
    },
  );

  // Nic między createServerClient a getClaims, inaczej sesje potrafią się losowo gubić.
  const { data } = await supabase.auth.getClaims();
  const zalogowany = !!data?.claims;

  const sciezka = request.nextUrl.pathname;
  // /r/ to linki śledzące z maili: klika w nie odbiorca, który nie ma konta.
  const publiczna = sciezka.startsWith("/login") || sciezka.startsWith("/auth") || sciezka.startsWith("/r/");
  if (!zalogowany && !publiczna) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
