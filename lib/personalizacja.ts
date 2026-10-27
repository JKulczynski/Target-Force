/**
 * Pola personalizacji w temacie i treści: {imie}, {nazwisko}, {okreg}, {wojewodztwo}, {gmina} (gmina sympatyka ze strony akcji),
 * {glosowanie} (głos posła w wybranym głosowaniu Sejmu, lib/glosowania.ts).
 * Lokalny argument z formuły Piotra (30.09): poseł czyta "jako poseł z okręgu Kraków", nie ogólnik.
 * Gdy dla danej osoby brakuje wartości (np. własna lista bez okręgu), całe zdanie z tym polem znika,
 * zamiast zostawiać dziurę w tekście.
 */
export const POLA = ["imie", "nazwisko", "okreg", "wojewodztwo", "gmina", "glosowanie"] as const;
export type Pola = Partial<Record<(typeof POLA)[number], string>>;

const WZOR = /\{(imie|nazwisko|okreg|wojewodztwo|gmina|glosowanie)\}/g;

function wstaw(fragment: string, pola: Pola): string | null {
  let brak = false;
  const wynik = fragment.replace(WZOR, (_, nazwa: keyof Pola) => {
    const v = pola[nazwa]?.trim();
    if (!v) brak = true;
    return v ?? "";
  });
  return brak ? null : wynik;
}

export function personalizuj(tekst: string, pola: Pola): string {
  if (!WZOR.test(tekst)) return tekst;
  WZOR.lastIndex = 0;
  return tekst
    .split("\n")
    .map((linia) =>
      linia
        // Zdania w linii; zdanie z brakującym polem wypada w całości.
        .split(/(?<=[.!?])\s+/)
        .map((zdanie) => wstaw(zdanie, pola))
        .filter((z): z is string => z !== null)
        .join(" "),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** Pola z rekordu kontaktu w bazie. */
export function polaKontaktu(
  k: { imie?: string | null; nazwisko?: string | null; dane?: unknown },
  glosowanie?: string,
): Pola {
  const d = (k.dane ?? {}) as Record<string, unknown>;
  return {
    imie: k.imie ?? undefined,
    nazwisko: k.nazwisko ?? undefined,
    okreg: typeof d.okreg === "string" ? d.okreg : undefined,
    wojewodztwo: typeof d.wojewodztwo === "string" ? d.wojewodztwo : undefined,
    glosowanie,
  };
}

/** Przykładowe wartości do maila testowego, żeby nadawca zobaczył, jak wygląda personalizacja. */
export const POLA_TESTOWE: Pola = { imie: "Andrzej", nazwisko: "Adamczyk", okreg: "Kraków", wojewodztwo: "małopolskie" };

export type NazwaPola = (typeof POLA)[number];

/**
 * Które pola mają odbiorcy z danych źródeł (27.10, błąd K1: własna lista nie ma okręgu, więc temat
 * z {okreg} wychodził pusty). Sejm daje okręg i głosowanie (lib/zrodla-serwer.ts), samorządy okręg
 * i województwo; własna lista, PE, Tweede Kamer, ministerstwa i firmy tylko imię i nazwisko.
 * {gmina} podaje sam mieszkaniec na stronie akcji, więc istnieje tylko w wiadomościach sympatyka.
 */
export function polaZrodel(zrodla: readonly string[], rola: "nadawca" | "sympatyk" = "nadawca"): NazwaPola[] {
  const ma = new Set<NazwaPola>(["imie", "nazwisko"]);
  if (zrodla.includes("sejm")) {
    ma.add("okreg");
    ma.add("glosowanie");
  }
  if (zrodla.includes("samorzady")) {
    ma.add("okreg");
    ma.add("wojewodztwo");
  }
  if (rola === "sympatyk") ma.add("gmina");
  return POLA.filter((p) => ma.has(p));
}

/** Pola użyte w tekście, których odbiorcy nie mają: zdanie z takim polem znika z maila, temat byłby pusty. */
export function polaBezDanych(tekst: string, dostepne: readonly NazwaPola[]): NazwaPola[] {
  const uzyte = [...tekst.matchAll(WZOR)].map((m) => m[1] as NazwaPola);
  return [...new Set(uzyte.filter((p) => !dostepne.includes(p)))];
}

/** Przykładowe pola do testu: tylko te, które odbiorcy kampanii naprawdę mają (test ma pokazywać prawdziwą wysyłkę). */
export function polaTestowe(zrodla: readonly string[]): Pola {
  const dostepne = polaZrodel(zrodla);
  return Object.fromEntries(Object.entries(POLA_TESTOWE).filter(([k]) => dostepne.includes(k as NazwaPola)));
}

/** Temat bez pól, gdy po personalizacji nic nie zostało (strona akcji: mieszkaniec i tak widzi temat i może poprawić). */
export function tematAwaryjny(temat: string, zapasowy: string): string {
  const bez = temat.replace(/\s*\{[^}]*\}/g, "").replace(/\s+([,.;:!?])/g, "$1").replace(/^[\s,;:]+|[\s,;:]+$/g, "").trim();
  return bez || zapasowy;
}
