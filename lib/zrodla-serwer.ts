/**
 * Pobieranie kontaktów z otwartych API parlamentów. Używane tylko na serwerze (route handler)
 * (część API nie pozwala na zapytania z przeglądarki, a wynik i tak cache'ujemy).
 * Sprawdzone na żywo 28.09: Sejm 460 aktywnych / 460 z e-mailem, Tweede Kamer 150 / 149,
 * Parlament Europejski 718 osób bez e-maili w API: maile z profili na europarl.europa.eu trzymamy w tabeli
 * `pe_emaile` (skrypt w Vault: 03_NARZEDZIA_I_SKILLE/skrypty_agenci/pe-emaile.js).
 */

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type KontaktZrodla = {
  zewnetrzneId: string;
  imie: string;
  nazwisko: string;
  email: string | null;
  organizacja: string;
  stanowisko: string;
  /** Dodatkowe pola do personalizacji, np. okręg wyborczy. */
  dane?: Record<string, string | number>;
};

const DOBA = 60 * 60 * 24;

async function json<T>(
  url: string,
  naglowki: Record<string, string> = {},
): Promise<T> {
  const odp = await fetch(url, {
    headers: naglowki,
    next: { revalidate: DOBA },
  });
  if (!odp.ok) throw new Error(`${url} odpowiedział ${odp.status}`);
  return odp.json() as Promise<T>;
}

async function sejm(): Promise<KontaktZrodla[]> {
  type Posel = {
    id: number;
    firstName: string;
    lastName: string;
    email?: string;
    club?: string;
    active: boolean;
    districtName?: string;
    districtNum?: number;
    voivodeship?: string;
  };
  const poslowie = await json<Posel[]>(
    "https://api.sejm.gov.pl/sejm/term10/MP",
  );
  return poslowie
    .filter((p) => p.active)
    .map((p) => ({
      zewnetrzneId: String(p.id),
      imie: p.firstName,
      nazwisko: p.lastName,
      email: p.email || null,
      organizacja: p.club ?? "",
      stanowisko: "Poseł na Sejm RP",
      dane: {
        ...(p.districtName ? { okreg: p.districtName } : {}),
        ...(p.districtNum ? { okregNr: p.districtNum } : {}),
        ...(p.voivodeship ? { wojewodztwo: p.voivodeship } : {}),
      },
    }));
}

async function tweedeKamer(): Promise<KontaktZrodla[]> {
  const BAZA = "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0";
  type Strona<T> = { value: T[]; "@odata.nextLink"?: string };

  async function wszystko<T>(
    sciezka: string,
    parametry: Record<string, string>,
  ) {
    let url: string | undefined =
      `${BAZA}${sciezka}?${new URLSearchParams(parametry)}`;
    const wynik: T[] = [];
    while (url) {
      const strona: Strona<T> = await json<Strona<T>>(url);
      wynik.push(...strona.value);
      url = strona["@odata.nextLink"];
    }
    return wynik;
  }

  type Osoba = {
    Id: string;
    Roepnaam: string | null;
    Voornamen: string | null;
    Tussenvoegsel: string | null;
    Achternaam: string | null;
    Fractielabel: string | null;
  };
  type Kontakt = { Persoon_Id: string; Waarde: string };

  const [osoby, maile] = await Promise.all([
    wszystko<Osoba>("/Persoon", {
      $filter: "Functie eq 'Tweede Kamerlid' and Verwijderd eq false",
      $select: "Id,Roepnaam,Voornamen,Tussenvoegsel,Achternaam,Fractielabel",
    }),
    wszystko<Kontakt>("/PersoonContactinformatie", {
      $filter: "Soort eq 'E-mail' and Verwijderd eq false",
      $select: "Persoon_Id,Waarde",
    }),
  ]);

  const mailOsoby = new Map(maile.map((m) => [m.Persoon_Id, m.Waarde]));
  return osoby.map((o) => ({
    zewnetrzneId: o.Id,
    imie: o.Roepnaam ?? o.Voornamen ?? "",
    nazwisko: [o.Tussenvoegsel, o.Achternaam].filter(Boolean).join(" "),
    email: mailOsoby.get(o.Id) ?? null,
    organizacja: o.Fractielabel ?? "",
    stanowisko: "Tweede Kamerlid",
  }));
}

async function parlamentUe(supabase?: Supabase): Promise<KontaktZrodla[]> {
  type Mep = {
    identifier: string;
    givenName: string;
    familyName: string;
    "api:country-of-representation"?: string;
    "api:political-group"?: string;
  };
  const odp = await json<{ data: Mep[] }>(
    "https://data.europarl.europa.eu/api/v2/meps/show-current?format=application%2Fld%2Bjson&offset=0&limit=1000",
    { Accept: "application/ld+json" },
  );
  const maile = new Map<string, string>();
  if (supabase) {
    const { data } = await supabase
      .from("pe_emaile")
      .select("identifier, email")
      .not("email", "is", null);
    (data ?? []).forEach((w) => maile.set(w.identifier, w.email as string));
  }
  return odp.data.map((m) => ({
    zewnetrzneId: m.identifier,
    imie: m.givenName,
    nazwisko: m.familyName,
    // API PE nie podaje adresów; bierzemy oficjalny adres z profilu (tabela pe_emaile), nie zgadujemy wzorca.
    email: maile.get(m.identifier) ?? null,
    organizacja: [m["api:political-group"], m["api:country-of-representation"]]
      .filter(Boolean)
      .join(", "),
    stanowisko: "Poseł do Parlamentu Europejskiego",
  }));
}

/**
 * Samorządy: baza teleadresowa JST z MSWiA (gov.pl/web/mswia/baza-jst, stan 16.04.2026), zapisana w lib/dane/jst.json.
 * Ogólne adresy urzędów (nie prywatne), więc kampania trafia do urzędu wójta, burmistrza, prezydenta, starosty albo marszałka.
 * Odświeżanie: pobrać nowy XLS z MSWiA i przebudować plik (skrypt w Vault).
 */
async function samorzady(): Promise<KontaktZrodla[]> {
  const { default: jst } = await import("@/lib/dane/jst.json");
  return (
    jst as {
      teryt: string;
      nazwa: string;
      woj: string;
      powiat: string;
      typ: string;
      urzad: string;
      miejscowosc: string;
      email: string;
    }[]
  ).map((j) => ({
    zewnetrzneId: j.teryt,
    imie: "",
    nazwisko: j.urzad,
    email: j.email,
    organizacja: j.typ,
    stanowisko: j.nazwa,
    dane: { okreg: j.nazwa, wojewodztwo: j.woj, powiat: j.powiat },
  }));
}

export const POBIERACZE: Record<
  string,
  (supabase?: Supabase) => Promise<KontaktZrodla[]>
> = {
  samorzady,
  sejm,
  tweede_kamer: tweedeKamer,
  parlament_ue: parlamentUe,
};
