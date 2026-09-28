/**
 * Import własnej listy (artyści, szefowie instytucji, dowolni odbiorcy spoza API).
 * Przyjmuje CSV z nagłówkiem albo zwykłą wklejkę: jedna osoba w linii, e-mail gdziekolwiek w linii.
 */

export type WierszListy = {
  imie: string;
  nazwisko: string;
  email: string;
  organizacja: string;
  stanowisko: string;
};

export type WynikImportu = { wiersze: WierszListy[]; pominiete: number; duplikaty: number };

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const KOLUMNY: Record<keyof WierszListy, string[]> = {
  imie: ["imie", "imię", "first name", "firstname", "voornaam"],
  nazwisko: ["nazwisko", "last name", "lastname", "achternaam", "surname"],
  email: ["email", "e-mail", "mail", "adres e-mail"],
  organizacja: ["organizacja", "firma", "instytucja", "company", "organisation", "organization"],
  stanowisko: ["stanowisko", "funkcja", "rola", "title", "position", "functie"],
};

function podziel(linia: string, sep: string): string[] {
  // Prosty parser z obsługą cudzysłowów, wystarczy do eksportów z Excela i Google Sheets.
  const pola: string[] = [];
  let biezace = "";
  let wCudzyslowie = false;
  for (let i = 0; i < linia.length; i++) {
    const z = linia[i];
    if (z === '"') {
      if (wCudzyslowie && linia[i + 1] === '"') {
        biezace += '"';
        i++;
      } else wCudzyslowie = !wCudzyslowie;
    } else if (z === sep && !wCudzyslowie) {
      pola.push(biezace.trim());
      biezace = "";
    } else biezace += z;
  }
  pola.push(biezace.trim());
  return pola;
}

export function parsujListe(tekst: string): WynikImportu {
  const linie = tekst.split(/\r?\n/).filter((l) => l.trim());
  if (linie.length === 0) return { wiersze: [], pominiete: 0, duplikaty: 0 };

  const sep = [";", ",", "\t"].reduce((a, b) =>
    linie[0].split(b).length > linie[0].split(a).length ? b : a,
  );
  const naglowek = podziel(linie[0], sep).map((p) => p.toLowerCase());
  const indeks = Object.fromEntries(
    (Object.keys(KOLUMNY) as (keyof WierszListy)[]).map((k) => [
      k,
      naglowek.findIndex((n) => KOLUMNY[k].includes(n)),
    ]),
  ) as Record<keyof WierszListy, number>;
  const maNaglowek = indeks.email !== -1;

  const widziane = new Set<string>();
  const wiersze: WierszListy[] = [];
  let pominiete = 0;
  let duplikaty = 0;

  for (const linia of maNaglowek ? linie.slice(1) : linie) {
    const pola = podziel(linia, sep);
    let w: WierszListy;
    if (maNaglowek) {
      const pole = (k: keyof WierszListy) => (indeks[k] === -1 ? "" : (pola[indeks[k]] ?? ""));
      w = { imie: pole("imie"), nazwisko: pole("nazwisko"), email: pole("email"), organizacja: pole("organizacja"), stanowisko: pole("stanowisko") };
    } else {
      // Bez nagłówka: e-mail to pole z małpą, reszta to imię i nazwisko.
      const email = pola.find((p) => EMAIL.test(p)) ?? "";
      const reszta = pola.filter((p) => p !== email).join(" ").replace(/[,;]/g, " ").trim().split(/\s+/);
      w = { imie: reszta[0] ?? "", nazwisko: reszta.slice(1).join(" "), email, organizacja: "", stanowisko: "" };
    }
    w.email = w.email.trim().toLowerCase();
    if (!EMAIL.test(w.email)) {
      pominiete++;
      continue;
    }
    if (widziane.has(w.email)) {
      duplikaty++;
      continue;
    }
    widziane.add(w.email);
    wiersze.push(w);
  }
  return { wiersze, pominiete, duplikaty };
}
