/**
 * Wskazówki prawne przy pisaniu wiadomości (14.10). Reguły wyłapują zdania, które mogą rodzić ryzyko prawne;
 * cytat przepisu serwer dobiera na żywo z aktualnego tekstu ustawy (lib/cytaty.ts, sejmdiff.pl).
 * To podpowiedź dla człowieka, nie opinia prawna i nie blokada. Reguły celowo szerokie: lepiej jedno
 * zbędne pytanie niż przeoczona obietnica korzyści. Lobbing jako taki zależy od tego, kto i dla kogo działa,
 * nie od treści zdania, więc pilnuje go oświadczenie zleceniodawcy (lib/zgodnosc.ts), nie te reguły.
 */
export type Zrodlo = { eli: string; art: string; skrot: string } | { wewnetrzne: string };

export type Regula = {
  id: string;
  wzor: RegExp;
  /** Tylko dla wiadomości organizacji (nie dla wariantów mieszkańca ze strony akcji). */
  tylkoOrganizacja?: boolean;
  tytul: string;
  wyjasnienie: string;
  zrodla: Zrodlo[];
};

export const KK = "DU/1997/553";
export const KW = "DU/2011/112";

export const REGULY: Regula[] = [
  {
    id: "korzysc",
    wzor: /\b(w zamian|odwdzięcz\w*|prezent\w*|upomin\w*|darowizn\w*|wynagrodzeni\w*|honorari\w*|sfinansuj\w*|pokryjemy|opłacimy|zaprasza\w* (pana|panią|państwa) na (wyjazd|kolacj\w*|obiad|wycieczk\w*))/i,
    tytul: "Czy to nie brzmi jak obietnica korzyści?",
    wyjasnienie:
      "Obiecanie posłowi albo urzędnikowi korzyści majątkowej lub osobistej w związku z jego funkcją to przestępstwo, nawet gdy korzyść jest drobna. Jeśli zdanie mówi o czymś innym (np. o darowiznach jako temacie ustawy), zostaw je; jeśli coś oferuje odbiorcy, usuń.",
    zrodla: [{ eli: KK, art: "229 § 1", skrot: "k.k." }],
  },
  {
    id: "grozba",
    wzor: /(jeśli|jeżeli|w przeciwnym razie|inaczej|bo inaczej)[^.!?]{0,100}(ujawnimy|nagłośnimy|upublicznimy|opublikujemy|zawiadomimy|złożymy (doniesienie|zawiadomienie)|pozwiemy|poniesie (pan|pani) konsekwencj\w*|pożałuje)/i,
    tytul: "Czy to nie brzmi jak groźba?",
    wyjasnienie:
      "Wymuszanie decyzji groźbą bezprawną (także groźbą rozgłoszenia uwłaczających informacji albo wszczęcia postępowania) jest przestępstwem. Zapowiedź zawiadomienia organów tylko w obronie prawa naruszonego przestępstwem groźbą nie jest. Bezpieczniej: opisz skutki sprawy i poproś o działanie, bez „jeśli nie, to...”.",
    zrodla: [
      { eli: KK, art: "191 § 1", skrot: "k.k." },
      { eli: KK, art: "115 § 12", skrot: "k.k." },
    ],
  },
  {
    id: "agitacja",
    wzor: /(zagłosuj\w*|głosuj(cie)?\b|nie głosuj\w*|oddaj(cie)? głos|nie wybieraj\w*|na kogo głosować|przy urnie|w najbliższych wyborach)/i,
    tytul: "Czy to nie jest agitacja wyborcza?",
    wyjasnienie:
      "Publiczne nakłanianie do głosowania w określony sposób to agitacja wyborcza: wolno ją prowadzić tylko w kampanii wyborczej, przez komitet, i nigdy w ciszy wyborczej (dzień głosowania i 24 godziny przed nim). Mail do jednego posła nie jest publiczny, ale strona akcji i maile do sympatyków już są.",
    zrodla: [
      { eli: KW, art: "105 § 1", skrot: "Kodeks wyborczy" },
      { eli: KW, art: "107 § 1", skrot: "Kodeks wyborczy" },
    ],
  },
  {
    id: "podszywanie",
    wzor: /(jako (zwykł[ya]|szeregow[ya]|zwyczajn[ya]) (mieszkan\w*|obywatel\w*)|piszę prywatnie|nikt mi nie płaci|z własnej inicjatywy|nie reprezentuję żadnej|oddoln\w* inicjatyw\w*)/i,
    tylkoOrganizacja: true,
    tytul: "Wiadomość organizacji nie może udawać mieszkańca",
    wyjasnienie:
      "Tę wiadomość wysyła organizacja, a stopka pokazuje zleceniodawcę i finansowanie. Zdanie sugerujące, że pisze prywatna osoba albo oddolna inicjatywa, wprowadza odbiorcę w błąd i łamie regulamin. Głos mieszkańców zbiera strona akcji, gdzie piszą prawdziwi ludzie w swoim imieniu.",
    zrodla: [{ wewnetrzne: "Regulamin WinOver, pkt 4: zakaz podszywania się, ukrywania zleceniodawcy i udawania oddolnej inicjatywy" }],
  },
];

export type Trafienie = { regula: Regula; fragment: string };

/** Zdanie (albo jego kawałek) wokół trafienia, do pokazania przy wskazówce. */
function fragmentWokol(tekst: string, start: number, koniec: number): string {
  const przed = tekst.lastIndexOf(".", start);
  const poKropce = tekst.slice(koniec).search(/[.!?\n]/);
  const od = przed === -1 ? 0 : przed + 1;
  const doo = poKropce === -1 ? tekst.length : koniec + poKropce + 1;
  const zdanie = tekst.slice(od, doo).trim();
  return zdanie.length > 220 ? `${zdanie.slice(0, 217)}...` : zdanie;
}

export function wykryj(tekst: string, rola: "nadawca" | "sympatyk" = "nadawca"): Trafienie[] {
  const wynik: Trafienie[] = [];
  for (const r of REGULY) {
    if (r.tylkoOrganizacja && rola !== "nadawca") continue;
    const m = r.wzor.exec(tekst);
    if (m) wynik.push({ regula: r, fragment: fragmentWokol(tekst, m.index, m.index + m[0].length) });
  }
  return wynik;
}

/** Numery artykułów, na które powołuje się wiadomość ("art. 83f", "art. 12 ust. 2"). */
export function powolaniaNaArtykuly(tekst: string): string[] {
  const numery = [...tekst.matchAll(/\bart\.\s*(\d+[a-z]{0,2})\b/gi)].map((m) => m[1].toLowerCase());
  return [...new Set(numery)].slice(0, 5);
}
