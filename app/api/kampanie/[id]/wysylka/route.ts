import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { odszyfruj } from "@/lib/szyfr";
import { opiszBladSmtp, transport } from "@/lib/smtp";
import { POBIERACZE } from "@/lib/zrodla-serwer";
import { personalizuj, POLA_TESTOWE } from "@/lib/personalizacja";
import {
  gotowiDoPrzypomnienia,
  MAKS_PARTIA,
  wyslaneDzisZeSkrzynki,
  wyslijKolejke,
} from "@/lib/wysylka-serwer";

export const runtime = "nodejs";
export const maxDuration = 300;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function stan(
  supabase: Supabase,
  kampaniaId: string,
  skrzynkaId: string | null,
) {
  const pierwsze = (status: string) =>
    supabase
      .from("wiadomosci")
      .select("id", { count: "exact", head: true })
      .eq("kampania_id", kampaniaId)
      .eq("krok", 0)
      .eq("status", status);
  const [{ count: odbiorcy }, { count: wyslaneN }, { count: bledyN }] =
    await Promise.all([
      supabase
        .from("kontakty")
        .select("id", { count: "exact", head: true })
        .eq("kampania_id", kampaniaId)
        .eq("wypisany", false)
        .not("email", "is", null),
      pierwsze("wyslana"),
      pierwsze("blad"),
    ]);
  const wyslane = wyslaneN ?? 0;
  const bledy = bledyN ?? 0;

  let limit = 0;
  let dzis = 0;
  if (skrzynkaId) {
    const { data: s } = await supabase
      .from("skrzynki")
      .select("dzienny_limit")
      .eq("id", skrzynkaId)
      .maybeSingle();
    limit = s?.dzienny_limit ?? 0;
    dzis = await wyslaneDzisZeSkrzynki(supabase, skrzynkaId);
  }
  const doWyslania = Math.max((odbiorcy ?? 0) - wyslane - bledy, 0);

  // Ile osób kliknęło link (unikalne wiadomości z co najmniej jednym kliknięciem).
  const { data: wysylkaIds } = await supabase
    .from("wiadomosci")
    .select("id")
    .eq("kampania_id", kampaniaId)
    .eq("status", "wyslana");
  let kliknieci = 0;
  if (wysylkaIds && wysylkaIds.length > 0) {
    const { data: klik } = await supabase
      .from("zdarzenia")
      .select("wiadomosc_id")
      .eq("typ", "klikniecie")
      .in(
        "wiadomosc_id",
        wysylkaIds.map((w) => w.id),
      );
    kliknieci = new Set((klik ?? []).map((z) => z.wiadomosc_id)).size;
  }
  const doPrzypomnienia = (await gotowiDoPrzypomnienia(supabase, kampaniaId))
    .length;
  const { data: war } = await supabase
    .from("warianty")
    .select("krok, status")
    .eq("kampania_id", kampaniaId);
  const wariantow = (war ?? []).filter((w) => w.status !== "odrzucony").length;
  const zatwierdzonePierwsze = (war ?? []).filter(
    (w) => w.krok === 0 && w.status === "zatwierdzony",
  ).length;
  return {
    wariantow,
    zatwierdzonePierwsze,
    odbiorcy: odbiorcy ?? 0,
    wyslane,
    bledy,
    doWyslania,
    limit,
    dzis,
    zostaloDzis: Math.max(limit - dzis, 0),
    kliknieci,
    doPrzypomnienia,
  };
}

