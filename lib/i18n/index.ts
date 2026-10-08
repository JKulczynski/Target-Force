import { pl } from "./pl";
import { en } from "./en";

/**
 * Warstwa tłumaczeń bez zewnętrznej biblioteki (decyzja 07.10): słownik PL (źródło kluczy) + EN
 * (typowany po kluczach PL, więc brak tłumaczenia nie przejdzie przez tsc). Język siedzi w cookie
 * `tf_lang`; klient czyta go przez useT() (lib/i18n/klient.tsx), serwer przez jezykZCookie() (lib/i18n/serwer.ts).
 * Kod, nazwy kolumn, prompty AI i treści w bazie zostają po polsku; tłumaczymy tylko to, co widzi człowiek.
 */
export type Jezyk = "pl" | "en";
export type Klucz = keyof typeof pl;
/** Klucz liczebnika: istnieje `${K}.1`, `${K}.few` i `${K}.many` (polska odmiana 1 / 2-4 / 5+). */
export type KluczLiczebny = Klucz extends infer K ? (K extends `${infer B}.many` ? B : never) : never;
export type Parametry = Record<string, string | number>;

export const JEZYKI: Jezyk[] = ["pl", "en"];
export const DOMYSLNY_JEZYK: Jezyk = "pl";
export const COOKIE_JEZYKA = "tf_lang";
/** Rok, w sekundach (max-age cookie). */
export const COOKIE_WAZNOSC = 60 * 60 * 24 * 365;
export const LOCALE: Record<Jezyk, string> = { pl: "pl-PL", en: "en-GB" };

const SLOWNIKI: Record<Jezyk, Record<Klucz, string>> = { pl, en };

export function jezykZWartosci(wartosc: string | null | undefined): Jezyk {
  return wartosc === "en" ? "en" : DOMYSLNY_JEZYK;
}

/** Prosta interpolacja: "{nazwa}" -> params.nazwa. Nieznane pola zostają w tekście. */
function wstaw(tekst: string, params?: Parametry): string {
  if (!params) return tekst;
  return tekst.replace(/\{(\w+)\}/g, (calosc, nazwa: string) =>
    nazwa in params ? String(params[nazwa]) : calosc,
  );
}

/** Polska odmiana po liczbie: 1 / 2-4 (poza 12-14) / reszta. Po angielsku: 1 / reszta. */
function formaLiczebnika(jezyk: Jezyk, n: number): "1" | "few" | "many" {
  if (n === 1) return "1";
  if (jezyk === "en") return "many";
  const r10 = n % 10;
  const r100 = n % 100;
  return r10 >= 2 && r10 <= 4 && !(r100 >= 12 && r100 <= 14) ? "few" : "many";
}

export function t(jezyk: Jezyk, klucz: Klucz, params?: Parametry): string {
  const slownik = SLOWNIKI[jezyk] ?? pl;
  return wstaw(slownik[klucz] ?? pl[klucz] ?? klucz, params);
}

/** Liczebnik z odmianą: tn(jezyk, "osoba", 5) -> "5 osób" (gdy teksty zawierają {n}). */
export function tn(jezyk: Jezyk, klucz: KluczLiczebny, n: number, params?: Parametry): string {
  const pelny = `${klucz}.${formaLiczebnika(jezyk, n)}` as Klucz;
  return t(jezyk, pelny, { n, ...params });
}

export type Tlumacz = {
  (klucz: Klucz, params?: Parametry): string;
  /** Liczebnik z odmianą. */
  n: (klucz: KluczLiczebny, n: number, params?: Parametry) => string;
  jezyk: Jezyk;
  locale: string;
};

/** Funkcja t() przypięta do jednego języka, do użycia w route handlerach i komponentach serwerowych. */
export function tlumacz(jezyk: Jezyk): Tlumacz {
  const f = ((klucz: Klucz, params?: Parametry) => t(jezyk, klucz, params)) as Tlumacz;
  f.n = (klucz, n, params) => tn(jezyk, klucz, n, params);
  f.jezyk = jezyk;
  f.locale = LOCALE[jezyk];
  return f;
}
