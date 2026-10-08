import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tSerwer } from "@/lib/i18n/serwer";
import {
  sprawdzOswiadczenie,
  WERSJA_OSWIADCZENIA,
  type TrescOswiadczenia,
  type ZgodaZespolu,
} from "@/lib/oswiadczenie";

export const runtime = "nodejs";

/** Ostatnie oświadczenie zleceniodawcy dla kampanii (append-only, więc najnowsze = obowiązujące). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("oswiadczenia")
    .select("id, tresc, wersja_tresci, utworzone, user_id")
    .eq("kampania_id", id)
    .order("utworzone", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ blad: t("api.nieudanoPobracOswiadczenie") }, { status: 500 });
  return NextResponse.json({ oswiadczenie: data });
}

/** Złożenie oświadczenia. Serwer dopisuje IP i przeglądarkę, kampania przechodzi do "czeka na weryfikację". */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const body = (await req.json().catch(() => null)) as TrescOswiadczenia | null;
  if (!body) return NextResponse.json({ blad: t("api.brakTresci") }, { status: 400 });
  const blad = sprawdzOswiadczenie(body, t);
  if (blad) return NextResponse.json({ blad }, { status: 400 });

  const supabase = await createClient();
  const { data: uzytkownik } = await supabase.auth.getUser();
  if (!uzytkownik.user) return NextResponse.json({ blad: t("api.zalogujSie") }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const { error } = await supabase.from("oswiadczenia").insert({
    kampania_id: id,
    user_id: uzytkownik.user.id,
    tresc: body,
    wersja_tresci: WERSJA_OSWIADCZENIA,
    ip,
    user_agent: req.headers.get("user-agent"),
  });
  if (error) return NextResponse.json({ blad: t("api.nieudanoZapisacOswiadczenie") }, { status: 500 });

  // Nowe oświadczenie zeruje wcześniejszą decyzję: trzeba sprawdzić od nowa.
  await supabase.from("kampanie").update({ zgoda_zespolu: "czeka", zgoda_powod: "" }).eq("id", id);
  return NextResponse.json({ ok: true });
}

/** Decyzja zespołu: zaakceptowana albo odrzucona (z powodem). Tylko gdy oświadczenie istnieje. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const body = await req.json().catch(() => ({}));
  const zgoda = String(body.zgoda ?? "") as ZgodaZespolu;
  if (zgoda !== "zaakceptowana" && zgoda !== "odrzucona")
    return NextResponse.json({ blad: t("api.nieznanaDecyzja") }, { status: 400 });
  const powod = String(body.powod ?? "").trim();
  if (zgoda === "odrzucona" && !powod)
    return NextResponse.json({ blad: t("osw.podajPowod") }, { status: 400 });

  const supabase = await createClient();
  const { count } = await supabase
    .from("oswiadczenia")
    .select("id", { count: "exact", head: true })
    .eq("kampania_id", id);
  if (!count)
    return NextResponse.json({ blad: t("api.najpierwOswiadczenie") }, { status: 400 });

  const { error } = await supabase
    .from("kampanie")
    .update({ zgoda_zespolu: zgoda, zgoda_powod: zgoda === "odrzucona" ? powod : "" })
    .eq("id", id);
  if (error) return NextResponse.json({ blad: t("osw.nieZapisanoDecyzji") }, { status: 500 });
  return NextResponse.json({ ok: true, zgoda, powod });
}
