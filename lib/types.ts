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
  samorzady: {
    nazwa: "Samorządy w Polsce",
    opis: "Urzędy gmin, powiatów i województw (ok. 2 800). Oficjalne ogólne adresy e-mail z bazy teleadresowej MSWiA (16.04.2026).",
    api: "https://www.gov.pl/web/mswia/baza-jst",
    typ: "politycy",
  },
  ministerstwa: {
    nazwa: "Ministerstwa",
    opis: "18 ministerstw ze składu Rady Ministrów. Ogólne adresy kancelarii ze stron gov.pl (07.10.2026); 4 resorty nie podają takiego adresu.",
    api: "https://www.gov.pl/web/premier/sklad-rady-ministrow",
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
  wlasna_lista: {
    nazwa: "Własna lista",
    opis: "Import z pliku CSV albo wklejka. Dla odbiorców, których nie ma w żadnym API.",
    api: null,
    typ: "wlasne",
  },
} as const;

export type ZrodloId = keyof typeof ZRODLA;

export type StatusKampanii = "szkic" | "gotowa" | "uruchomiona" | "zakonczona";

export const STATUSY: Record<
  StatusKampanii,
  { etykieta: string; klasa: string }
> = {
  szkic: {
    etykieta: "Szkic",
    klasa: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  gotowa: {
    etykieta: "Gotowa",
    klasa: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  uruchomiona: {
    etykieta: "Uruchomiona",
    klasa: "bg-brand-50 text-brand-700 ring-brand-200",
  },
  zakonczona: {
    etykieta: "Zakończona",
    klasa: "bg-slate-100 text-slate-500 ring-slate-200",
  },
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

  /** Link do filmu albo strony, o której piszemy. Może być pusty. */
  linkFilm: string;
  /** Dodatkowe materiały: linki, notatki, fragmenty. Trafiają do promptu. */
  materialy: string;

  /** Czy generujemy psychografię odbiorców przed pisaniem wiadomości */
  psychografia: boolean;
  /** Ile wariantów wiadomości generujemy. Piotr prosił o 7 (22.09). */
  liczbaWariantow: number;
  /** Ile przypomnień po pierwszej wiadomości, jeśli brak odpowiedzi */
  liczbaFollowupow: number;
  /** Co ile dni kolejne przypomnienie */
  odstepDni: number;
  /** Dzień startu wysyłki (RRRR-MM-DD) albo null, jeśli jeszcze nie ustalony */
  start: string | null;
  /** Skrzynka, z której wysyłamy tę kampanię (każda kampania ma swoją). */
  skrzynkaId: string | null;

  /** Strona akcji dla sympatyków (/a/{slug}): publiczna, sympatyk wysyła wiadomość z własnej poczty. */
  akcjaWlaczona: boolean;
  akcjaSlug: string | null;
  akcjaTytul: string;
  akcjaOpis: string;
  /** Administrator danych sympatyków (nazwa i kontakt) do informacji RODO na stronie. */
  akcjaAdministrator: string;
  /** Zawężenie odbiorców (Sejm: komisje, kluby; samorządy: województwa, typy). Kreator może je ustawić z propozycji AI. */
  filtrOdbiorcow: FiltrOdbiorcow;
};

export type FiltrOdbiorcow = {
  komisje?: string[];
  kluby?: string[];
  wojewodztwa?: string[];
  typy?: string[];
};

export function pustaKampania(): Omit<Kampania, "id" | "utworzona"> {
  return {
    nazwa: "",
    status: "szkic",
    zrodla: [],
    kogoSzukamy: "",
    cel: "",
    nadawca: "",
    linkFilm: "",
    materialy: "",
    psychografia: true,
    liczbaWariantow: 7,
    liczbaFollowupow: 2,
    odstepDni: 4,
    start: null,
    skrzynkaId: null,
    akcjaWlaczona: false,
    akcjaSlug: null,
    akcjaTytul: "",
    akcjaOpis: "",
    akcjaAdministrator: "",
    filtrOdbiorcow: {},
  };
}
