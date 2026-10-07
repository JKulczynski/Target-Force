import { describe, expect, it } from "vitest";
import { etykietaGminy, gminaPoTeryt, GMINY, nazwaGminyDoTekstu, POPRAWNY_SLUG, slugZNazwy, terytPowiatu, youtubeId } from "@/lib/akcja";

describe("slugZNazwy", () => {
  it("zamienia polskie znaki i spacje", () => {
    expect(slugZNazwy("Przejścia przy szkołach: Łódź 2026")).toBe("przejscia-przy-szkolach-lodz-2026");
    expect(POPRAWNY_SLUG.test(slugZNazwy("Przejścia przy szkołach"))).toBe(true);
  });
  it("obcina do 60 znaków i nie zostawia myślników na końcach", () => {
    expect(slugZNazwy("  --a--  ")).toBe("a");
    expect(slugZNazwy("x".repeat(100))).toHaveLength(60);
  });
});

describe("youtubeId", () => {
  it("rozpoznaje popularne formaty", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=KP6g_3iZDro")).toBe("KP6g_3iZDro");
    expect(youtubeId("https://youtu.be/KP6g_3iZDro")).toBe("KP6g_3iZDro");
    expect(youtubeId("https://www.youtube.com/shorts/abc123")).toBe("abc123");
  });
  it("zwraca null dla innych adresów i śmieci", () => {
    expect(youtubeId("https://example.com/film")).toBeNull();
    expect(youtubeId("nie adres")).toBeNull();
  });
});

describe("gminy i okręgi", () => {
  it("ma komplet gmin z okręgiem 1-41", () => {
    expect(GMINY.length).toBeGreaterThan(2400);
    expect(GMINY.every((g) => g.o >= 1 && g.o <= 41)).toBe(true);
  });
  it("Kraków miasto to okręg 13, dzielnice Warszawy to 19", () => {
    const krakow = GMINY.find((g) => g.n === "Kraków" && g.typ === "Miasto na prawach powiatu")!;
    expect(krakow.o).toBe(13);
    expect(GMINY.filter((g) => g.typ === "dzielnica").every((g) => g.o === 19)).toBe(true);
  });
  it("etykiety i powiat", () => {
    const bemowo = GMINY.find((g) => g.n === "Bemowo")!;
    expect(etykietaGminy(bemowo)).toBe("Warszawa, Bemowo");
    expect(nazwaGminyDoTekstu(bemowo)).toBe("Warszawa");
    const boleslawiec = gminaPoTeryt("0201011")!;
    expect(terytPowiatu(boleslawiec)).toBe("0201000");
  });
});
