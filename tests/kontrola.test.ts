import { describe, expect, it } from "vitest";
import { kontrolaWiadomosci } from "@/lib/kontrola";

const fakty = "Kampania o przejściach. Pod petycją 412 osób. Autobus 12 o 7:20.";

describe("kontrolaWiadomosci", () => {
  it("nie zgłasza faktów ani szablonów dla czystej wiadomości z liczbami z materiałów", () => {
    const uwagi = kontrolaWiadomosci(
      {
        temat: "Przejścia przy szkołach w {okreg}",
        tresc:
          "Dzień dobry,\n\nod września dzieci idą do szkoły przez nieoświetlone przejście. Pod petycją podpisało się 412 osób. Czy mogłaby Pani zapytać ZTM o kurs o 7:20?\n\nZ poważaniem,\nAnna Kowalska",
        krok: 0,
      },
      fakty,
    );
    // Krótki tekst testowy łapie tylko ostrzeżenie o długości; faktów i szablonów ma nie być.
    expect(uwagi.filter((u) => u.rodzaj !== "styl" || !/słów/.test(u.opis))).toEqual([]);
  });

  it("łapie liczbę spoza materiałów", () => {
    const uwagi = kontrolaWiadomosci(
      { temat: "Temat zwykły", tresc: "Dzień dobry,\n\nw programie jest 12 000 zł na przejścia.\n\nZ poważaniem", krok: 0 },
      fakty,
    );
    expect(uwagi.some((u) => u.rodzaj === "fakt" && /12000|12 000/.test(u.opis))).toBe(true);
  });

  it("łapie zdanie-szablon i długi myślnik", () => {
    const uwagi = kontrolaWiadomosci(
      {
        temat: "Temat",
        tresc: `Dzień dobry,\n\nzwracam się do Pana z uprzejmą prośbą ${String.fromCharCode(0x2014)} sprawa ma kluczowe znaczenie.\n\nZ poważaniem`,
        krok: 0,
      },
      fakty,
    );
    const opisy = uwagi.map((u) => u.opis).join(" ");
    expect(opisy).toMatch(/zwracam się|kluczowe znaczenie/i);
    expect(uwagi.some((u) => u.rodzaj === "styl")).toBe(true);
  });

  it("łapie puste otwarcie przypomnienia", () => {
    const uwagi = kontrolaWiadomosci(
      { temat: "Re: Temat", tresc: "Dzień dobry,\n\nwracam do mojej wiadomości sprzed tygodnia.\n\nZ poważaniem", krok: 1 },
      fakty,
    );
    expect(uwagi.some((u) => /otwarcie|wracam/i.test(u.opis))).toBe(true);
  });

  it("łapie nieznane pole personalizacji", () => {
    const uwagi = kontrolaWiadomosci({ temat: "T", tresc: "Dzień dobry {posel},\n\nsprawa.\n\nZ poważaniem", krok: 0 }, fakty);
    expect(uwagi.some((u) => /pol/i.test(u.opis))).toBe(true);
  });
});
