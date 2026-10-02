import type { SupabaseClient } from "@supabase/supabase-js";
import { odszyfruj } from "@/lib/szyfr";
import { opiszBladSmtp, transport } from "@/lib/smtp";
import { personalizuj, polaKontaktu } from "@/lib/personalizacja";

/**
 * Silnik wysyłki wspólny dla przycisku w aplikacji i automatu (cron w dni robocze rano).
 * Klient Supabase przychodzi z zewnątrz: przy przycisku to sesja użytkownika, w automacie klient serwisowy.
 */

/** Największa partia na jedno kliknięcie. Z przerwą między mailami mieści się w limicie czasu funkcji. */
export const MAKS_PARTIA = 25;
/** Przerwa między kolejnymi mailami. Wolniejsza wysyłka wygląda jak człowiek, nie jak masówka. */
const PRZERWA_MS = 3000;

const czekaj = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Każdy link w treści przechodzi przez /r/{wiadomość}, żeby policzyć kliknięcia (główna miara kampanii). */
function zLinkamiSledzacymi(tresc: string, baza: string, wiadomoscId: string) {
  return tresc.replace(
    /https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?]/g,
    (url) => `${baza}/r/${wiadomoscId}?u=${encodeURIComponent(url)}`,
  );
}

function poczatekDnia() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Ile maili ta skrzynka wysłała dziś, we wszystkich kampaniach (dzienny limit dotyczy skrzynki, nie kampanii). */
export async function wyslaneDzisZeSkrzynki(
  supabase: SupabaseClient,
  skrzynkaId: string,
) {
  const { data: kampanie } = await supabase
    .from("kampanie")
    .select("id")
    .eq("skrzynka_id", skrzynkaId);
  const ids = (kampanie ?? []).map((k) => k.id);
  if (ids.length === 0) return 0;
  const { count } = await supabase
    .from("wiadomosci")
    .select("id", { count: "exact", head: true })
    .in("kampania_id", ids)
    .gte("wyslana", poczatekDnia());
  return count ?? 0;
}

/**
 * Kto czeka na kolejne przypomnienie: ostatnia wysłana wiadomość starsza niż odstęp z kampanii,
 * osoba nie odpisała, nie wypisała się, a kampania przewiduje kolejny krok.
 */
export async function gotowiDoPrzypomnienia(
  supabase: SupabaseClient,
  kampaniaId: string,
) {
  const { data: k } = await supabase
    .from("kampanie")
    .select("odstep_dni, liczba_followupow")
    .eq("id", kampaniaId)
    .maybeSingle();
  if (!k || (k.liczba_followupow ?? 0) === 0) return [];
  const { data: wys } = await supabase
    .from("wiadomosci")
    .select("kontakt_id, krok, temat, wyslana, message_id, status")
    .eq("kampania_id", kampaniaId)
    .in("status", ["wyslana", "zaplanowana", "blad"]);
  const ostatnia = new Map<
    string,
    {
      krok: number;
      temat: string;
      wyslana: string | null;
      message_id: string | null;
      status: string;
    }
  >();
  for (const w of wys ?? []) {
    const o = ostatnia.get(w.kontakt_id);
    if (!o || w.krok > o.krok) ostatnia.set(w.kontakt_id, w);
  }
  const granica = Date.now() - (k.odstep_dni ?? 4) * 24 * 60 * 60 * 1000;
  const kandydaci = [...ostatnia.entries()].filter(
    ([, o]) =>
      o.status === "wyslana" &&
      o.wyslana &&
      new Date(o.wyslana).getTime() <= granica &&
      o.krok < (k.liczba_followupow ?? 0),
  );
  if (kandydaci.length === 0) return [];
  const { data: kontakty } = await supabase
    .from("kontakty")
    .select("id, email, imie, nazwisko, dane, odpowiedzial, wypisany")
    .in(
      "id",
      kandydaci.map(([kid]) => kid),
    );
  const mapa = new Map((kontakty ?? []).map((c) => [c.id, c]));
  return kandydaci.flatMap(([kid, o]) => {
    const c = mapa.get(kid);
    if (!c || c.odpowiedzial || c.wypisany || !c.email) return [];
    return [
      {
        kontakt: c,
        nastepnyKrok: o.krok + 1,
        poprzedniTemat: o.temat.replace(/^Re:\s*/i, ""),
        poprzednieMessageId: o.message_id,
      },
    ];
  });
}

export type Skrzynka = {
  id: string;
  nazwa: string;
  email_nadawcy: string;
  smtp_host: string;
  smtp_port: number;
  smtp_uzytkownik: string;
  dzienny_limit: number;
};
export type Wariant = {
  id: string;
  krok: number;
  numer: number;
  temat: string;
  tresc: string;
};

type Wynik =
  | { ok: true; wyslane: number; bledy: string[] }
  | { ok: false; blad: string; status: number };

/**
 * Wysyła pierwszą wiadomość do kolejnych odbiorców ("partia") albo kolejne przypomnienie ("przypomnienia"),
 * w granicach dziennego limitu skrzynki. `koniec` (ms) przerywa przed limitem czasu funkcji (automat).
 */
