/**
 * Pola personalizacji w temacie i treści: {imie}, {nazwisko}, {okreg}, {wojewodztwo}.
 * Lokalny argument z formuły Piotra (30.09): poseł czyta "jako poseł z okręgu Kraków", nie ogólnik.
 * Gdy dla danej osoby brakuje wartości (np. własna lista bez okręgu), całe zdanie z tym polem znika,
 * zamiast zostawiać dziurę w tekście.
 */
export const POLA = ["imie", "nazwisko", "okreg", "wojewodztwo"] as const;
export type Pola = Partial<Record<(typeof POLA)[number], string>>;

const WZOR = /\{(imie|nazwisko|okreg|wojewodztwo)\}/g;

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
export function polaKontaktu(k: { imie?: string | null; nazwisko?: string | null; dane?: unknown }): Pola {
  const d = (k.dane ?? {}) as Record<string, unknown>;
  return {
    imie: k.imie ?? undefined,
    nazwisko: k.nazwisko ?? undefined,
    okreg: typeof d.okreg === "string" ? d.okreg : undefined,
    wojewodztwo: typeof d.wojewodztwo === "string" ? d.wojewodztwo : undefined,
  };
}

/** Przykładowe wartości do maila testowego, żeby nadawca zobaczył, jak wygląda personalizacja. */
export const POLA_TESTOWE: Pola = { imie: "Andrzej", nazwisko: "Adamczyk", okreg: "Kraków", wojewodztwo: "małopolskie" };
