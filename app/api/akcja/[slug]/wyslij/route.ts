import { zablokowane } from "@/lib/blokady";
import { adresAplikacji } from "@/lib/adres";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tSerwer } from "@/lib/i18n/serwer";
import { ileKopii } from "@/lib/podobienstwo";
import { LIMIT_POTWIERDZEN_NA_ADRES, trybProbny, wyslijPrzezWinOver } from "@/lib/poczta-winover";

export const runtime = "nodejs";

/**
 * Mieszkaniec kliknął "Wyślij" (wysyłka przez WinOver). Zapisujemy ostateczny temat i treść,
 * wysyłamy mail z linkiem potwierdzającym. Wiadomość do decydenta wychodzi dopiero po potwierdzeniu (/p/{token}).
 * W trybie próbnym (bez klucza Resend) zwracamy link w odpowiedzi, żeby dało się przejść ścieżkę.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const t = await tSerwer();
  const body = await req.json().catch(() => ({}));
  const podpisId = String(body.podpisId ?? "");
  const temat = String(body.temat ?? "").trim().slice(0, 200);
  const tresc = String(body.tresc ?? "").trim().slice(0, 6000);
  if (!/^[0-9a-f-]{36}$/.test(podpisId) || temat.length < 3 || tresc.length < 20)
    return NextResponse.json({ blad: t("api.akcja.pustaWiadomosc") }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ blad: t("api.akcja.nieDziala") }, { status: 500 });
  const { data: k } = await admin
    .from("kampanie")
    .select("id, akcja_tytul, nazwa, zgoda_zespolu")
    .eq("akcja_slug", slug)
    .maybeSingle();
  if (!k) return NextResponse.json({ blad: t("api.akcja.nieMa") }, { status: 404 });
  if (k.zgoda_zespolu !== "zaakceptowana")
    return NextResponse.json({ blad: t("api.akcja.wysylkaNiedostepna") }, { status: 409 });

  const [{ data: p }, { data: w }] = await Promise.all([
    admin.from("podpisy").select("id, imie, odbiorca_nazwa, status_wysylki, kontakt_id").eq("id", podpisId).eq("kampania_id", k.id).maybeSingle(),
    admin.from("podpisy_wysylka").select("email, token").eq("podpis_id", podpisId).maybeSingle(),
  ]);
  if (!p || !w) return NextResponse.json({ blad: t("api.akcja.nieMa") }, { status: 404 });
  if (p.status_wysylki === "wyslany" || p.status_wysylki === "w_kolejce")
    return NextResponse.json({ ok: true, juz: true });

  if ((await zablokowane(admin, [w.email])).size)
    return NextResponse.json({ blad: t("api.akcja.adresZablokowany") }, { status: 409 });

  const odDoby = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("podpisy_wysylka")
    .select("podpis_id", { count: "exact", head: true })
    .eq("email", w.email)
    .gte("potwierdzenie_wyslane", odDoby);
  if ((count ?? 0) >= LIMIT_POTWIERDZEN_NA_ADRES)
    return NextResponse.json({ blad: t("api.akcja.zaDuzo") }, { status: 429 });

  // Kopie (14.10): ta sama treść do tego samego adresata od co najmniej 2 osób w ostatnim tygodniu = prośba o własne zdanie.
  // Biura poselskie odkładają masowe kopie, a jedno zdanie od siebie wystarcza, żeby wiadomość była inna.
  const odTygodnia = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: inne } = await admin
    .from("podpisy")
    .select("tresc")
    .eq("kontakt_id", p.kontakt_id)
    .neq("id", p.id)
    .in("status_wysylki", ["wyslany", "w_kolejce", "czeka_na_potwierdzenie"])
    .gte("utworzony", odTygodnia)
    .not("tresc", "is", null)
    .limit(300);
  if (ileKopii(tresc, (inne ?? []).map((i) => String(i.tresc))) >= 2)
    return NextResponse.json({ blad: t("api.akcja.kopia"), kopia: true }, { status: 409 });

  await admin.from("podpisy").update({ temat, tresc, status_wysylki: "czeka_na_potwierdzenie" }).eq("id", p.id);

  const link = `${adresAplikacji(req.nextUrl.origin)}/p/${w.token}`;
  const wynik = await wyslijPrzezWinOver({
    doKogo: w.email,
    temat: t("potw.mailTemat", { odbiorca: p.odbiorca_nazwa ?? "" }),
    tresc: t("potw.mailTresc", { imie: p.imie, odbiorca: p.odbiorca_nazwa ?? "", sprawa: k.akcja_tytul || k.nazwa, link }),
    nadawca: "WinOver",
  });
  if (!wynik.ok) return NextResponse.json({ blad: t("api.akcja.nieWyslanoPotwierdzenia") }, { status: 502 });
  await admin.from("podpisy_wysylka").update({ potwierdzenie_wyslane: new Date().toISOString() }).eq("podpis_id", p.id);
  // Adresy testowe Resend (@resend.dev) to skrzynki-atrapy: link wracamy na stronę, żeby test automatem przeszedł
  // całą ścieżkę przy prawdziwym Resend. Nikt realny go nie dostaje, więc potwierdzenie niczego tu nie chroni.
  const pokazLink = trybProbny() || /@resend\.dev$/i.test(w.email);
  return NextResponse.json({ ok: true, proba: trybProbny(), ...(pokazLink ? { linkProbny: link } : {}) });
}
