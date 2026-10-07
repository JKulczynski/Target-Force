import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FiltrOdbiorcow as Filtr } from "@/lib/types";
import { odszyfruj } from "@/lib/szyfr";
import { opiszBladSmtp, transport } from "@/lib/smtp";
import { przygotujOdbiorcow } from "@/lib/odbiorcy-serwer";
import { personalizuj, POLA_TESTOWE } from "@/lib/personalizacja";
import {
  gotowiDoPrzypomnienia,
  MAKS_PARTIA,
  wyslaneDzisZeSkrzynki,
  wyslijKolejke,
  limitDzisSkrzynki,
} from "@/lib/wysylka-serwer";

export const runtime = "nodejs";
export const maxDuration = 300;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function stan(
  supabase: Supabase,
  kampaniaId: string,
  skrzynkaId: string | null,
) {
  // Liczniki w jednym zapytaniu (funkcja stan_kampanii, migracja 20261007130000).
  const { data: liczby } = await supabase.rpc("stan_kampanii", {
    p_kampania: kampaniaId,
  });
  const l = (liczby ?? {}) as Record<string, number>;
  const odbiorcy = l.odbiorcy ?? 0;
  const wyslane = l.wyslane ?? 0;
  const bledy = l.bledy ?? 0;

  let limit = 0;
  let rozgrzewka = false;
  let dzis = 0;
  if (skrzynkaId) {
    const { data: s } = await supabase
      .from("skrzynki")
      .select("dzienny_limit")
      .eq("id", skrzynkaId)
      .maybeSingle();
    const l = await limitDzisSkrzynki(
      supabase,
      skrzynkaId,
      s?.dzienny_limit ?? 0,
    );
    limit = l.limit;
    rozgrzewka = l.rozgrzewka;
    dzis = await wyslaneDzisZeSkrzynki(supabase, skrzynkaId);
  }
  const doWyslania = Math.max(odbiorcy - wyslane - bledy, 0);
  const doPrzypomnienia = (await gotowiDoPrzypomnienia(supabase, kampaniaId))
    .length;
  return {
    rozgrzewka,
    wariantow: l.wariantow ?? 0,
    zatwierdzonePierwsze: l.zatwierdzonePierwsze ?? 0,
    odbiorcy,
    wyslane,
    bledy,
    doWyslania,
    limit,
    dzis,
    zostaloDzis: Math.max(limit - dzis, 0),
    kliknieci: l.kliknieci ?? 0,
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
    const wynik = await przygotujOdbiorcow(supabase, id, k.zrodla as string[], body.filtr);
    if ("blad" in wynik)
      return NextResponse.json({ blad: wynik.blad }, { status: wynik.status });
    return NextResponse.json({
      ...(await stan(supabase, id, k.skrzynka_id)),
      ok: true,
      dodane: wynik.dodane,
      filtr: wynik.filtr,
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
