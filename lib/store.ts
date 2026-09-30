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
};

// Jeden literał, bo klient Supabase wyprowadza typ wyniku z treści tego napisu.
const KOLUMNY =
  "id, nazwa, status, utworzona, zrodla, kogo_szukamy, cel, nadawca, psychografia, liczba_wariantow, link_film, materialy, liczba_followupow, odstep_dni, start, skrzynka_id";

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
