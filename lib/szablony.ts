import type { Kampania } from "@/lib/types";
import type { Tlumacz } from "@/lib/i18n";

/**
 * Szablony kampanii (samoobsługa, 07.10): zamiast pustego formularza klient dostaje szkielet celu
 * i sensowne ustawienia wysyłki. Nawiasy kwadratowe to miejsca do uzupełnienia.
 * Nazwa, opis i szkielet celu są w słowniku (lib/i18n), bo to tekst, który użytkownik czyta i edytuje.
 */
export const SZABLONY: {
  id: "petycja" | "zaproszenie" | "stanowisko" | "interwencja" | "akcja";
  dane: Partial<Omit<Kampania, "id" | "utworzona" | "cel">>;
}[] = [
  { id: "petycja", dane: { zrodla: ["sejm"], liczbaWariantow: 5, liczbaFollowupow: 2, odstepDni: 5 } },
  { id: "zaproszenie", dane: { zrodla: ["sejm"], liczbaWariantow: 4, liczbaFollowupow: 1, odstepDni: 4 } },
  { id: "stanowisko", dane: { zrodla: ["sejm"], liczbaWariantow: 5, liczbaFollowupow: 2, odstepDni: 3 } },
  { id: "interwencja", dane: { zrodla: ["samorzady", "sejm"], liczbaWariantow: 4, liczbaFollowupow: 2, odstepDni: 5 } },
  { id: "akcja", dane: { zrodla: ["sejm"], liczbaWariantow: 3, liczbaFollowupow: 1, odstepDni: 7 } },
];

export type SzablonId = (typeof SZABLONY)[number]["id"];

/** Dane szablonu w języku użytkownika (cel ze słownika). */
export function daneSzablonu(id: SzablonId, t: Tlumacz): Partial<Omit<Kampania, "id" | "utworzona">> | null {
  const s = SZABLONY.find((x) => x.id === id);
  return s ? { ...s.dane, cel: t(`szablon.${id}.cel`) } : null;
}
