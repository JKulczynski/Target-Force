"use client";

import type { Kampania } from "./types";

/**
 * Warstwa danych, celowo za jednym interfejsem.
 *
 * Dziś trzyma kampanie w przeglądarce, żeby dało się klikać przez cały przepływ
 * bez czekania na bazę. Gdy stanie projekt Supabase, podmieniamy TYLKO ten plik,
 * reszta aplikacji o tym nie wie.
 *
 * Ograniczenie, świadome: dane żyją w jednej przeglądarce i nie przechodzą między
 * urządzeniami. Do klikania wystarczy, do pracy z Piotrem nie.
 */

const KLUCZ = "targetforce.kampanie.v1";

function czytaj(): Kampania[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KLUCZ);
    return raw ? (JSON.parse(raw) as Kampania[]) : [];
  } catch {
    return [];
  }
}

function zapisz(kampanie: Kampania[]) {
  try {
    window.localStorage.setItem(KLUCZ, JSON.stringify(kampanie));
  } catch {
    // Tryb prywatny albo zablokowane dane witryny. Nie wywracamy aplikacji.
  }
}

export function wszystkieKampanie(): Kampania[] {
  return czytaj().sort((a, b) => b.utworzona.localeCompare(a.utworzona));
}

export function kampania(id: string): Kampania | undefined {
  return czytaj().find((k) => k.id === id);
}

export function dodajKampanie(dane: Omit<Kampania, "id" | "utworzona">): Kampania {
  const nowa: Kampania = {
    ...dane,
    id: crypto.randomUUID(),
    utworzona: new Date().toISOString(),
  };
  zapisz([...czytaj(), nowa]);
  return nowa;
}

export function zmienKampanie(id: string, zmiany: Partial<Kampania>): Kampania | undefined {
  const kampanie = czytaj();
  const i = kampanie.findIndex((k) => k.id === id);
  if (i === -1) return undefined;
  kampanie[i] = { ...kampanie[i], ...zmiany };
  zapisz(kampanie);
  return kampanie[i];
}

export function usunKampanie(id: string) {
  zapisz(czytaj().filter((k) => k.id !== id));
}
