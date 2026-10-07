import { describe, expect, it } from "vitest";
import { personalizuj, polaKontaktu } from "@/lib/personalizacja";

describe("personalizuj", () => {
  it("wstawia pola w temacie i treści", () => {
    expect(personalizuj("Sprawa w {okreg}", { okreg: "Kraków" })).toBe("Sprawa w Kraków");
    expect(personalizuj("Piszę z gminy {gmina}.", { gmina: "Bolesławiec" })).toBe("Piszę z gminy Bolesławiec.");
  });

  it("usuwa całe zdanie, gdy brakuje wartości pola", () => {
    const tekst = "Dzień dobry. W {okreg} dotyczy to kilku szkół. Proszę o interpelację.";
    expect(personalizuj(tekst, {})).toBe("Dzień dobry. Proszę o interpelację.");
  });

  it("zostawia tekst bez pól bez zmian", () => {
    const tekst = "Bez pól.\n\nDrugi akapit.";
    expect(personalizuj(tekst, { okreg: "x" })).toBe(tekst);
  });

  it("nie zostawia pustych linii po usuniętym zdaniu w osobnej linii", () => {
    const tekst = "A.\n\nW {okreg} jest źle.\n\nB.";
    expect(personalizuj(tekst, {})).toBe("A.\n\n\n\nB.".replace(/\n{3,}/g, "\n\n"));
  });
});

describe("polaKontaktu", () => {
  it("czyta okręg i województwo z pola dane", () => {
    expect(polaKontaktu({ imie: "Anna", nazwisko: "Nowak", dane: { okreg: "Kraków", wojewodztwo: "małopolskie", okregNr: 13 } })).toEqual({
      imie: "Anna",
      nazwisko: "Nowak",
      okreg: "Kraków",
      wojewodztwo: "małopolskie",
    });
  });
});
