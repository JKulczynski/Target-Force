import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tSerwer } from "@/lib/i18n/serwer";
import { czyPostawa } from "@/lib/postawa";

export const runtime = "nodejs";

/** Lista odbiorców kampanii ze statusem: wysłane kroki, kliknięcie, odpowiedź (pierwsza część dowodu efektu). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const [{ data: kontakty, error }, { data: wiad }] = await Promise.all([
    supabase.from("kontakty").select("id, imie, nazwisko, email, organizacja, dane, odpowiedzial, wypisany, postawa").eq("kampania_id", id).order("nazwisko"),
    supabase.from("wiadomosci").select("id, kontakt_id, krok, status, wyslana, blad").eq("kampania_id", id),
  ]);
  if (error) {
    const t = await tSerwer();
    return NextResponse.json({ blad: t("api.nieudanoWczytacOdbiorcow") }, { status: 500 });
  }

  const ids = (wiad ?? []).filter((w) => w.status === "wyslana").map((w) => w.id);
  const kliknieteWiad = new Set<string>();
  if (ids.length) {
    const { data: zd } = await supabase.from("zdarzenia").select("wiadomosc_id").eq("typ", "klikniecie").in("wiadomosc_id", ids);
    (zd ?? []).forEach((z) => kliknieteWiad.add(z.wiadomosc_id));
  }

  const lista = (kontakty ?? []).map((c) => {
    const moje = (wiad ?? []).filter((w) => w.kontakt_id === c.id);
    const wyslane = moje.filter((w) => w.status === "wyslana");
    const ostatnia = wyslane.sort((a, b) => (b.wyslana ?? "").localeCompare(a.wyslana ?? ""))[0];
    const dane = (c.dane ?? {}) as Record<string, unknown>;
    return {
      id: c.id,
      imie: c.imie,
      nazwisko: c.nazwisko,
      email: c.email,
      klub: c.organizacja,
      okreg: typeof dane.okreg === "string" ? dane.okreg : null,
      wyslanychKrokow: wyslane.length,
      ostatniaWyslana: ostatnia?.wyslana ?? null,
      blad: moje.find((w) => w.status === "blad")?.blad ?? null,
      kliknal: moje.some((w) => kliknieteWiad.has(w.id)),
      odpowiedzial: c.odpowiedzial,
      wypisany: c.wypisany,
      postawa: czyPostawa(c.postawa) ? c.postawa : null,
    };
  });
  return NextResponse.json({ odbiorcy: lista });
}

/**
 * Zaznaczenie "odpisał" (odpowiedzi trafiają do skrzynki nadawcy, nie do aplikacji; odpisani nie dostają przypomnień)
 * albo postawy wobec sprawy (za / waha się / przeciw, null = nie wiadomo). W jednym żądaniu jedno albo drugie.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const kontaktId = String(body.kontaktId ?? "");
  const t = await tSerwer();
  let zmiana: Record<string, string | null>;
  if ("postawa" in body) {
    if (body.postawa !== null && !czyPostawa(body.postawa)) return NextResponse.json({ blad: t("api.nieudanoZapisac") }, { status: 400 });
    zmiana = { postawa: body.postawa, postawa_zmieniona: new Date().toISOString() };
  } else {
    zmiana = { odpowiedzial: body.odpisal ? new Date().toISOString() : null };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("kontakty")
    .update(zmiana)
    .eq("id", kontaktId)
    .eq("kampania_id", id);
  if (error) return NextResponse.json({ blad: t("api.nieudanoZapisac") }, { status: 500 });
  return NextResponse.json({ ok: true });
}
