/**
 * Zmiany w drodze (14.10). Ustawa kampanii (ELI, np. DU/2004/880) i projekty jej zmian w Sejmie:
 * lista projektów z sejmdiff.pl (nieoficjalne), etap i data z oficjalnego API Sejmu (processes/{druk}).
 */
export type Ustawa = { eli: string; tytul: string };
export type Projekt = {
  druk: string;
  tytul: string;
  wplynal: string;
  etap: string | null;
  etapData: string | null;
  uchwalony: boolean;
  link: string;
};

const SD = "https://sejmdiff.pl/api";

/** Ustawy (akty bazowe, obowiązujące) pasujące do słów z tytułu; bez nowelizacji "o zmianie ustawy". */
export async function szukajUstaw(slowa: string): Promise<Ustawa[]> {
  // Wyniki idą od najnowszych, więc sama ustawa ginie pod nowelizacjami: przeglądamy do 4 stron po 50.
  type Strona = { pages: number; results: { eli: string; title: string }[] };
  const strona = async (n: number) => {
    const q = new URLSearchParams({ q: slowa, type: "Ustawa", in_force: "IN_FORCE", page: String(n) });
    const odp = await fetch(`${SD}/acts?${q}`, { next: { revalidate: 60 * 60 * 24 }, signal: AbortSignal.timeout(10000) });
    if (!odp.ok) throw new Error(`sejmdiff ${odp.status}`);
    return (await odp.json()) as Strona;
  };
  const pierwsza = await strona(1);
  const reszta = await Promise.all(Array.from({ length: Math.min(pierwsza.pages ?? 1, 4) - 1 }, (_, i) => strona(i + 2)));
  return [pierwsza, ...reszta]
    .flatMap((s) => s.results)
    .filter((r) => !/o zmianie (ustaw|niektórych)|ogłoszenia jednolitego|przepisy wprowadzające|o ratyfikacji/i.test(r.title))
    .map((r) => ({ eli: r.eli, tytul: r.title }));
}

type Etap = { date?: string; stageName?: string; children?: Etap[] };

function ostatniEtap(etapy: Etap[]): Etap | null {
  const plaskie: Etap[] = [];
  const zbierz = (lista: Etap[]) => {
    for (const e of lista) {
      plaskie.push(e);
      zbierz(e.children ?? []);
    }
  };
  zbierz(etapy);
  return plaskie.filter((e) => e.date).sort((a, b) => (a.date! < b.date! ? -1 : 1)).at(-1) ?? null;
}

/** Projekty zmian ustawy w Sejmie, najświeższa aktywność pierwsza. */
export async function projektyZmian(eli: string): Promise<Projekt[]> {
  if (!/^(DU|MP)\/\d{4}\/\d+$/.test(eli)) return [];
  const odp = await fetch(`${SD}/acts/${eli}/pending`, { next: { revalidate: 60 * 60 * 6 }, signal: AbortSignal.timeout(10000) });
  if (!odp.ok) throw new Error(`sejmdiff ${odp.status}`);
  const d = (await odp.json()) as { results: { source: string; source_id: string; title: string; date: string; url: string }[] };
  const projekty = d.results.filter((r) => r.source === "bill" && /^\d+\/\d+$/.test(r.source_id));
  const wynik = await Promise.all(
    projekty.map(async (r) => {
      const [kadencja, druk] = r.source_id.split("/");
      let etap: Etap | null = null;
      let uchwalony = false;
      try {
        const p = await fetch(`https://api.sejm.gov.pl/sejm/term${kadencja}/processes/${druk}`, {
          next: { revalidate: 60 * 60 * 6 },
          signal: AbortSignal.timeout(8000),
        });
        if (p.ok) {
          const proces = (await p.json()) as { passed?: boolean; stages?: Etap[] };
          etap = ostatniEtap(proces.stages ?? []);
          uchwalony = !!proces.passed;
        }
      } catch {
        // Bez etapu: pokażemy sam projekt.
      }
      return {
        druk,
        tytul: r.title,
        wplynal: r.date,
        etap: etap?.stageName ?? null,
        etapData: etap?.date ?? null,
        uchwalony,
        link: r.url,
      };
    }),
  );
  return wynik.sort((a, b) => ((b.etapData ?? b.wplynal) > (a.etapData ?? a.wplynal) ? 1 : -1));
}

/** Projekt "w ruchu": nieuchwalony i z aktywnością w ostatnich 90 dniach. */
export const wRuchu = (p: Projekt, teraz = Date.now()) =>
  !p.uchwalony && teraz - new Date(p.etapData ?? p.wplynal).getTime() < 90 * 86_400_000;
