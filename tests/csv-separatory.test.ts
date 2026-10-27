import { describe, expect, it } from "vitest";
import { parsujListe } from "@/lib/csv";

/** N1 (27.10): wklejka bez nagłówka z różnymi separatorami gubiła osoby (separator brany z pierwszej linii). */
describe("lista bez nagłówka z mieszanymi separatorami", () => {
  it("czyta przecinek, średnik i tabulator w jednej wklejce", () => {
    const w = parsujListe("Anna QA, anna@example.com\nBartek QA; bartek@example.com\nCelina QA\tcelina@example.com\nto nie jest mail");
    expect(w.wiersze.map((x) => [x.imie, x.nazwisko, x.email])).toEqual([
      ["Anna", "QA", "anna@example.com"],
      ["Bartek", "QA", "bartek@example.com"],
      ["Celina", "QA", "celina@example.com"],
    ]);
    expect(w.pominiete).toBe(1);
  });

  it("z nagłówkiem separator zostaje wspólny dla całego pliku", () => {
    const w = parsujListe("imie;nazwisko;email\nAnna;QA;anna@example.com\nBartek;QA, junior;bartek@example.com");
    expect(w.wiersze.map((x) => x.nazwisko)).toEqual(["QA", "QA, junior"]);
  });
});
