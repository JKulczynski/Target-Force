/**
 * Pobieranie kontaktów z otwartych API parlamentów. Używane tylko na serwerze (route handler)
 * (część API nie pozwala na zapytania z przeglądarki, a wynik i tak cache'ujemy).
 * Sprawdzone na żywo 28.09: Sejm 460 aktywnych / 460 z e-mailem, Tweede Kamer 150 / 149,
 * Parlament Europejski 718 osób bez e-maili w API.
 */

export type KontaktZrodla = {
  zewnetrzneId: string;
  imie: string;
  nazwisko: string;
  email: string | null;
  organizacja: string;
  stanowisko: string;
};

const DOBA = 60 * 60 * 24;

async function json<T>(url: string, naglowki: Record<string, string> = {}): Promise<T> {
  const odp = await fetch(url, { headers: naglowki, next: { revalidate: DOBA } });
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
  };
  const poslowie = await json<Posel[]>("https://api.sejm.gov.pl/sejm/term10/MP");
  return poslowie
    .filter((p) => p.active)
    .map((p) => ({
      zewnetrzneId: String(p.id),
      imie: p.firstName,
      nazwisko: p.lastName,
      email: p.email || null,
      organizacja: p.club ?? "",
      stanowisko: "Poseł na Sejm RP",
    }));
}

async function tweedeKamer(): Promise<KontaktZrodla[]> {
  const BAZA = "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0";
  type Strona<T> = { value: T[]; "@odata.nextLink"?: string };

  async function wszystko<T>(sciezka: string, parametry: Record<string, string>) {
    let url: string | undefined = `${BAZA}${sciezka}?${new URLSearchParams(parametry)}`;
    const wynik: T[] = [];
    while (url) {
      const strona: Strona<T> = await json<Strona<T>>(url);
      wynik.push(...strona.value);
      url = strona["@odata.nextLink"];
    }
    return wynik;
  }

  type Osoba = { Id: string; Roepnaam: string | null; Voornamen: string | null; Tussenvoegsel: string | null; Achternaam: string | null; Fractielabel: string | null };
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

async function parlamentUe(): Promise<KontaktZrodla[]> {
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
  return odp.data.map((m) => ({
    zewnetrzneId: m.identifier,
    imie: m.givenName,
    nazwisko: m.familyName,
    // API PE nie podaje adresów. Wzorzec imie.nazwisko@europarl.europa.eu nie zawsze działa, więc nie zgadujemy.
    email: null,
    organizacja: [m["api:political-group"], m["api:country-of-representation"]].filter(Boolean).join(", "),
    stanowisko: "Poseł do Parlamentu Europejskiego",
  }));
}

export const POBIERACZE: Record<string, () => Promise<KontaktZrodla[]>> = {
  sejm,
  tweede_kamer: tweedeKamer,
  parlament_ue: parlamentUe,
};
