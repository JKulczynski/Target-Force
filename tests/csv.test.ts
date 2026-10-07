import { describe, expect, it } from "vitest";
import { parsujListe } from "@/lib/csv";

describe("parsujListe", () => {
  it("czyta CSV z nagłówkiem i średnikiem", () => {
    const w = parsujListe("imie;nazwisko;email;organizacja\nJan;Kowalski;jan@teatr.pl;Teatr\nAnna;Nowak;anna@muzeum.pl;Muzeum");
    expect(w.wiersze).toHaveLength(2);
    expect(w.wiersze[0]).toMatchObject({ imie: "Jan", nazwisko: "Kowalski", email: "jan@teatr.pl", organizacja: "Teatr" });
  });

  it("czyta zwykłą wklejkę, jedna osoba w linii", () => {
    const w = parsujListe("Jan Kowalski, jan.kowalski@teatr.pl\nanna.nowak@muzeum.pl");
    expect(w.wiersze.map((x) => x.email)).toEqual(["jan.kowalski@teatr.pl", "anna.nowak@muzeum.pl"]);
  });

  it("pomija linie bez e-maila i liczy duplikaty", () => {
    const w = parsujListe("bez maila\njan@x.pl\nJAN@x.pl\nanna@x.pl");
    expect(w.wiersze).toHaveLength(2);
    expect(w.pominiete).toBe(1);
    expect(w.duplikaty).toBe(1);
  });

  it("obsługuje cudzysłowy z przecinkiem w środku", () => {
    const w = parsujListe('email,organizacja\njan@x.pl,"Fundacja A, B"');
    expect(w.wiersze[0].organizacja).toBe("Fundacja A, B");
  });
});
