/**
 * Głosowanie jako argument (14.10). Lista głosowań końcowych kadencji z sejmdiff.pl (nieoficjalne API
 * na danych Sejmu), głosy posłów z oficjalnego API Sejmu. Pole {glosowanie} w treści dostaje dla posła
 * zdanie o jego głosie; gdy wstrzymał się, nie głosował albo nie ma danych, zdanie z polem znika.
 */
export type Glosowanie = {
  posiedzenie: number;
  numer: number;
  data: string; // YYYY-MM-DD
  tytul: string;
  /** Po "za", narzędnik: "nowelizacją ustawy o ochronie przyrody". */
  za: string;
  /** Po "przeciw", celownik: "nowelizacji ustawy o ochronie przyrody". */
  przeciw: string;
};

export type GlosowanieKoncowe = {
  posiedzenie: number;
  numer: number;
  data: string;
  tytul: string;
  za: number;
  przeciw: number;
};

const KADENCJA = 10;
const MIESIACE = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

/** Głosowania końcowe (całość projektu) kadencji, najnowsze pierwsze. Z historii posła nr 1 (głosuje we wszystkich). */
export async function glosowaniaKoncowe(): Promise<GlosowanieKoncowe[]> {
  type Strona = {
    pages: number;
    final_votes: { voting: { sitting: number; number: number; date: string; title: string; yes: number; no: number; final: boolean } }[];
  };
  const pobierz = async (strona: number) => {
    const odp = await fetch(`https://sejmdiff.pl/api/mps/${KADENCJA}/1?page=${strona}`, {
      next: { revalidate: 60 * 60 * 12 },
      signal: AbortSignal.timeout(10000),
    });
    if (!odp.ok) throw new Error(`sejmdiff ${odp.status}`);
    return (await odp.json()) as Strona;
  };
  const pierwsza = await pobierz(1);
  const reszta = await Promise.all(Array.from({ length: Math.min(pierwsza.pages, 5) - 1 }, (_, i) => pobierz(i + 2)));
  const widziane = new Set<string>();
  return [pierwsza, ...reszta]
    .flatMap((s) => s.final_votes)
    .map((v) => v.voting)
    .filter((v) => v.final && !widziane.has(`${v.sitting}/${v.number}`) && widziane.add(`${v.sitting}/${v.number}`))
    .map((v) => ({
      posiedzenie: v.sitting,
      numer: v.number,
      data: v.date.slice(0, 10),
      tytul: v.title.replace(/\s+/g, " ").trim(),
      za: v.yes,
      przeciw: v.no,
    }));
}

/** Głos każdego posła w głosowaniu: id posła (jak zewnetrzne_id kontaktu z Sejmu) -> YES / NO / ABSTAIN / ABSENT. */
export async function glosyPoslow(g: Pick<Glosowanie, "posiedzenie" | "numer">): Promise<Map<string, string>> {
  const odp = await fetch(`https://api.sejm.gov.pl/sejm/term${KADENCJA}/votings/${g.posiedzenie}/${g.numer}`, {
    next: { revalidate: 60 * 60 * 24 },
    signal: AbortSignal.timeout(10000),
  });
  if (!odp.ok) throw new Error(`Sejm ${odp.status}`);
  const d = (await odp.json()) as { votes?: { MP: number; vote: string }[] };
  return new Map((d.votes ?? []).map((v) => [String(v.MP), v.vote]));
}

export function dataSlownie(iso: string): string {
  const [r, m, d] = iso.split("-").map(Number);
  return `${d} ${MIESIACE[m - 1]} ${r} r.`;
}

/** Wartość pola {glosowanie} dla posła albo undefined (zdanie z polem wtedy znika). */
export function poleGlosowania(g: Glosowanie, glos: string | undefined): string | undefined {
  const kiedy = `w głosowaniu z ${dataSlownie(g.data)}`;
  if (glos === "YES") return `za ${g.za} ${kiedy}`;
  if (glos === "NO") return `przeciw ${g.przeciw} ${kiedy}`;
  return undefined;
}

/** Pola {glosowanie} dla kontaktów kampanii (klucz: id kontaktu). Gdy API Sejmu nie odpowiada: pusto, zdania znikają. */
export async function polaGlosowania(
  g: Glosowanie | null | undefined,
  kontakty: { id: string; zewnetrzne_id?: string | null }[],
): Promise<Map<string, string>> {
  const wynik = new Map<string, string>();
  if (!g) return wynik;
  try {
    const glosy = await glosyPoslow(g);
    for (const c of kontakty) {
      const v = c.zewnetrzne_id ? poleGlosowania(g, glosy.get(c.zewnetrzne_id)) : undefined;
      if (v) wynik.set(c.id, v);
    }
  } catch (e) {
    console.error("polaGlosowania", e);
  }
  return wynik;
}