export async function wyslijKolejke(
  supabase: SupabaseClient,
  o: {
    kampaniaId: string;
    statusKampanii: string;
    tryb: "partia" | "przypomnienia";
    ile: number;
    skrzynka: Skrzynka;
    hasloZaszyfrowane: string;
    warianty: Wariant[];
    baza: string;
    koniec?: number;
  },
): Promise<Wynik> {
  const { kampaniaId: id, skrzynka: s, warianty } = o;
  const zatwierdzone = warianty.filter((w) => w.krok === 0);
  if (o.tryb === "partia" && zatwierdzone.length === 0)
    return {
      ok: false,
      blad: "Brak zatwierdzonych wiadomości. Zatwierdź co najmniej jeden wariant pierwszej wiadomości.",
      status: 400,
    };

  const dzis = await wyslaneDzisZeSkrzynki(supabase, s.id);
  const ile = Math.min(o.ile, s.dzienny_limit - dzis);
  if (ile <= 0)
    return {
      ok: false,
      blad: `Dzienny limit skrzynki wyczerpany (${s.dzienny_limit}). Kolejna partia jutro.`,
      status: 429,
    };

  type Kontakt = {
    id: string;
    email: string | null;
    imie: string | null;
    nazwisko: string | null;
    dane: unknown;
  };
  type Pozycja = {
    kontakt: Kontakt;
    krok: number;
    numer: number;
    temat: string;
    tresc: string;
    inReplyTo?: string | null;
  };
  let kolejka: Pozycja[] = [];

  if (o.tryb === "partia") {
    const { data: juz } = await supabase
      .from("wiadomosci")
      .select("kontakt_id")
      .eq("kampania_id", id)
      .eq("krok", 0);
    const pominac = new Set((juz ?? []).map((w) => w.kontakt_id));
    const { data: kontakty } = await supabase
      .from("kontakty")
      .select("id, email, imie, nazwisko, dane")
      .eq("kampania_id", id)
      .eq("wypisany", false)
      .not("email", "is", null)
      .order("utworzony")
      .limit(pominac.size + ile);
    kolejka = (kontakty ?? [])
      .filter((c) => !pominac.has(c.id))
      .slice(0, ile)
      .map((c, i) => {
        // Warianty po kolei: każdy odbiorca dostaje inny tekst, co zmniejsza ryzyko filtra antyspamowego.
        const w = zatwierdzone[(pominac.size + i) % zatwierdzone.length];
        return {
          kontakt: c,
          krok: 0,
          numer: w.numer,
          temat: w.temat,
          tresc: w.tresc,
        };
      });
    if (kolejka.length === 0)
      return {
        ok: false,
        blad: "Wszyscy odbiorcy dostali już pierwszą wiadomość.",
        status: 400,
      };
  } else {
    const gotowi = await gotowiDoPrzypomnienia(supabase, id);
    kolejka = gotowi.slice(0, ile).flatMap((g) => {
      const w = warianty.find((x) => x.krok === g.nastepnyKrok);
      // Przypomnienie w tym samym wątku: "Re: temat poprzedniego maila".
      return w
        ? [
            {
              kontakt: g.kontakt,
              krok: g.nastepnyKrok,
              numer: w.numer,
              temat: `Re: ${g.poprzedniTemat}`,
              tresc: w.tresc,
              inReplyTo: g.poprzednieMessageId,
            },
          ]
        : [];
    });
    if (kolejka.length === 0)
      return {
        ok: false,
        blad: "Nikt nie czeka na przypomnienie (za wcześnie, ktoś odpisał albo brak zatwierdzonego przypomnienia).",
        status: 400,
      };
  }

  const poczta = transport({
    host: s.smtp_host,
    port: s.smtp_port,
    uzytkownik: s.smtp_uzytkownik,
    haslo: odszyfruj(o.hasloZaszyfrowane),
  });
  const od = { name: s.nazwa, address: s.email_nadawcy };

  let wyslane = 0;
  const bledy: string[] = [];
  for (const [i, p] of kolejka.entries()) {
    if (o.koniec && Date.now() > o.koniec) break;
    const pola = polaKontaktu(p.kontakt);
    const temat = personalizuj(p.temat, pola);
    const tresc = personalizuj(p.tresc, pola);
    const { data: wiersz, error } = await supabase
      .from("wiadomosci")
      .insert({
        kampania_id: id,
        kontakt_id: p.kontakt.id,
        krok: p.krok,
        wariant: p.numer,
        temat,
        tresc,
        status: "zaplanowana",
        zaplanowana_na: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !wiersz) continue; // już w kolejce (np. drugie kliknięcie naraz), pomijamy
    try {
      const info = await poczta.sendMail({
        from: od,
        to: p.kontakt.email!,
        subject: temat,
        text: zLinkamiSledzacymi(tresc, o.baza, wiersz.id),
        ...(p.inReplyTo
          ? { inReplyTo: p.inReplyTo, references: [p.inReplyTo] }
          : {}),
      });
      await supabase
        .from("wiadomosci")
        .update({
          status: "wyslana",
          wyslana: new Date().toISOString(),
          message_id: info.messageId,
        })
        .eq("id", wiersz.id);
      wyslane++;
    } catch (e) {
      const opis = opiszBladSmtp(e);
      await supabase
        .from("wiadomosci")
        .update({ status: "blad", blad: opis })
        .eq("id", wiersz.id);
      bledy.push(opis);
      // Odrzucony login albo brak serwera: nie ma sensu próbować dalej.
      if (/login|hasło|serwera/i.test(opis)) break;
    }
    if (i < kolejka.length - 1) await czekaj(PRZERWA_MS);
  }

  if (wyslane > 0 && o.statusKampanii !== "uruchomiona")
    await supabase
      .from("kampanie")
      .update({ status: "uruchomiona" })
      .eq("id", id);
  return { ok: true, wyslane, bledy };
}
