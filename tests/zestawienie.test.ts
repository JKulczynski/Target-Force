import { describe, expect, it } from "vitest";
import { trescZestawienia } from "@/lib/zestawienie";

describe("dzienne zestawienie dla biura", () => {
  const tekst = trescZestawienia({
    sprawa: "Oświetlenie przejść przy szkołach",
    organizacja: "Fundacja Testowa",
    data: "15.10.2026",
    stopka: "Kampanię prowadzi Fundacja Testowa.",
    podpisy: [
      { imie: "Anna", nazwisko: "Kowalska", gmina_nazwa: "Kraków", tresc: "Dzień dobry, proszę o lampy.\n\nAnna Kowalska\nKraków" },
      { imie: "Jan", nazwisko: "Nowak", gmina_nazwa: null, tresc: "Dzień dobry, popieram.\n\nJan Nowak\nWieliczka" },
    ],
  });
  it("każda wiadomość w całości, z nadawcą i gminą, bez zdublowanego podpisu", () => {
    expect(tekst).toContain("1. Anna Kowalska, gmina Kraków\n\nDzień dobry, proszę o lampy.");
    expect(tekst).toContain("2. Jan Nowak\n\nDzień dobry, popieram.");
    expect(tekst).not.toContain("Anna Kowalska\nKraków");
  });
  it("liczba wiadomości i stopka nadawcy", () => {
    expect(tekst).toContain("Liczba wiadomości: 2");
    expect(tekst).toContain("--\nKampanię prowadzi Fundacja Testowa.");
  });
});
