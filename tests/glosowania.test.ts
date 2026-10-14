import { describe, expect, it } from "vitest";
import { dataSlownie, poleGlosowania, type Glosowanie } from "@/lib/glosowania";
import { personalizuj } from "@/lib/personalizacja";

const g: Glosowanie = {
  posiedzenie: 66,
  numer: 132,
  data: "2026-10-08",
  tytul: "o rekompensatach za szkody wyrządzone przez ptaki",
  za: "ustawą o rekompensatach za szkody wyrządzone przez ptaki",
  przeciw: "ustawie o rekompensatach za szkody wyrządzone przez ptaki",
};

describe("głosowanie jako argument", () => {
  it("data słownie", () => expect(dataSlownie("2026-10-08")).toBe("8 października 2026 r."));
  it("za i przeciw w dobrym przypadku", () => {
    expect(poleGlosowania(g, "YES")).toBe("za ustawą o rekompensatach za szkody wyrządzone przez ptaki w głosowaniu z 8 października 2026 r.");
    expect(poleGlosowania(g, "NO")).toMatch(/^przeciw ustawie o rekompensatach/);
  });
  it("brak głosu: zdanie z polem znika", () => {
    expect(poleGlosowania(g, "ABSTAIN")).toBeUndefined();
    const tekst = "Dzień dobry. Pana/Pani głos w Sejmie: {glosowanie}. Piszemy w sprawie ptaków.";
    expect(personalizuj(tekst, { glosowanie: undefined })).toBe("Dzień dobry. Piszemy w sprawie ptaków.");
    expect(personalizuj(tekst, { glosowanie: poleGlosowania(g, "YES") })).toContain("głos w Sejmie: za ustawą");
  });
});
