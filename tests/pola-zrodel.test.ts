import { describe, expect, it } from "vitest";
import { personalizuj, polaBezDanych, polaTestowe, polaZrodel, tematAwaryjny } from "@/lib/personalizacja";
import { kontrolaWiadomosci } from "@/lib/kontrola";

/** K1 (27.10): kampania z własną listą wysyłała maile z pustym tematem, bo AI używało {okreg}. */
describe("pola personalizacji według źródeł", () => {
  it("własna lista ma tylko imię i nazwisko, Sejm dodaje okręg i głosowanie", () => {
    expect(polaZrodel(["wlasna_lista"])).toEqual(["imie", "nazwisko"]);
    expect(polaZrodel(["sejm"])).toEqual(["imie", "nazwisko", "okreg", "glosowanie"]);
    expect(polaZrodel(["samorzady"])).toEqual(["imie", "nazwisko", "okreg", "wojewodztwo"]);
    expect(polaZrodel(["wlasna_lista"], "sympatyk")).toContain("gmina");
  });

  it("wykrywa pole bez danych w temacie i treści", () => {
    expect(polaBezDanych("Przejścia w {okreg}\nPiszę do {nazwisko}", ["imie", "nazwisko"])).toEqual(["okreg"]);
    expect(polaBezDanych("Dzień dobry {imie}", ["imie", "nazwisko"])).toEqual([]);
  });

  it("kontrola ostrzega o polu bez danych tylko, gdy zna dostępne pola", () => {
    const w = { temat: "Przejścia przy szkołach w {okreg}", tresc: "Dzień dobry, piszemy w sprawie przejść.", krok: 0 };
    const zWlasnaLista = kontrolaWiadomosci(w, "", "pl", ["imie", "nazwisko"]);
    expect(zWlasnaLista.some((u) => u.opis.includes("{okreg}") && u.opis.includes("nie ma danych"))).toBe(true);
    const zSejmem = kontrolaWiadomosci(w, "", "pl", ["imie", "nazwisko", "okreg", "glosowanie"]);
    expect(zSejmem.some((u) => u.opis.includes("nie ma danych"))).toBe(false);
    expect(kontrolaWiadomosci(w, "").some((u) => u.opis.includes("nie ma danych"))).toBe(false);
  });

  it("test na własny adres podstawia tylko pola, które odbiorcy mają", () => {
    expect(polaTestowe(["wlasna_lista"])).toEqual({ imie: "Andrzej", nazwisko: "Adamczyk" });
    expect(polaTestowe(["sejm"]).okreg).toBe("Kraków");
    // Tak wygląda prawdziwa wysyłka z własnej listy: temat z {okreg} jest pusty.
    expect(personalizuj("Przejścia w {okreg}", polaTestowe(["wlasna_lista"]))).toBe("");
  });

  it("temat awaryjny na stronie akcji: bez pola, a gdy nic nie zostaje, nazwa kampanii", () => {
    expect(tematAwaryjny("Przejścia przy szkołach w {okreg}", "Kampania")).toBe("Przejścia przy szkołach w");
    expect(tematAwaryjny("{okreg}: trzy szkoły", "Kampania")).toBe("trzy szkoły");
    expect(tematAwaryjny("", "Kampania")).toBe("Kampania");
    expect(tematAwaryjny("Sprawa, {okreg}", "Kampania")).toBe("Sprawa");
  });
});
