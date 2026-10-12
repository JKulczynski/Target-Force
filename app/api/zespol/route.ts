import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tSerwer } from "@/lib/i18n/serwer";
import { POPRAWNY_EMAIL, znajdzLubZapros } from "@/lib/zaproszenie";

export const runtime = "nodejs";

/** Członkowie MOJEJ organizacji (od 12.10 zespół = organizacja klienta, nie wszyscy użytkownicy). */
export async function GET() {
  const t = await tSerwer();
  const supabase = await createClient();
  const { data: org } = await supabase.rpc("moja_organizacja");
  if (!org) return NextResponse.json([]);
  const { data, error } = await supabase
    .from("czlonkowie")
    .select("user_id, email, dodany, rola")
    .eq("organizacja_id", org)
    .order("dodany");
  if (error)
    return NextResponse.json({ blad: t("api.nieudanoPobracZespolu") }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * Zaproszenie osoby do MOJEJ organizacji. Zapis robi klient serwisowy (tabela czlonkowie nie ma zapisu w RLS),
 * dopiero po sprawdzeniu, że prosi członek tej organizacji.
 */
export async function POST(req: NextRequest) {
  const t = await tSerwer();
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!POPRAWNY_EMAIL.test(email))
    return NextResponse.json({ blad: t("api.zlyEmail") }, { status: 400 });

  const supabase = await createClient();
  const { data: org } = await supabase.rpc("moja_organizacja");
  if (!org) return NextResponse.json({ blad: t("api.tylkoCzlonek") }, { status: 403 });

  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json({ blad: t("api.brakKluczaSerwisowego") }, { status: 500 });

  const { data: juz } = await supabase
    .from("czlonkowie")
    .select("email")
    .eq("organizacja_id", org)
    .eq("email", email)
    .maybeSingle();
  if (juz) return NextResponse.json({ blad: t("api.juzWZespole") }, { status: 409 });

  const konto = await znajdzLubZapros(admin, email, req.nextUrl.origin);
  if ("blad" in konto)
    return NextResponse.json(
      { blad: t(konto.blad === "konta" ? "api.nieudanoSprawdzicKont" : "api.nieudanoZaprosic") },
      { status: konto.blad === "konta" ? 500 : 502 },
    );

  const { error } = await admin
    .from("czlonkowie")
    .insert({ organizacja_id: org, user_id: konto.userId, email, rola: "czlonek" });
  if (error)
    return NextResponse.json({ blad: t("api.nieudanoDopisac") }, { status: 500 });

  return NextResponse.json({ ok: true, email, zaproszono: konto.zaproszono });
}
