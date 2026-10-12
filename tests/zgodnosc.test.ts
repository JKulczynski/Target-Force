import { describe, expect, it } from "vitest";
import { ocenZgodnosc } from "@/lib/zgodnosc";
import { pusteOswiadczenie, sprawdzOswiadczenie, stopkaNadawcy, type TrescOswiadczenia } from "@/lib/oswiadczenie";

const DZIS = new Date("2026-10-12T12:00:00Z");
const pelne = (z: Partial<TrescOswiadczenia> = {}): TrescOswiadczenia => ({
  ...pusteOswiadczenie(),
  zleceniodawca: "Fundacja Test",
  osoba: "Jan Testowy",
  email: "jan@test.pl",
  potwierdzenia: { prawdziwe: true, jawnosc: true, lobbing: true, pe: true, odmowa: true },
  zgodaStopka: true,
  ...z,
});

describe("ocenZgodnosc", () => {
  it("fundacja ze środków własnych do Sejmu: poza zakresem, 3 obowiązki bazowe", () => {
    const w = ocenZgodnosc(pelne(), DZIS);
    expect(w.status).toBe("poza_zakresem");
    expect(w.obowiazki).toEqual(["stopka", "wypisanie", "redakcja"]);
    expect(w.powody).toEqual([]);
  });
  it("na zlecenie innego podmiotu: dozwolone po obowiązkach (ujawnienie + rejestr MSWiA)", () => {
    const w = ocenZgodnosc(pelne({ rola: "zlecenie", naZlecenieKogo: "Izba X", zrodloOpis: "Izba X" }), DZIS);
    expect(w.status).toBe("dozwolone_po_obowiazkach");
    expect(w.obowiazki).toContain("ujawnij_zleceniodawce");
    expect(w.obowiazki).toContain("rejestr_mswia");
  });
  it("odbiorcy w PE: obowiązek Rejestru Przejrzystości", () => {
    const w = ocenZgodnosc(pelne({ krajOdbiorcow: "pe" }), DZIS);
    expect(w.status).toBe("dozwolone_po_obowiazkach");
    expect(w.obowiazki).toContain("rejestr_ue");
  });
  it("grant bez opisu: zablokowane do uzupełnienia", () => {
    const w = ocenZgodnosc(pelne({ zrodlo: "grant" }), DZIS);
    expect(w.status).toBe("zablokowane_do_uzupelnienia");
    expect(w.powody).toEqual(["brak_opisu"]);
  });
  it("spółka bez NIP: zablokowane", () => {
    expect(ocenZgodnosc(pelne({ formaPrawna: "spółka" }), DZIS).powody).toContain("brak_nip");
  });
  it("siedziba poza UE + wybory: niedozwolone lub prawnik", () => {
    const w = ocenZgodnosc(pelne({ siedzibaPozaUE: true, wybory: "tak", wyboryData: "2027-05-01" }), DZIS);
    expect(w.status).toBe("niedozwolone_lub_prawnik");
    expect(w.powody).toContain("spoza_ue_wybory");
  });
  it("komercyjny zleceniodawca w 90 dni przed wyborami: prawnik; pół roku wcześniej: tylko obowiązki", () => {
    const blisko = ocenZgodnosc(
      pelne({ zrodlo: "komercyjny", zrodloOpis: "Firma Y", nipKrs: "123", wybory: "tak", wyboryData: "2026-12-01" }),
      DZIS,
    );
    expect(blisko.status).toBe("niedozwolone_lub_prawnik");
    const daleko = ocenZgodnosc(
      pelne({ zrodlo: "komercyjny", zrodloOpis: "Firma Y", nipKrs: "123", wybory: "tak", wyboryData: "2027-06-01" }),
      DZIS,
    );
    expect(daleko.status).toBe("dozwolone_po_obowiazkach");
    expect(daleko.obowiazki).toContain("nota_wyborcza");
  });
  it("odbiorcy w innym kraju: prawnik, bo nie ma profilu", () => {
    expect(ocenZgodnosc(pelne({ krajOdbiorcow: "inny" }), DZIS).status).toBe("niedozwolone_lub_prawnik");
  });
  it("twardy przypadek wygrywa z brakami", () => {
    const w = ocenZgodnosc(pelne({ krajOdbiorcow: "inny", zrodlo: "grant" }), DZIS);
    expect(w.status).toBe("niedozwolone_lub_prawnik");
    expect(w.powody).toEqual(["brak_opisu", "kraj_inny"]);
  });
});

describe("sprawdzOswiadczenie (wersja 2)", () => {
  it("pełne oświadczenie przechodzi", () => {
    expect(sprawdzOswiadczenie(pelne())).toBeNull();
  });
  it("wybory tak bez daty: błąd", () => {
    expect(sprawdzOswiadczenie(pelne({ wybory: "tak" }))).toBe("Podaj datę wyborów albo referendum.");
  });
  it("spółka bez NIP: błąd", () => {
    expect(sprawdzOswiadczenie(pelne({ formaPrawna: "spółka" }))).toBe("Podaj NIP albo KRS.");
  });
  it("bez zgody na stopkę: błąd", () => {
    expect(sprawdzOswiadczenie(pelne({ zgodaStopka: false }))).toBe("Zaznacz zgodę na stopkę nadawcy.");
  });
});

describe("stopkaNadawcy", () => {
  it("po polsku dla odbiorców w PL", () => {
    expect(stopkaNadawcy(pelne())).toBe(
      "Kampanię prowadzi Fundacja Test (fundacja), finansowanie: Środki własne organizacji. Kontakt: Jan Testowy, jan@test.pl.",
    );
  });
  it("po angielsku dla PE, z informacją o zleceniodawcy", () => {
    expect(stopkaNadawcy(pelne({ krajOdbiorcow: "pe", rola: "zlecenie", naZlecenieKogo: "Izba X" }))).toBe(
      "This campaign is run by Fundacja Test (foundation), funded from: The organisation's own funds. On behalf of: Izba X. Contact: Jan Testowy, jan@test.pl.",
    );
  });
});
