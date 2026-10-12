import { describe, expect, it } from "vitest";
import { ciemniej, oczyscWyglad, stylKoloru } from "@/lib/wyglad";

describe("oczyscWyglad", () => {
  it("przepuszcza poprawne pola", () => {
    expect(
      oczyscWyglad({ obraz: "https://x.supabase.co/a.png", kolor: "#AA3366", cel: "500", przycisk: "  Wyślij  ", uklad: "obraz" }),
    ).toEqual({ obraz: "https://x.supabase.co/a.png", kolor: "#aa3366", cel: 500, przycisk: "Wyślij", uklad: "obraz" });
  });
  it("odrzuca niebezpieczne i błędne wartości", () => {
    expect(
      oczyscWyglad({ obraz: "javascript:alert(1)", logo: "http://x.pl/a.png", kolor: "red", cel: -3, uklad: "inny" }),
    ).toEqual({});
  });
  it("radzi sobie z null i śmieciami", () => {
    expect(oczyscWyglad(null)).toEqual({});
    expect(oczyscWyglad("x")).toEqual({});
  });
});

describe("kolor", () => {
  it("ciemniejszy odcień do hover", () => {
    expect(ciemniej("#ffffff")).toBe("#d9d9d9");
  });
  it("bez koloru nie nadpisuje motywu", () => {
    expect(stylKoloru()).toEqual({});
    expect(stylKoloru("#112233")["--color-brand-600"]).toBe("#112233");
  });
});
