/**
 * Cytaty przepisów z aktualnego tekstu ustawy (14.10). Źródło: sejmdiff.pl, wersja obowiązująca dziś;
 * tekst ma jeden przepis w linii: "Art. 229 § 1 | treść". Gdy źródło nie odpowiada, cytatu po prostu nie ma.
 */
const SD = "https://sejmdiff.pl/api";

async function tekstUstawy(eli: string): Promise<string | null> {
  if (!/^(DU|MP)\/\d{4}\/\d+$/.test(eli)) return null;
  const dzis = new Date().toISOString().slice(0, 10);
  try {
    const odp = await fetch(`${SD}/acts/${eli}/at/${dzis}`, {
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(15000),
    });
    if (!odp.ok) return null;
    const d = (await odp.json()) as { text?: string };
    return d.text ?? null;
  } catch {
    return null;
  }
}

const bezpieczny = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Brzmienie artykułu ("229 § 1" = tylko ten paragraf; "83f" = cały artykuł, wszystkie jego linie).
 * Zwraca null, gdy przepisu nie ma w aktualnym tekście (np. uchylony albo zły numer).
 */
export async function cytat(eli: string, art: string): Promise<string | null> {
  const tekst = await tekstUstawy(eli);
  if (!tekst) return null;
  const [numer, ...reszta] = art.trim().split(/\s+/);
  const jednostka = reszta.join(" ");
  const wzor = new RegExp(`^Art\\. ${bezpieczny(numer)}${jednostka ? ` ${bezpieczny(jednostka)}` : ""}(?=\\s*\\||\\s|$)`, "i");
  const linie = tekst.split("\n").filter((l) => wzor.test(l));
  if (!linie.length) return null;
  const wynik = linie.map((l) => l.replace(/\s*\|\s*/, ": ")).join("\n");
  return wynik.length > 1500 ? `${wynik.slice(0, 1497)}...` : wynik;
}

/** Link do aktu w ISAP (Sejm), z metadanych aktu; numer ISAP zależy od numeru Dziennika, więc go nie zgadujemy. */
export async function linkIsap(eli: string): Promise<string | null> {
  try {
    const odp = await fetch(`${SD}/acts/${eli}`, { next: { revalidate: 60 * 60 * 24 * 7 }, signal: AbortSignal.timeout(8000) });
    if (!odp.ok) return null;
    return ((await odp.json()) as { isap?: string }).isap ?? null;
  } catch {
    return null;
  }
}
