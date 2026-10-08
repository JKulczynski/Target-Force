/**
 * Oświadczenie zleceniodawcy: kto zleca kampanię i z czego ją finansuje (punkt 1 Piotra, 07.10).
 * Treść oświadczeń jest wersjonowana: zmiana tekstu = podbij WERSJA, stare wiersze w bazie zachowują swoją.
 * Teksty a-e do potwierdzenia przez prawnika, nie przez nas.
 */
import { tlumacz, type Tlumacz } from "@/lib/i18n";

export const WERSJA_OSWIADCZENIA = 1;

export const FORMY_PRAWNE = [
  "fundacja",
  "stowarzyszenie",
  "spółka",
  "osoba fizyczna",
  "komitet",
  "inna",
] as const;

/** Klucze w bazie; etykieta w interfejsie: t(`zrodloFin.${klucz}`). Polski tekst to wartość odniesienia. */
export const ZRODLA_FINANSOWANIA = {
  wlasne: "Środki własne organizacji",
  darowizny: "Darowizny albo składki członków",
  grant: "Grant (podaj program)",
  publiczne: "Środki publiczne",
  komercyjny: "Zleceniodawca komercyjny (podaj kogo)",
  inne: "Inne (opisz)",
} as const;
export type ZrodloFinansowania = keyof typeof ZRODLA_FINANSOWANIA;

/** Źródła, przy których opis jest obowiązkowy. */
export const ZRODLA_Z_OPISEM: ZrodloFinansowania[] = ["grant", "komercyjny", "inne"];

/** Treści oświadczeń a-e (wersja WERSJA_OSWIADCZENIA). Interfejs pokazuje t(`osw.tekst.${klucz}`). */
export const OSWIADCZENIA = {
  prawdziwe:
    "Informacje w kampanii są prawdziwe i nie wprowadzają w błąd. Nadawca jest tym, za kogo się podaje.",
  jawnosc:
    "Nie ukrywam zleceniodawcy ani źródła finansowania kampanii (zakaz udawania oddolnej inicjatywy).",
  lobbing:
    "Jeśli kampania jest zawodową działalnością lobbingową w rozumieniu ustawy z 7 lipca 2005 r. o działalności lobbingowej w procesie stanowienia prawa, zleceniodawca dopełnia obowiązków rejestrowych i zgłoszeniowych. Target Force nie prowadzi lobbingu, dostarcza narzędzie.",
  pe:
    "Przy kampanii do Parlamentu Europejskiego: znam Rejestr Przejrzystości UE i stosuję jego zasady, jeśli mnie dotyczą.",
  odmowa:
    "Zgadzam się, że Target Force może odmówić uruchomienia albo zatrzymać kampanię bez podania przyczyny, gdy oświadczenie jest niewiarygodne albo treść narusza prawo lub regulamin.",
} as const;
export type KluczOswiadczenia = keyof typeof OSWIADCZENIA;

export type TrescOswiadczenia = {
  zleceniodawca: string;
  formaPrawna: (typeof FORMY_PRAWNE)[number];
  kraj: string;
  nipKrs: string;
  osoba: string;
  email: string;
  /** "wlasne" = działam we własnym imieniu, "zlecenie" = na zlecenie innego podmiotu. */
  rola: "wlasne" | "zlecenie";
  naZlecenieKogo: string;
  zrodlo: ZrodloFinansowania;
  zrodloOpis: string;
  potwierdzenia: Record<KluczOswiadczenia, boolean>;
};

export function pusteOswiadczenie(): TrescOswiadczenia {
  return {
    zleceniodawca: "",
    formaPrawna: "fundacja",
    kraj: "Polska",
    nipKrs: "",
    osoba: "",
    email: "",
    rola: "wlasne",
    naZlecenieKogo: "",
    zrodlo: "wlasne",
    zrodloOpis: "",
    potwierdzenia: { prawdziwe: false, jawnosc: false, lobbing: false, pe: false, odmowa: false },
  };
}

/**
 * Jedna wspólna walidacja dla formularza i serwera. Zwraca pierwszy błąd (po polsku, domyślnie) albo null.
 * Z `t` z lib/i18n komunikat wychodzi w języku użytkownika.
 */
export function sprawdzOswiadczenie(t: TrescOswiadczenia, tl: Tlumacz = tlumacz("pl")): string | null {
  if (!t.zleceniodawca.trim()) return tl("osw.walidacja.nazwa");
  if (!FORMY_PRAWNE.includes(t.formaPrawna)) return tl("osw.walidacja.forma");
  if (!t.osoba.trim()) return tl("osw.walidacja.osoba");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t.email)) return tl("osw.walidacja.email");
  if (t.rola === "zlecenie" && !t.naZlecenieKogo.trim()) return tl("osw.walidacja.naZlecenie");
  if (!(t.zrodlo in ZRODLA_FINANSOWANIA)) return tl("osw.walidacja.zrodlo");
  if ((ZRODLA_Z_OPISEM.includes(t.zrodlo) || t.rola === "zlecenie") && !t.zrodloOpis.trim())
    return tl("osw.walidacja.opis");
  for (const k of Object.keys(OSWIADCZENIA) as KluczOswiadczenia[])
    if (!t.potwierdzenia?.[k]) return tl("osw.walidacja.zaznacz");
  return null;
}

/** Decyzja zespołu: wartość w bazie zostaje, etykietę daje t(`zgoda.${zgoda}`). */
export const ZGODA = {
  czeka: { klasa: "bg-amber-50 text-amber-800 ring-amber-200" },
  zaakceptowana: { klasa: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  odrzucona: { klasa: "bg-red-50 text-red-800 ring-red-200" },
} as const;
export type ZgodaZespolu = keyof typeof ZGODA;