async function wczytajKampanie(supabase: Supabase, id: string) {
  const { data } = await supabase
    .from("kampanie")
    .select(
      "id, status, zrodla, skrzynka_id, filtr_odbiorcow, auto_wysylka, start",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

type Filtr = { komisje?: string[]; kluby?: string[] };

/** ID posłów z wybranych komisji Sejmu (puste = bez zawężenia po komisjach). */
async function poslowieKomisji(kody: string[]): Promise<Set<string> | null> {
  if (kody.length === 0) return null;
  const odp = await fetch("https://api.sejm.gov.pl/sejm/term10/committees", {
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!odp.ok) throw new Error("komisje");
  const komisje = (await odp.json()) as {
    code: string;
    members?: { id: number }[];
  }[];
  return new Set(
    komisje
      .filter((k) => kody.includes(k.code))
      .flatMap((k) => (k.members ?? []).map((m) => String(m.id))),
  );
}

/** Stan wysyłki: odbiorcy, wysłane, błędy, dzienny limit skrzynki. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const k = await wczytajKampanie(supabase, id);
  if (!k)
    return NextResponse.json(
      { blad: "Nie znaleziono kampanii albo brak dostępu." },
      { status: 404 },
    );
  return NextResponse.json({
    ...(await stan(supabase, id, k.skrzynka_id)),
    filtr: (k.filtr_odbiorcow as Filtr) ?? {},
    auto: !!k.auto_wysylka,
    start: k.start,
  });
}

/**
 * Tryby:
 * - "odbiorcy": pobiera kontakty z e-mailem ze źródeł kampanii (Sejm, Tweede Kamer) do bazy, żeby było wiadomo, do kogo idzie wysyłka.
 * - "test": wysyła zatwierdzone warianty pierwszej wiadomości na podany adres (własny), z dopiskiem [TEST]. Nie liczy się do kampanii.
 * - "partia": wysyła pierwszą wiadomość do kolejnych odbiorców, w granicach dziennego limitu skrzynki.
 * - "przypomnienia": kolejne przypomnienie (w tym samym wątku) do tych, którzy nie odpisali po ustawionej liczbie dni.
 * - "auto": włącza/wyłącza codzienną automatyczną wysyłkę (opcjonalnie z dniem startu).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const tryb = String(body.tryb ?? "");
  const supabase = await createClient();

  const k = await wczytajKampanie(supabase, id);
  if (!k)
    return NextResponse.json(
      { blad: "Nie znaleziono kampanii albo brak dostępu." },
      { status: 404 },
    );

  if (tryb === "odbiorcy") {
    // Zawężenie (Sejm: komisje i kluby). Zapisujemy je w kampanii, żeby było widać, do kogo idzie wysyłka.
    const filtr: Filtr = {
      komisje: Array.isArray(body.filtr?.komisje)
        ? body.filtr.komisje.map(String)
        : [],
      kluby: Array.isArray(body.filtr?.kluby)
        ? body.filtr.kluby.map(String)
        : [],
    };
    await supabase
      .from("kampanie")
      .update({ filtr_odbiorcow: filtr })
      .eq("id", id);

    const zrodla = ((k.zrodla as string[]) ?? []).filter((z) => POBIERACZE[z]);
    let dodane = 0;
    for (const z of zrodla) {
      let kontakty;
      let wKomisjach: Set<string> | null = null;
      try {
        kontakty = await POBIERACZE[z](supabase);
        if (z === "sejm")
          wKomisjach = await poslowieKomisji(filtr.komisje ?? []);
      } catch {
        return NextResponse.json(
          { blad: `Źródło ${z} chwilowo nie odpowiada. Spróbuj za chwilę.` },
          { status: 502 },
        );
      }
      if (z === "sejm") {
        kontakty = kontakty.filter(
          (c) =>
            (!wKomisjach || wKomisjach.has(c.zewnetrzneId)) &&
            (!filtr.kluby?.length || filtr.kluby.includes(c.organizacja)),
        );
        // Zmiana zawężenia: usuwamy posłów spoza nowego zakresu, o ile nic jeszcze do nich nie wysłaliśmy.
        const dozwolone = new Set(kontakty.map((c) => c.zewnetrzneId));
        const { data: obecni } = await supabase
          .from("kontakty")
          .select("id, zewnetrzne_id")
          .eq("kampania_id", id)
          .eq("zrodlo", "sejm");
        const { data: zWiadomoscia } = await supabase
          .from("wiadomosci")
          .select("kontakt_id")
          .eq("kampania_id", id);
        const chronieni = new Set(
          (zWiadomoscia ?? []).map((w) => w.kontakt_id),
        );
        const doUsuniecia = (obecni ?? [])
          .filter(
            (o) =>
              !dozwolone.has(o.zewnetrzne_id ?? "") && !chronieni.has(o.id),
          )
          .map((o) => o.id);
        if (doUsuniecia.length)
          await supabase.from("kontakty").delete().in("id", doUsuniecia);
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
          dane: c.dane ?? {},
        }));
      if (wiersze.length === 0) continue;
      const { count: przed } = await supabase
        .from("kontakty")
        .select("id", { count: "exact", head: true })
        .eq("kampania_id", id);
      // Bez ignoreDuplicates: odświeża dane istniejących osób (np. okręg do personalizacji).
      const { error } = await supabase
        .from("kontakty")
        .upsert(wiersze, { onConflict: "kampania_id,email" });
      if (error)
        return NextResponse.json(
          { blad: "Nie udało się zapisać odbiorców." },
          { status: 500 },
        );
      const { count: po } = await supabase
        .from("kontakty")
        .select("id", { count: "exact", head: true })
        .eq("kampania_id", id);
      dodane += Math.max((po ?? 0) - (przed ?? 0), 0);
    }
    return NextResponse.json({
      ...(await stan(supabase, id, k.skrzynka_id)),
      ok: true,
      dodane,
      filtr,
    });
  }

  if (tryb === "auto") {
    // Automat: codziennie w dni robocze rano kolejna partia w limicie skrzynki + przypomnienia (app/api/cron/wysylka).
    const wlacz = !!body.wlacz;
    const start =
      typeof body.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.start)
        ? body.start
        : null;
    if (wlacz && !k.skrzynka_id)
      return NextResponse.json(
        { blad: "Najpierw wybierz skrzynkę nadawcy." },
        { status: 400 },
      );
    const { error } = await supabase
      .from("kampanie")
      .update({ auto_wysylka: wlacz, ...(start ? { start } : {}) })
      .eq("id", id);
    if (error)
      return NextResponse.json(
        { blad: "Nie udało się zapisać ustawienia." },
        { status: 500 },
      );
    return NextResponse.json({
      ok: true,
      auto: wlacz,
      start: start ?? k.start,
    });
  }

  if (tryb !== "test" && tryb !== "partia" && tryb !== "przypomnienia")
    return NextResponse.json({ blad: "Nieznany tryb." }, { status: 400 });

  if (!k.skrzynka_id)
    return NextResponse.json(
      {
        blad: "Kampania nie ma skrzynki nadawcy. Wybierz ją niżej, w sekcji Skrzynka.",
      },
      { status: 400 },
    );
  const { data: s } = await supabase
    .from("skrzynki")
    .select(
      "id, nazwa, email_nadawcy, smtp_host, smtp_port, smtp_uzytkownik, dzienny_limit",
    )
    .eq("id", k.skrzynka_id)
    .maybeSingle();
  if (!s)
    return NextResponse.json(
      { blad: "Nie znaleziono skrzynki kampanii." },
      { status: 404 },
    );

  const { data: sekret, error: bladSekretu } = await supabase.rpc(
    "pobierz_sekret_skrzynki",
    { p_skrzynka: s.id },
  );
  if (bladSekretu || !sekret)
    return NextResponse.json(
      { blad: "Brak zapisanego hasła skrzynki. Podłącz ją ponownie." },
      { status: 400 },
    );

  const { data: wszystkieZatw } = await supabase
    .from("warianty")
    .select("id, krok, numer, temat, tresc")
    .eq("kampania_id", id)
    .eq("status", "zatwierdzony")
    .order("krok")
    .order("numer");
  const zatwierdzone = (wszystkieZatw ?? []).filter((w) => w.krok === 0);
  if (tryb !== "przypomnienia" && zatwierdzone.length === 0)
    return NextResponse.json(
      {
        blad: "Brak zatwierdzonych wiadomości. Zatwierdź co najmniej jeden wariant pierwszej wiadomości.",
      },
      { status: 400 },
    );

  if (tryb === "test") {
    const poczta = transport({
      host: s.smtp_host,
      port: s.smtp_port,
      uzytkownik: s.smtp_uzytkownik,
      haslo: odszyfruj(sekret as string),
    });
    const od = { name: s.nazwa, address: s.email_nadawcy };
    const doKogo = String(body.do ?? "").trim() || s.email_nadawcy;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(doKogo))
      return NextResponse.json(
        { blad: "Podaj poprawny adres odbiorcy testu." },
        { status: 400 },
      );
    // Test: wszystkie zatwierdzone teksty (pierwsza wiadomość i przypomnienia) z przykładowymi polami personalizacji.
    const doTestu = wszystkieZatw ?? [];
    try {
      for (const w of doTestu) {
        const etykieta =
          w.krok === 0 ? `TEST ${w.numer}` : `TEST przypomnienie ${w.krok}`;
        await poczta.sendMail({
          from: od,
          to: doKogo,
          subject: `[${etykieta}] ${personalizuj(w.temat, POLA_TESTOWE)}`,
          text: personalizuj(w.tresc, POLA_TESTOWE),
        });
      }
    } catch (e) {
      return NextResponse.json({ blad: opiszBladSmtp(e) }, { status: 400 });
    }
    return NextResponse.json({ ok: true, do: doKogo, wyslane: doTestu.length });
  }

  // Dzienny limit skrzynki, maks. MAKS_PARTIA na kliknięcie.
  const wynik = await wyslijKolejke(supabase, {
    kampaniaId: id,
    statusKampanii: k.status,
    tryb,
    ile: Math.min(Math.max(Number(body.ile) || 10, 1), MAKS_PARTIA),
    skrzynka: s,
    hasloZaszyfrowane: sekret as string,
    warianty: wszystkieZatw ?? [],
    baza: req.nextUrl.origin,
  });
  if (!wynik.ok)
    return NextResponse.json({ blad: wynik.blad }, { status: wynik.status });
  return NextResponse.json({
    ...(await stan(supabase, id, s.id)),
    ok: true,
    wyslanoTeraz: wynik.wyslane,
    bledyTeraz: wynik.bledy.slice(0, 3),
  });
}
