import { describe, expect, it } from "vitest";
import { powolaniaNaArtykuly, wykryj } from "@/lib/wskazowki-prawne";

const ids = (tekst: string, rola: "nadawca" | "sympatyk" = "nadawca") => wykryj(tekst, rola).map((t) => t.regula.id);

describe("wskazówki prawne", () => {
  it("zwykła wiadomość bez wskazówek", () => {
    expect(ids("Dzień dobry, od września autobus 12 nie przyjeżdża. Czy mógłby Pan zapytać ZTM, kiedy wróci kurs?")).toEqual([]);
  });
  it("obietnica korzyści", () => {
    const t = wykryj("Jeśli poprze Pan poprawkę, w zamian zaprosimy Pana na nasz zjazd. Dziękujemy.");
    expect(t.map((x) => x.regula.id)).toContain("korzysc");
    expect(t[0].fragment).toContain("w zamian");
  });
  it("groźba", () => {
    expect(ids("Jeżeli Pan nie zagłosuje za, nagłośnimy w mediach Pana wydatki.")).toContain("grozba");
  });
  it("agitacja", () => {
    expect(ids("Głosujcie w najbliższych wyborach na tych, którzy dbają o szkoły.")).toContain("agitacja");
  });
  it("podszywanie tylko w wiadomości organizacji", () => {
    const tekst = "Piszę jako zwykły mieszkaniec Wawra.";
    expect(ids(tekst, "nadawca")).toContain("podszywanie");
    expect(ids(tekst, "sympatyk")).not.toContain("podszywanie");
  });
  it("powołania na artykuły", () => {
    expect(powolaniaNaArtykuly("Zgodnie z art. 83f ust. 4 oraz Art. 12 i art. 83f")).toEqual(["83f", "12"]);
  });
});
