import { describe, expect, it } from "vitest";
import { wariantDla, type Wariant } from "@/lib/wysylka-serwer";

const w = (numer: number, dla_klubu: string | null = null): Wariant => ({ id: String(numer), krok: 0, numer, temat: "", tresc: "", dla_klubu });

describe("wersja wiadomości dla klubu", () => {
  const lista = [w(1), w(2), w(3, "KO"), w(4, "PiS")];
  it("poseł klubu z własną wersją dostaje tylko ją", () => {
    expect(wariantDla(lista, "KO", 0).numer).toBe(3);
    expect(wariantDla(lista, "KO", 5).numer).toBe(3);
  });
  it("poseł innego klubu dostaje wersje ogólne po kolei", () => {
    expect([0, 1, 2].map((n) => wariantDla(lista, "PSL", n).numer)).toEqual([1, 2, 1]);
  });
  it("bez wersji ogólnych: wszystkie", () => {
    expect(wariantDla([w(3, "KO")], "PSL", 0).numer).toBe(3);
  });
});
