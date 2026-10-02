import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { odszyfruj } from "@/lib/szyfr";
import { opiszBladSmtp, transport } from "@/lib/smtp";
import { POBIERACZE } from "@/lib/zrodla-serwer";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Największa partia na jedno kliknięcie. Z przerwą między mailami mieści się w limicie czasu funkcji. */
const MAKS_PARTIA = 25;
/** Przerwa między kolejnymi mailami. Wolniejsza wysyłka wygląda jak człowiek, nie jak masówka. */
const PRZERWA_MS = 3000;

type Supabase = Awaited<ReturnType<typeof createClient>>;

const czekaj = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Każdy link w treści przechodzi przez /r/{wiadomość}, żeby policzyć kliknięcia (główna miara kampanii). */
function zLinkamiSledzacymi(tresc: string, baza: string, wiadomoscId: string) {
  return tresc.replace(/https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?]/g, (url) => `${baza}/r/${wiadomoscId}?u=${encodeURIComponent(url)}`);
}

function poczatekDnia() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Ile maili ta skrzynka wysłała dziś, we wszystkich kampaniach (dzienny limit dotyczy skrzynki, nie kampanii). */
async function wyslaneDzisZeSkrzynki(supabase: Supabase, skrzynkaId: string) {
  const { data: kampanie } = await supabase.from("kampanie").select("id").eq("skrzynka_id", skrzynkaId);
  const ids = (kampanie ?? []).map((k) => k.id);
  if (ids.length === 0) return 0;
  const { count } = await supabase
    .from("wiadomosci")
    .select("id", { count: "exact", head: true })
    .in("kampania_id", ids)
    .gte("wyslana", poczatekDnia());
  return count ?? 0;
}

async function stan(supabase: Supabase, kampaniaId: string, skrzynkaId: string | null) {
  const pierwsze = (status: string) =>
    supabase.from("wiadomosci").select("id", { count: "exact", head: true }).eq("kampania_id", kampaniaId).eq("krok", 0).eq("status", status);
  const [{ count: odbiorcy }, { count: wyslaneN }, { count: bledyN }] = await Promise.all([
    supabase.from("kontakty").select("id", { count: "exact", head: true }).eq("kampania_id", kampaniaId).eq("wypisany", false).not("email", "is", null),
    pierwsze("wyslana"),
    pierwsze("blad"),
  ]);
  const wyslane = wyslaneN ?? 0;
  const bledy = bledyN ?? 0;

  let limit = 0;
  let dzis = 0;
  if (skrzynkaId) {
    const { data: s } = await supabase.from("skrzynki").select("dzienny_limit").eq("id", skrzynkaId).maybeSingle();
    limit = s?.dzienny_limit ?? 0;
    dzis = await wyslaneDzisZeSkrzynki(supabase, skrzynkaId);
  }
  const doWyslania = Math.max((odbiorcy ?? 0) - wyslane - bledy, 0);

  // Ile osób kliknęło link (unikalne wiadomości z co najmniej jednym kliknięciem).
  const { data: wysylkaIds } = await supabase.from("wiadomosci").select("id").eq("kampania_id", kampaniaId).eq("status", "wyslana");
  let kliknieci = 0;
  if (wysylkaIds && wysylkaIds.length > 0) {
    const { data: klik } = await supabase.from("zdarzenia").select("wiadomosc_id").eq("typ", "klikniecie").in("wiadomosc_id", wysylkaIds.map((w) => w.id));
    kliknieci = new Set((klik ?? []).map((z) => z.wiadomosc_id)).size;
  }
  return { odbiorcy: odbiorcy ?? 0, wyslane, bledy, doWyslania, limit, dzis, zostaloDzis: Math.max(limit - dzis, 0), kliknieci };
}

async function wczytajKampanie(supabase: Supabase, id: string) {
  const { data } = await supabase.from("kampanie").select("id, status, zrodla, skrzynka_id, filtr_odbiorcow").eq("id", id).maybeSingle();
  return data;
}

type Filtr = { komisje?: string[]; kluby?: string[] };

/** ID posłów z wybranych komisji Sejmu (puste = bez zawężenia po komisjach). */
async function poslowieKomisji(kody: string[]): Promise<Set<string> | null> {
  if (kody.length === 0) return null;
  const odp = await fetch("https://api.sejm.gov.pl/sejm/term10/committees", { next: { revalidate: 60 * 60 * 24 } });
  if (!odp.ok) throw new Error("komisje");
  const komisje = (await odp.json()) as { code: string; members?: { id: number }[] }[];
  return new Set(komisje.filter((k) => kody.includes(k.code)).flatMap((k) => (k.members ?? []).map((m) => String(m.id))));
}

