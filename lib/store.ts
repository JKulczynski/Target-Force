"use client";

import { createClient } from "./supabase/client";
import type { Kampania, StatusKampanii, ZrodloId } from "./types";

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
};

const KOLUMNY =
  "id, nazwa, status, utworzona, zrodla, kogo_szukamy, cel, nadawca, psychografia, liczba_wariantow";

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

export async function usunKampanie(id: string) {
  const { error } = await createClient().from("kampanie").delete().eq("id", id);
  if (error) throw error;
}
