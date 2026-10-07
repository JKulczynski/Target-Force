import gminy from "@/lib/dane/gminy.json";

/**
 * Strona akcji (wariant A, decyzja Jana 07.10.2026): sympatyk podaje imię i gminę, my dobieramy decydenta
 * z listy odbiorców kampanii i składamy wiadomość, a on wysyła ją sam ze swojej poczty.
 * Gmina -> okręg wyborczy do Sejmu: dane PKW z wyborów 2023 (wyniki po gminach), zapisane w lib/dane/gminy.json.
 * Trzy gminy bez wpisu w PKW (nowe albo z brakiem w danych) dostały okręg po powiecie.
 */
export type Gmina = {
  /** TERYT tak, jak w lib/dane/jst.json (klucz zewnetrzne_id kontaktów z samorządów). */
  t: string;
  n: string;
  typ: string;
  p: string;
  w: string;
  /** Numer okręgu wyborczego do Sejmu (1-41). */
  o: number;
};

export const GMINY = gminy as Gmina[];

export function gminaPoTeryt(teryt: string): Gmina | undefined {
  return GMINY.find((g) => g.t === teryt);
}

/** TERYT powiatu (7 znaków, końcówka 000) dla gminy, do dopasowania starostwa. */
export function terytPowiatu(g: Gmina): string {
  return g.t.replace(/\.0$/, "").padStart(7, "0").slice(0, 4) + "000";
}

/** Nazwa do zdania „piszę z gminy {gmina}”: dzielnice Warszawy to jedna gmina. */
export function nazwaGminyDoTekstu(g: Gmina): string {
  return g.typ === "dzielnica" ? "Warszawa" : g.n;
}

export function etykietaGminy(g: Gmina): string {
  if (g.typ === "dzielnica") return `Warszawa, ${g.n}`;
  if (g.typ === "Miasto na prawach powiatu") return `${g.n} (miasto)`;
  const typ = g.typ.replace("Gmina ", "gm. ");
  return `${g.n} (${typ}, pow. ${g.p})`;
}

/** Adres strony akcji z nazwy kampanii: małe litery, bez polskich znaków, myślniki. */
export function slugZNazwy(nazwa: string): string {
  const mapa: Record<string, string> = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z",
  };
  return nazwa
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (z) => mapa[z] ?? z)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const POPRAWNY_SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

/** Identyfikator filmu z YouTube do osadzenia na stronie akcji; null dla innych adresów. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/]+)/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }
  return null;
}
