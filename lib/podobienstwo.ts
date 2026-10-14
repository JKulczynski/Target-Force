/**
 * Wykrywanie identycznych wiadomości mieszkańców (14.10, wzorzec WriteToThem): biura poselskie odkładają
 * masowe kopie, więc ta sama treść do tego samego adresata zachęca do dopisania własnego zdania.
 * Podobieństwo: Jaccard na trójkach słów; podpis (ostatnie dwie linie: imię i nazwisko, gmina) nie liczy się.
 */
export const PROG_KOPII = 0.9;

function bezPodpisu(tresc: string): string {
  const linie = tresc.trim().split("\n");
  return linie.slice(0, Math.max(linie.length - 2, 1)).join("\n");
}

function trojki(tresc: string): Set<string> {
  const slowa = bezPodpisu(tresc)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const wynik = new Set<string>();
  for (let i = 0; i + 2 < slowa.length; i++) wynik.add(`${slowa[i]} ${slowa[i + 1]} ${slowa[i + 2]}`);
  if (wynik.size === 0 && slowa.length) wynik.add(slowa.join(" "));
  return wynik;
}

export function podobienstwo(a: string, b: string): number {
  const x = trojki(a);
  const y = trojki(b);
  if (!x.size || !y.size) return 0;
  let wspolne = 0;
  for (const s of x) if (y.has(s)) wspolne++;
  return wspolne / (x.size + y.size - wspolne);
}

/** Ile z podanych treści to kopie tej wiadomości. */
export const ileKopii = (tresc: string, inne: string[]) => inne.filter((i) => podobienstwo(tresc, i) >= PROG_KOPII).length;
