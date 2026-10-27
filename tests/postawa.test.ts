import { describe, expect, it } from "vitest";
import { czyPostawa, liczPostawy } from "@/lib/postawa";

describe("postawa", () => {
  it("rozpoznaje tylko trzy wartości", () => {
    expect(czyPostawa("za")).toBe(true);
    expect(czyPostawa("waha_sie")).toBe(true);
    expect(czyPostawa("przeciw")).toBe(true);
    expect(czyPostawa("moze")).toBe(false);
    expect(czyPostawa(null)).toBe(false);
  });

  it("liczy próg większości i brakujące głosy (12 osób: próg 7)", () => {
    const lista = [
      ...Array(6).fill({ postawa: "za" }),
      ...Array(4).fill({ postawa: "waha_sie" }),
      ...Array(2).fill({ postawa: "przeciw" }),
    ];
    expect(liczPostawy(lista)).toEqual({ za: 6, wahaSie: 4, przeciw: 2, nieWiadomo: 0, wszyscy: 12, prog: 7, brakuje: 1 });
  });

  it("nieznane postawy liczy osobno, brakuje nigdy poniżej zera", () => {
    const r = liczPostawy([{ postawa: "za" }, { postawa: "za" }, { postawa: null }]);
    expect(r).toMatchObject({ nieWiadomo: 1, prog: 2, brakuje: 0 });
  });
});
