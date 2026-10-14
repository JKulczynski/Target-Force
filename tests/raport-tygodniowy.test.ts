import { describe, expect, it } from "vitest";
import { trescRaportu } from "@/lib/raport-tygodniowy";

describe("raport tygodniowy", () => {
  it("liczby kampanii i link do pełnego raportu", () => {
    const t = trescRaportu(
      "Fundacja X",
      "07.10.2026",
      [{ nazwa: "Przejścia", id: "abc", maile: 40, klikniecia: 12, odpowiedzi: 3, podpisy: 120, wyslaliMieszkancy: 95, odpowiedziMerytoryczne: 7 }],
      "https://getwinover.com",
    );
    expect(t).toContain("maile organizacji: 40, kliknięcia w link: 12, odpowiedzi decydentów: 3");
    expect(t).toContain("120 podpisów, 95 wiadomości mieszkańców, 7 odpowiedzi w sprawie");
    expect(t).toContain("https://getwinover.com/kampanie/abc/raport");
  });
});
