"use client";

import { createClient } from "./supabase/client";
import type { Kampania, StatusKampanii, ZrodloId } from "./types";
import type { WierszListy } from "./csv";

/**
 * Warstwa danych, celowo za jednym interfejsem. Od 28.09 siedzi na Supabase.
 * Dostępu pilnują reguły RLS w bazie: dane widzą tylko osoby z tabeli `zespol`.
 * Kolumny w bazie są w snake_case, w aplikacji camelCase. Tłumaczenie tylko tutaj.
 */

type Wiersz = {
  id: string;
  nazwa: string;
  status: StatusKampanii;
  utworzona: string;
  zrodla: ZrodloId[];
  kogo_szukamy: string;
  cel: string;
  nadawca: string;
  psychografia: boolean;
  liczba_wariantow: number;
  link_film: string;
  materialy: string;
  liczba_followupow: number;
  odstep_dni: number;
  start: string | null;
  skrzynka_id: string | null;
  akcja_wlaczona: boolean;
  akcja_slug: string | null;
  akcja_tytul: string;
  akcja_opis: string;
  akcja_administrator: string;
  filtr_odbiorcow: Kampania["filtrOdbiorcow"];
};

// Jeden literał, bo klient Supabase wyprowadza typ wyniku z treści tego napisu.
const KOLUMNY =
  "id, nazwa, status, utworzona, zrodla, kogo_szukamy, cel, nadawca, psychografia, liczba_wariantow, link_film, materialy, liczba_followupow, odstep_dni, start, skrzynka_id, akcja_wlaczona, akcja_slug, akcja_tytul, akcja_opis, akcja_administrator, filtr_odbiorcow";

function zWiersza(w: Wiersz): Kampania {
  return {
    id: w.id,
    nazwa: w.nazwa,
    status: w.status,
    utworzona: w.utworzona,
    zrodla: w.zrodla,
    kogoSzukamy: w.kogo_szukamy,
    cel: w.cel,
    nadawca: w.nadawca,
    psychografia: w.psychografia,
    liczbaWariantow: w.liczba_wariantow,
    linkFilm: w.link_film,
    materialy: w.materialy,
    liczbaFollowupow: w.liczba_followupow,
    odstepDni: w.odstep_dni,
    start: w.start,
    skrzynkaId: w.skrzynka_id,
    akcjaWlaczona: w.akcja_wlaczona,
    akcjaSlug: w.akcja_slug,
    akcjaTytul: w.akcja_tytul,
    akcjaOpis: w.akcja_opis,
    akcjaAdministrator: w.akcja_administrator,
    filtrOdbiorcow: w.filtr_odbiorcow ?? {},
  };
}

function doWiersza(k: Partial<Kampania>): Partial<Wiersz> {
  const w: Partial<Wiersz> = {};
  if (k.nazwa !== undefined) w.nazwa = k.nazwa;
  if (k.status !== undefined) w.status = k.status;
  if (k.zrodla !== undefined) w.zrodla = k.zrodla;
  if (k.kogoSzukamy !== undefined) w.kogo_szukamy = k.kogoSzukamy;
  if (k.cel !== undefined) w.cel = k.cel;
  if (k.nadawca !== undefined) w.nadawca = k.nadawca;
  if (k.psychografia !== undefined) w.psychografia = k.psychografia;
  if (k.liczbaWariantow !== undefined) w.liczba_wariantow = k.liczbaWariantow;
  if (k.linkFilm !== undefined) w.link_film = k.linkFilm;
  if (k.materialy !== undefined) w.materialy = k.materialy;
  if (k.liczbaFollowupow !== undefined) w.liczba_followupow = k.liczbaFollowupow;
  if (k.odstepDni !== undefined) w.odstep_dni = k.odstepDni;
  if (k.start !== undefined) w.start = k.start;
  if (k.skrzynkaId !== undefined) w.skrzynka_id = k.skrzynkaId;
  if (k.akcjaWlaczona !== undefined) w.akcja_wlaczona = k.akcjaWlaczona;
  if (k.akcjaSlug !== undefined) w.akcja_slug = k.akcjaSlug;
  if (k.akcjaTytul !== undefined) w.akcja_tytul = k.akcjaTytul;
  if (k.akcjaOpis !== undefined) w.akcja_opis = k.akcjaOpis;
  if (k.akcjaAdministrator !== undefined) w.akcja_administrator = k.akcjaAdministrator;
  if (k.filtrOdbiorcow !== undefined) w.filtr_odbiorcow = k.filtrOdbiorcow;
  return w;
}

