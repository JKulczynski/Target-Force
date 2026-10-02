import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Lista odbiorców kampanii ze statusem: wysłane kroki, kliknięcie, odpowiedź (pierwsza część dowodu efektu). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const [{ data: kontakty, error }, { data: wiad }] = await Promise.all([
    supabase.from("kontakty").select("id, imie, nazwisko, email, organizacja, dane, odpowiedzial, wypisany").eq("kampania_id", id).order("nazwisko"),
    supabase.from("wiadomosci").select("id, kontakt_id, krok, status, wyslana, blad").eq("kampania_id", id),
  ]);
  if (error) return NextResponse.json({ blad: "Nie udało się wczytać odbiorców." }, { status: 500 });

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
    };
  });
  return NextResponse.json({ odbiorcy: lista });
}

/** Zaznaczenie "odpisał" (odpowiedzi trafiają do skrzynki nadawcy, nie do aplikacji). Odpisani nie dostają przypomnień. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const kontaktId = String(body.kontaktId ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("kontakty")
    .update({ odpowiedzial: body.odpisal ? new Date().toISOString() : null })
    .eq("id", kontaktId)
    .eq("kampania_id", id);
  if (error) return NextResponse.json({ blad: "Nie udało się zapisać." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