/** Stan wysyłki: odbiorcy, wysłane, błędy, dzienny limit skrzynki. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const k = await wczytajKampanie(supabase, id);
  if (!k) return NextResponse.json({ blad: "Nie znaleziono kampanii albo brak dostępu." }, { status: 404 });
  return NextResponse.json({ ...(await stan(supabase, id, k.skrzynka_id)), filtr: (k.filtr_odbiorcow as Filtr) ?? {} });
}

/**
 * Trzy tryby:
 * - "odbiorcy": pobiera kontakty z e-mailem ze źródeł kampanii (Sejm, Tweede Kamer) do bazy, żeby było wiadomo, do kogo idzie wysyłka.
 * - "test": wysyła zatwierdzone warianty pierwszej wiadomości na podany adres (własny), z dopiskiem [TEST]. Nie liczy się do kampanii.
 * - "partia": wysyła pierwszą wiadomość do kolejnych odbiorców, w granicach dziennego limitu skrzynki.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const tryb = String(body.tryb ?? "");
  const supabase = await createClient();

  const k = await wczytajKampanie(supabase, id);
  if (!k) return NextResponse.json({ blad: "Nie znaleziono kampanii albo brak dostępu." }, { status: 404 });

  if (tryb === "odbiorcy") {
    // Zawężenie (Sejm: komisje i kluby). Zapisujemy je w kampanii, żeby było widać, do kogo idzie wysyłka.
    const filtr: Filtr = {
      komisje: Array.isArray(body.filtr?.komisje) ? body.filtr.komisje.map(String) : [],
      kluby: Array.isArray(body.filtr?.kluby) ? body.filtr.kluby.map(String) : [],
    };
    await supabase.from("kampanie").update({ filtr_odbiorcow: filtr }).eq("id", id);

    const zrodla = ((k.zrodla as string[]) ?? []).filter((z) => POBIERACZE[z]);
    let dodane = 0;
    for (const z of zrodla) {
      let kontakty;
      let wKomisjach: Set<string> | null = null;
      try {
        kontakty = await POBIERACZE[z]();
        if (z === "sejm") wKomisjach = await poslowieKomisji(filtr.komisje ?? []);
      } catch {
        return NextResponse.json({ blad: `Źródło ${z} chwilowo nie odpowiada. Spróbuj za chwilę.` }, { status: 502 });
      }
      if (z === "sejm") {
        kontakty = kontakty.filter(
          (c) => (!wKomisjach || wKomisjach.has(c.zewnetrzneId)) && (!filtr.kluby?.length || filtr.kluby.includes(c.organizacja)),
        );
        // Zmiana zawężenia: usuwamy posłów spoza nowego zakresu, o ile nic jeszcze do nich nie wysłaliśmy.
        const dozwolone = new Set(kontakty.map((c) => c.zewnetrzneId));
        const { data: obecni } = await supabase.from("kontakty").select("id, zewnetrzne_id").eq("kampania_id", id).eq("zrodlo", "sejm");
        const { data: zWiadomoscia } = await supabase.from("wiadomosci").select("kontakt_id").eq("kampania_id", id);
        const chronieni = new Set((zWiadomoscia ?? []).map((w) => w.kontakt_id));
        const doUsuniecia = (obecni ?? []).filter((o) => !dozwolone.has(o.zewnetrzne_id ?? "") && !chronieni.has(o.id)).map((o) => o.id);
        if (doUsuniecia.length) await supabase.from("kontakty").delete().in("id", doUsuniecia);
      }
      const wiersze = kontakty
        .filter((c) => c.email)
        .map((c) => ({
          kampania_id: id,
          zrodlo: z,
          zewnetrzne_id: c.zewnetrzneId,
          imie: c.imie,
          nazwisko: c.nazwisko,
          email: c.email!.trim().toLowerCase(),
          organizacja: c.organizacja,
          stanowisko: c.stanowisko,
        }));
      if (wiersze.length === 0) continue;
      const { error, count } = await supabase
        .from("kontakty")
        .upsert(wiersze, { onConflict: "kampania_id,email", ignoreDuplicates: true, count: "exact" });
      if (error) return NextResponse.json({ blad: "Nie udało się zapisać odbiorców." }, { status: 500 });
      dodane += count ?? 0;
    }
    return NextResponse.json({ ...(await stan(supabase, id, k.skrzynka_id)), ok: true, dodane, filtr });
  }

  if (tryb !== "test" && tryb !== "partia") return NextResponse.json({ blad: "Nieznany tryb." }, { status: 400 });

  if (!k.skrzynka_id) return NextResponse.json({ blad: "Kampania nie ma skrzynki nadawcy. Wybierz ją niżej, w sekcji Skrzynka." }, { status: 400 });
  const { data: s } = await supabase
    .from("skrzynki")
    .select("id, nazwa, email_nadawcy, smtp_host, smtp_port, smtp_uzytkownik, dzienny_limit")
    .eq("id", k.skrzynka_id)
    .maybeSingle();
  if (!s) return NextResponse.json({ blad: "Nie znaleziono skrzynki kampanii." }, { status: 404 });

  const { data: sekret, error: bladSekretu } = await supabase.rpc("pobierz_sekret_skrzynki", { p_skrzynka: s.id });
  if (bladSekretu || !sekret) return NextResponse.json({ blad: "Brak zapisanego hasła skrzynki. Podłącz ją ponownie." }, { status: 400 });

  const { data: zatwierdzone } = await supabase
    .from("warianty")
    .select("id, numer, temat, tresc")
    .eq("kampania_id", id)
    .eq("krok", 0)
    .eq("status", "zatwierdzony")
    .order("numer");
  if (!zatwierdzone || zatwierdzone.length === 0)
    return NextResponse.json({ blad: "Brak zatwierdzonych wiadomości. Zatwierdź co najmniej jeden wariant pierwszej wiadomości." }, { status: 400 });

  const poczta = transport({ host: s.smtp_host, port: s.smtp_port, uzytkownik: s.smtp_uzytkownik, haslo: odszyfruj(sekret as string) });
  const od = { name: s.nazwa, address: s.email_nadawcy };

  if (tryb === "test") {
    const doKogo = String(body.do ?? "").trim() || s.email_nadawcy;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(doKogo)) return NextResponse.json({ blad: "Podaj poprawny adres odbiorcy testu." }, { status: 400 });
    try {
      for (const w of zatwierdzone) {
        await poczta.sendMail({ from: od, to: doKogo, subject: `[TEST ${w.numer}] ${w.temat}`, text: w.tresc });
      }
    } catch (e) {
      return NextResponse.json({ blad: opiszBladSmtp(e) }, { status: 400 });
    }
    return NextResponse.json({ ok: true, do: doKogo, wyslane: zatwierdzone.length });
  }

  // Partia: tylu, ilu pozwala dzienny limit skrzynki, maks. MAKS_PARTIA na kliknięcie.
  const dzis = await wyslaneDzisZeSkrzynki(supabase, s.id);
  const prosba = Math.min(Math.max(Number(body.ile) || 10, 1), MAKS_PARTIA);
  const ile = Math.min(prosba, s.dzienny_limit - dzis);
  if (ile <= 0) return NextResponse.json({ blad: `Dzienny limit skrzynki wyczerpany (${s.dzienny_limit}). Kolejna partia jutro.` }, { status: 429 });

  // Kontakty, które nie dostały jeszcze pierwszej wiadomości.
  const { data: juz } = await supabase.from("wiadomosci").select("kontakt_id").eq("kampania_id", id).eq("krok", 0);
  const pominac = new Set((juz ?? []).map((w) => w.kontakt_id));
  const { data: kontakty } = await supabase
    .from("kontakty")
    .select("id, email")
    .eq("kampania_id", id)
    .eq("wypisany", false)
    .not("email", "is", null)
    .order("utworzony")
    .limit(pominac.size + ile);
  const kolejka = (kontakty ?? []).filter((c) => !pominac.has(c.id)).slice(0, ile);
  if (kolejka.length === 0) return NextResponse.json({ blad: "Wszyscy odbiorcy dostali już pierwszą wiadomość." }, { status: 400 });

  let wyslane = 0;
  const bledy: string[] = [];
  for (const [i, c] of kolejka.entries()) {
    // Warianty po kolei: każdy odbiorca dostaje inny tekst, co zmniejsza ryzyko filtra antyspamowego.
    const w = zatwierdzone[(pominac.size + i) % zatwierdzone.length];
    const { data: wiersz, error } = await supabase
      .from("wiadomosci")
      .insert({ kampania_id: id, kontakt_id: c.id, krok: 0, wariant: w.numer, temat: w.temat, tresc: w.tresc, status: "zaplanowana", zaplanowana_na: new Date().toISOString() })
      .select("id")
      .single();
    if (error || !wiersz) continue; // już w kolejce (np. drugie kliknięcie naraz), pomijamy
    try {
      const info = await poczta.sendMail({ from: od, to: c.email!, subject: w.temat, text: zLinkamiSledzacymi(w.tresc, req.nextUrl.origin, wiersz.id) });
      await supabase.from("wiadomosci").update({ status: "wyslana", wyslana: new Date().toISOString(), message_id: info.messageId }).eq("id", wiersz.id);
      wyslane++;
    } catch (e) {
      const opis = opiszBladSmtp(e);
      await supabase.from("wiadomosci").update({ status: "blad", blad: opis }).eq("id", wiersz.id);
      bledy.push(opis);
      // Odrzucony login albo brak serwera: nie ma sensu próbować dalej.
      if (/login|hasło|serwera/i.test(opis)) break;
    }
    if (i < kolejka.length - 1) await czekaj(PRZERWA_MS);
  }

  if (wyslane > 0 && k.status !== "uruchomiona") await supabase.from("kampanie").update({ status: "uruchomiona" }).eq("id", id);

  return NextResponse.json({ ...(await stan(supabase, id, s.id)), ok: true, wyslanoTeraz: wyslane, bledyTeraz: bledy.slice(0, 3) });
}
