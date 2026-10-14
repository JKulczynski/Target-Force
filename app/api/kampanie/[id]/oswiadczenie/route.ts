import { adresAplikacji } from "@/lib/adres";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tSerwer } from "@/lib/i18n/serwer";
import {
  sprawdzOswiadczenie,
  WERSJA_OSWIADCZENIA,
  type TrescOswiadczenia,
  type ZgodaZespolu,
} from "@/lib/oswiadczenie";
import { ocenZgodnosc } from "@/lib/zgodnosc";
import { powiadomAdminow } from "@/lib/powiadomienia";

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

/**
 * Złożenie oświadczenia. Serwer dopisuje IP, przeglądarkę i wynik silnika reguł (lib/zgodnosc.ts),
 * kampania przechodzi do "czeka na weryfikację". Silnik nie decyduje; decyduje zespół w PATCH.
 */
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

  // Wynik liczy serwer (nie ufamy polu z formularza) i zapisuje w treści jako ślad z datą oceny.
  const { zgodnosc: _odrzucone, ...czyste } = body;
  void _odrzucone;
  const tresc: TrescOswiadczenia = { ...czyste, zgodnosc: ocenZgodnosc(czyste) };

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const { error } = await supabase.from("oswiadczenia").insert({
    kampania_id: id,
    user_id: uzytkownik.user.id,
    tresc,
    wersja_tresci: WERSJA_OSWIADCZENIA,
    ip,
    user_agent: req.headers.get("user-agent"),
  });
  if (error) return NextResponse.json({ blad: t("api.nieudanoZapisacOswiadczenie") }, { status: 500 });

  // Opcja 3 (decyzja Jana 12.10): "poza zakresem" = organizacja za własne pieniądze, bez wyborów, odbiorcy znani,
  // akceptuje automat. Reszta czeka na administratora WinOver. Strażnik w bazie pozwala klientowi tylko na "czeka",
  // więc automatyczną akceptację zapisuje klient serwisowy (dostęp do kampanii potwierdził już insert pod RLS).
  if (tresc.zgodnosc?.status === "poza_zakresem") {
    const admin = createAdminClient();
    if (admin) {
      const { error: bladAuto } = await admin
        .from("kampanie")
        .update({
          zgoda_zespolu: "zaakceptowana",
          zgoda_powod: POWOD_AUTO,
          zgoda_kto: null,
          zgoda_kiedy: new Date().toISOString(),
        })
        .eq("id", id);
      if (!bladAuto) return NextResponse.json({ ok: true, zgodnosc: tresc.zgodnosc, zgoda: "zaakceptowana", powod: POWOD_AUTO });
    }
  }
  // Czeka na administratora: dajemy znać Janowi i Piotrowi (opcja 3: nie zaglądają do panelu codziennie).
  const adminPowiadomien = createAdminClient();
  if (adminPowiadomien) {
    const { data: kk } = await supabase.from("kampanie").select("nazwa, organizacje(nazwa)").eq("id", id).maybeSingle();
    const org = kk?.organizacje as { nazwa?: string } | { nazwa?: string }[] | null | undefined;
    const nazwaOrg = (Array.isArray(org) ? org[0]?.nazwa : org?.nazwa) ?? "";
    await powiadomAdminow(
      adminPowiadomien,
      `WinOver: kampania czeka na decyzję (${nazwaOrg})`,
      `Klient: ${nazwaOrg}\nKampania: ${kk?.nazwa ?? id}\nOcena reguł: ${tresc.zgodnosc?.status ?? "brak"}\n\nDecyzja: ${adresAplikacji(req.nextUrl.origin)}/kampanie/${id}#zleca\nWszystkie czekające: ${adresAplikacji(req.nextUrl.origin)}/admin`,
    );
  }
  // Nowe oświadczenie zeruje wcześniejszą decyzję: trzeba sprawdzić od nowa.
  await supabase
    .from("kampanie")
    .update({ zgoda_zespolu: "czeka", zgoda_powod: "", zgoda_kto: null, zgoda_kiedy: null })
    .eq("id", id);
  return NextResponse.json({ ok: true, zgodnosc: tresc.zgodnosc, zgoda: "czeka", powod: "" });
}

/** Zapis w bazie (dane, po polsku), interfejs pokazuje go jak każdy powód decyzji. */
const POWOD_AUTO = "automatycznie: poza zakresem szczególnych obowiązków";

/**
 * Decyzja zespołu: zaakceptowana albo odrzucona (z powodem). Tylko gdy oświadczenie istnieje.
 * Gdy silnik dał "niedozwolone lub prawnik", akceptacja też wymaga powodu (ślad: np. opinia prawnika).
 */
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
  const { data: uzytkownik } = await supabase.auth.getUser();
  if (!uzytkownik.user) return NextResponse.json({ blad: t("api.zalogujSie") }, { status: 401 });
  const { data: jestAdmin } = await supabase.rpc("czy_admin");
  if (!jestAdmin) return NextResponse.json({ blad: t("api.tylkoAdmin") }, { status: 403 });
  const { data: ostatnie } = await supabase
    .from("oswiadczenia")
    .select("tresc")
    .eq("kampania_id", id)
    .order("utworzone", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ostatnie)
    return NextResponse.json({ blad: t("api.najpierwOswiadczenie") }, { status: 400 });
  const status = (ostatnie.tresc as TrescOswiadczenia).zgodnosc?.status;
  if (zgoda === "zaakceptowana" && status === "niedozwolone_lub_prawnik" && !powod)
    return NextResponse.json({ blad: t("osw.akceptujaPowod") }, { status: 400 });

  const { error } = await supabase
    .from("kampanie")
    .update({
      zgoda_zespolu: zgoda,
      zgoda_powod: powod,
      zgoda_kto: uzytkownik.user.id,
      zgoda_kiedy: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ blad: t("osw.nieZapisanoDecyzji") }, { status: 500 });
  return NextResponse.json({ ok: true, zgoda, powod });
}