export async function wszystkieKampanie(): Promise<Kampania[]> {
  const { data, error } = await createClient()
    .from("kampanie")
    .select(KOLUMNY)
    .order("utworzona", { ascending: false });
  if (error) throw error;
  return (data as Wiersz[]).map(zWiersza);
}

export async function kampania(id: string): Promise<Kampania | undefined> {
  const { data, error } = await createClient()
    .from("kampanie")
    .select(KOLUMNY)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? zWiersza(data as Wiersz) : undefined;
}

export async function dodajKampanie(dane: Omit<Kampania, "id" | "utworzona">): Promise<Kampania> {
  const { data, error } = await createClient()
    .from("kampanie")
    .insert(doWiersza(dane))
    .select(KOLUMNY)
    .single();
  if (error) throw error;
  return zWiersza(data as Wiersz);
}

export async function zmienKampanie(
  id: string,
  zmiany: Partial<Kampania>,
): Promise<Kampania | undefined> {
  const { data, error } = await createClient()
    .from("kampanie")
    .update(doWiersza(zmiany))
    .eq("id", id)
    .select(KOLUMNY)
    .maybeSingle();
  if (error) throw error;
  return data ? zWiersza(data as Wiersz) : undefined;
}

/** Zapisuje kontakty z własnej listy. Duplikaty e-maili w kampanii pomija baza (unique). */
export async function dodajKontakty(kampaniaId: string, wiersze: WierszListy[]) {
  if (wiersze.length === 0) return;
  const { error } = await createClient()
    .from("kontakty")
    .upsert(
      wiersze.map((w) => ({
        kampania_id: kampaniaId,
        zrodlo: "wlasna_lista",
        imie: w.imie,
        nazwisko: w.nazwisko,
        email: w.email,
        organizacja: w.organizacja,
        stanowisko: w.stanowisko,
      })),
      { onConflict: "kampania_id,email", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function liczbaKontaktow(kampaniaId: string): Promise<number> {
  const { count, error } = await createClient()
    .from("kontakty")
    .select("id", { count: "exact", head: true })
    .eq("kampania_id", kampaniaId);
  if (error) throw error;
  return count ?? 0;
}

export async function usunKampanie(id: string) {
  const { error } = await createClient().from("kampanie").delete().eq("id", id);
  if (error) throw error;
}

export type Wariant = {
  id: string;
  krok: number;
  numer: number;
  temat: string;
  tresc: string;
  status: "szkic" | "zatwierdzony" | "odrzucony";
  /** nadawca = wiadomości kampanii, sympatyk = wiadomości dla strony akcji (pisane jak od mieszkańca). */
  rola: RolaWariantu;
};

export type RolaWariantu = "nadawca" | "sympatyk";

/** Warianty wiadomości kampanii: krok 0 = pierwsza wiadomość, 1..n = przypomnienia. */
export async function warianty(kampaniaId: string, rola: RolaWariantu = "nadawca"): Promise<Wariant[]> {
  const { data, error } = await createClient()
    .from("warianty")
    .select("id, krok, numer, temat, tresc, status, rola")
    .eq("kampania_id", kampaniaId)
    .eq("rola", rola)
    .order("krok")
    .order("numer");
  if (error) throw error;
  return data as Wariant[];
}

export async function zmienWariant(id: string, zmiany: Partial<Pick<Wariant, "temat" | "tresc" | "status">>) {
  const { error } = await createClient()
    .from("warianty")
    .update({ ...zmiany, zmieniony: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function psychografiaKampanii(kampaniaId: string): Promise<{ opis: string | null; jezyk: string | null }> {
  const { data, error } = await createClient()
    .from("kampanie")
    .select("psychografia_opis, jezyk")
    .eq("id", kampaniaId)
    .maybeSingle();
  if (error) throw error;
  return { opis: data?.psychografia_opis ?? null, jezyk: data?.jezyk ?? null };
}

export type Podpis = {
  id: string;
  imie: string;
  nazwisko: string;
  gminaNazwa: string | null;
  okregNr: number | null;
  odbiorcaNazwa: string | null;
  otworzylPoczte: string | null;
  udostepnil: string | null;
  utworzony: string;
};

/** Podpisy ze strony akcji (zespół czyta, zapisuje serwer). Najnowsze pierwsze. */
export async function podpisyKampanii(
  kampaniaId: string,
  limit = 50,
): Promise<{ lista: Podpis[]; razem: number; otworzyli: number; udostepnili: number; zrodla: { nazwa: string; ile: number }[] }> {
  const supabase = createClient();
  const [{ data, error }, { count: razem }, { count: otworzyli }, { count: udostepnili }, { data: zrodlaSurowe }] = await Promise.all([
    supabase
      .from("podpisy")
      .select("id, imie, nazwisko, gmina_nazwa, okreg_nr, odbiorca_nazwa, otworzyl_poczte, udostepnil, utworzony")
      .eq("kampania_id", kampaniaId)
      .order("utworzony", { ascending: false })
      .limit(limit),
    supabase.from("podpisy").select("id", { count: "exact", head: true }).eq("kampania_id", kampaniaId),
    supabase.from("podpisy").select("id", { count: "exact", head: true }).eq("kampania_id", kampaniaId).not("otworzyl_poczte", "is", null),
    supabase.from("podpisy").select("id", { count: "exact", head: true }).eq("kampania_id", kampaniaId).not("udostepnil", "is", null),
    supabase.from("podpisy").select("zrodlo").eq("kampania_id", kampaniaId),
  ]);
  if (error) throw error;
  // Źródło wejścia: utm_source, w drugiej kolejności domena odsyłacza, reszta "bezpośrednio / nieznane".
  const licz = new Map<string, number>();
  for (const w of zrodlaSurowe ?? []) {
    const z = (w.zrodlo ?? {}) as Record<string, string>;
    const nazwa = z.utm_source ? `${z.utm_source}${z.utm_medium ? ` / ${z.utm_medium}` : ""}` : z.ref || "bezpośrednio / nieznane";
    licz.set(nazwa, (licz.get(nazwa) ?? 0) + 1);
  }
  const zrodla = [...licz.entries()].map(([nazwa, ile]) => ({ nazwa, ile })).sort((a, b) => b.ile - a.ile);
  return {
    zrodla,
    lista: (data ?? []).map((p) => ({
      id: p.id,
      imie: p.imie,
      nazwisko: p.nazwisko,
      gminaNazwa: p.gmina_nazwa,
      okregNr: p.okreg_nr,
      odbiorcaNazwa: p.odbiorca_nazwa,
      otworzylPoczte: p.otworzyl_poczte,
      udostepnil: p.udostepnil,
      utworzony: p.utworzony,
    })),
    razem: razem ?? 0,
    otworzyli: otworzyli ?? 0,
    udostepnili: udostepnili ?? 0,
  };
}

export const TYPY_WYDARZEN = {
  odpowiedz: "Odpowiedź",
  spotkanie: "Spotkanie",
  interpelacja: "Interpelacja albo pytanie",
  zmiana_decyzji: "Zmiana decyzji",
  media: "Media",
  inne: "Inne",
} as const;
export type TypWydarzenia = keyof typeof TYPY_WYDARZEN;

export type Wydarzenie = {
  id: string;
  data: string;
  typ: TypWydarzenia;
  opis: string;
  kontaktId: string | null;
};

/** Raport wpływu: wydarzenia dopisywane ręcznie (odpowiedzi przychodzą do skrzynki nadawcy, spotkania dzieją się poza aplikacją). */
export async function wydarzenia(kampaniaId: string): Promise<Wydarzenie[]> {
  const { data, error } = await createClient()
    .from("wydarzenia_wplywu")
    .select("id, data, typ, opis, kontakt_id")
    .eq("kampania_id", kampaniaId)
    .order("data", { ascending: false })
    .order("utworzone", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((w) => ({ id: w.id, data: w.data, typ: w.typ as TypWydarzenia, opis: w.opis, kontaktId: w.kontakt_id }));
}

export async function dodajWydarzenie(kampaniaId: string, w: { data: string; typ: TypWydarzenia; opis: string; kontaktId?: string | null }) {
  const { error } = await createClient()
    .from("wydarzenia_wplywu")
    .insert({ kampania_id: kampaniaId, data: w.data, typ: w.typ, opis: w.opis, kontakt_id: w.kontaktId ?? null });
  if (error) throw error;
}

export async function usunWydarzenie(id: string) {
  const { error } = await createClient().from("wydarzenia_wplywu").delete().eq("id", id);
  if (error) throw error;
}
