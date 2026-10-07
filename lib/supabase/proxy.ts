import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/** Odświeża sesję i odsyła niezalogowanych na /login. */
export async function updateSession(request: NextRequest) {
  const sciezka = request.nextUrl.pathname;
  // Strona akcji i jej API: bez sesji i bez cookies Supabase (czyta je mieszkaniec bez konta).
  // Nagłówek mówi layoutowi, żeby nie rysował paska aplikacji.
  if (sciezka.startsWith("/a/") || sciezka.startsWith("/api/akcja/")) {
    const naglowki = new Headers(request.headers);
    naglowki.set("x-strona-publiczna", "1");
    return NextResponse.next({ request: { headers: naglowki } });
  }

  // Ten nagłówek ustawia tylko proxy; gdyby przyszedł od klienta, layout pominąłby pasek i sprawdzenie zespołu.
  if (request.headers.has("x-strona-publiczna")) {
    const naglowki = new Headers(request.headers);
    naglowki.delete("x-strona-publiczna");
    request = new NextRequest(request.url, { headers: naglowki, method: request.method });
  }
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

  // /r/ to linki śledzące z maili: klika w nie odbiorca, który nie ma konta. /api/cron/ wywołuje Vercel (chroni go CRON_SECRET).
  const publiczna =
    sciezka.startsWith("/login") ||
    sciezka.startsWith("/auth") ||
    sciezka.startsWith("/r/") ||
    sciezka.startsWith("/w/") ||
    sciezka.startsWith("/api/cron/");
  if (!zalogowany && !publiczna) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
