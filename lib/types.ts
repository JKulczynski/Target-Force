/** Model danych. Kampania jest pojemnikiem na wszystko, zgodnie z ustaleniem z 24.09. */

/** Źródła kontaktów. Wszystkie trzy parlamentarne mają otwarte API, sprawdzone 24.09. */
export const ZRODLA = {
  sejm: {
    nazwa: "Sejm RP",
    opis: "Posłowie obecnej kadencji. API zwraca też adresy e-mail.",
    api: "https://api.sejm.gov.pl/sejm/term10/MP",
    typ: "politycy",
  },
  parlament_ue: {
    nazwa: "Parlament Europejski",
    opis: "Posłowie do PE. Otwarte dane w formacie JSON-LD.",
    api: "https://data.europarl.europa.eu/api/v2/meps",
    typ: "politycy",
  },
  tweede_kamer: {
    nazwa: "Tweede Kamer (Holandia)",
    opis: "Izba niższa parlamentu Holandii. OData v4.",
    api: "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Persoon",
    typ: "politycy",
  },
  apollo: {
    nazwa: "Apollo",
    opis: "Kontakty B2B. Wymaga klucza API.",
    api: null,
    typ: "b2b",
  },
  clay: {
    nazwa: "Clay",
    opis: "Kontakty B2B i wzbogacanie danych. Wymaga klucza API.",
    api: null,
    typ: "b2b",
  },
} as const;

export type ZrodloId = keyof typeof ZRODLA;

export type StatusKampanii = "szkic" | "gotowa" | "uruchomiona" | "zakonczona";

export const STATUSY: Record<StatusKampanii, { etykieta: string; klasa: string }> = {
  szkic: { etykieta: "Szkic", klasa: "bg-slate-100 text-slate-600 ring-slate-200" },
  gotowa: { etykieta: "Gotowa", klasa: "bg-amber-50 text-amber-700 ring-amber-200" },
  uruchomiona: { etykieta: "Uruchomiona", klasa: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  zakonczona: { etykieta: "Zakończona", klasa: "bg-slate-100 text-slate-500 ring-slate-200" },
};

export type Kampania = {
  id: string;
  nazwa: string;
  status: StatusKampanii;
  utworzona: string;

  /** Do kogo piszemy */
  zrodla: ZrodloId[];
  /** Doprecyzowanie odbiorcy, np. "posłowie z komisji obrony" */
  kogoSzukamy: string;

  /** Co chcemy osiągnąć. To trafia do promptu generującego wiadomości. */
  cel: string;
  /** Kto pisze, w czyim imieniu */
  nadawca: string;

  /** Czy generujemy psychografię odbiorców przed pisaniem wiadomości */
  psychografia: boolean;
  /** Ile wariantów wiadomości generujemy. Piotr prosił o 7 (22.09). */
  liczbaWariantow: number;
};

export function pustaKampania(): Omit<Kampania, "id" | "utworzona"> {
  return {
    nazwa: "",
    status: "szkic",
    zrodla: [],
    kogoSzukamy: "",
    cel: "",
    nadawca: "",
    psychografia: true,
    liczbaWariantow: 7,
  };
}
