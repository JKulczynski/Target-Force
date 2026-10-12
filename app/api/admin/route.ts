import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tSerwer } from "@/lib/i18n/serwer";
import { POPRAWNY_EMAIL, znajdzLubZapros } from "@/lib/zaproszenie";

export const runtime = "nodejs";

/**
 * Panel administratora WinOver (blok A, 12.10): klienci (organizacje) i kampanie czekające na decyzję.
 * Czyta klientem użytkownika: administrator widzi wszystko przez RLS (czy_dostep_org), klient dostaje 403.
 */
export async function GET() {
  const t = await tSerwer();
  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("czy_admin");
  if (!admin) return NextResponse.json({ blad: t("api.tylkoAdmin") }, { status: 403 });

  const [{ data: organizacje }, { data: czlonkowie }, { data: kampanie }] = await Promise.all([
    supabase.from("organizacje").select("id, nazwa, testowa, utworzona").order("utworzona"),
    supabase.from("czlonkowie").select("organizacja_id, email, rola"),
    supabase.from("kampanie").select("id, nazwa, status, organizacja_id, zgoda_zespolu, utworzona"),
  ]);
  const nazwaOrg = new Map((organizacje ?? []).map((o) => [o.id, o.nazwa]));
  return NextResponse.json({
    czekajace: (kampanie ?? [])
      .filter((k) => k.zgoda_zespolu === "czeka")
      .map((k) => ({ id: k.id, nazwa: k.nazwa, organizacja: nazwaOrg.get(k.organizacja_id) ?? "" })),
    organizacje: (organizacje ?? []).map((o) => ({
      ...o,
      czlonkowie: (czlonkowie ?? []).filter((c) => c.organizacja_id === o.id).map((c) => ({ email: c.email, rola: c.rola })),
      kampanie: (kampanie ?? []).filter((k) => k.organizacja_id === o.id).length,
    })),
  });
}

/** Nowy klient: organizacja + zaproszenie właściciela. Rejestracja tylko z naszego zaproszenia (decyzja Jana 12.10). */
export async function POST(req: NextRequest) {
  const t = await tSerwer();
  const body = await req.json().catch(() => ({}));
  const nazwa = String(body.nazwa ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!nazwa) return NextResponse.json({ blad: t("admin.podajNazwe") }, { status: 400 });
  if (!POPRAWNY_EMAIL.test(email)) return NextResponse.json({ blad: t("api.zlyEmail") }, { status: 400 });

  const supabase = await createClient();
  const { data: jestAdmin } = await supabase.rpc("czy_admin");
  if (!jestAdmin) return NextResponse.json({ blad: t("api.tylkoAdmin") }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ blad: t("api.brakKluczaSerwisowego") }, { status: 500 });

  const konto = await znajdzLubZapros(admin, email, req.nextUrl.origin);
  if ("blad" in konto)
    return NextResponse.json(
      { blad: t(konto.blad === "konta" ? "api.nieudanoSprawdzicKont" : "api.nieudanoZaprosic") },
      { status: konto.blad === "konta" ? 500 : 502 },
    );
  const { data: org, error } = await admin.from("organizacje").insert({ nazwa }).select("id").single();
  if (error || !org) return NextResponse.json({ blad: t("admin.nieUtworzono") }, { status: 500 });
  const { error: bladCzlonka } = await admin
    .from("czlonkowie")
    .insert({ organizacja_id: org.id, user_id: konto.userId, email, rola: "wlasciciel" });
  if (bladCzlonka) return NextResponse.json({ blad: t("api.nieudanoDopisac") }, { status: 500 });
  return NextResponse.json({ ok: true, organizacja: org.id, email, zaproszono: konto.zaproszono });
}
