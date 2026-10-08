import { POLA } from "@/lib/personalizacja";
import { tlumacz, type Jezyk } from "@/lib/i18n";

/**
 * Automatyczna kontrola wygenerowanej wiadomości przed zatwierdzeniem.
 * Lekcja z Explee (06.10): AI dopisuje fakty spoza materiałów i wraca do zdań-szablonów mimo zakazów,
 * więc każdy podgląd trzeba sprawdzać. Tu robimy to mechanicznie. Wynik to ostrzeżenia, nie blokada.
 */
export type Uwaga = { rodzaj: "fakt" | "styl" | "technika"; opis: string };

// Zdania-szablony i puste otwarcia (zob. lib/prompty/pisanie.ts).
const FRAZY = [
  "zwracam się do pana",
  "zwracam się do pani",
  "zwracam się z uprzejmą prośbą",
  "jako posła z okręgu",
  "jako posłankę z okręgu",
  "mam nadzieję, że ta wiadomość",
  "kluczowe znaczenie",
  "istotny aspekt",
  "warto podkreślić",
  "nie sposób przecenić",
  "kompleksow",
  "w dzisiejszych czasach",
  "nie możemy pozostać obojętni",
  "historyczny moment",
  "głęboko wierzymy",
  "z góry dziękuję",
  "pozytywne rozpatrzenie",
  "nie tylko",
  "pozdrawiam serdecznie",
  "nie otrzymałem odpowiedzi",
  "nie otrzymałam odpowiedzi",
  "ponawiam prośbę",
];

// Puste otwarcia przypomnień ("Quick follow-up" po polsku).
const PUSTE_OTWARCIE =
  /^(wracam|nawiązuj|nawiazuj|przypominam|ponawiam|piszę ponownie|pisze ponownie|pisałem|pisałam|kilka dni temu|niedawno pisał)/i;

// Długi myślnik (U+2014), zapisany kodem, żeby nie pojawiał się w źródle.
const DLUGI_MYSLNIK = String.fromCharCode(0x2014);

/** Liczby zapisane w tekście, znormalizowane ("12 000" -> "12000", "30%" -> "30"). */
function liczby(tekst: string): string[] {
  const wynik = tekst.match(/\d[\d\s.,]*\d|\d/g) ?? [];
  return wynik
    .map((l) => l.replace(/[\s.]/g, "").replace(",", "."))
    .filter((l) => l.length > 0);
}

function slowa(tekst: string): number {
  return tekst.split(/\s+/).filter(Boolean).length;
}

/** Pierwszy akapit po zwrocie grzecznościowym. */
function otwarcie(tresc: string): string {
  const akapity = tresc
    .split(/\n\s*\n/)
    .map((a) => a.trim())
    .filter(Boolean);
  const poZwrocie =
    akapity.length > 1 && slowa(akapity[0]) <= 6 ? akapity[1] : akapity[0];
  return poZwrocie ?? "";
}

export function kontrolaWiadomosci(
  w: { temat: string; tresc: string; krok: number },
  fakty: string,
  jezyk: Jezyk = "pl",
): Uwaga[] {
  const t = tlumacz(jezyk);
  const uwagi: Uwaga[] = [];
  const caly = `${w.temat}\n${w.tresc}`;
  const male = caly.toLowerCase();

  // 1. Liczby, których nie ma w celu ani materiałach kampanii.
  const znane = new Set(liczby(fakty));
  const obce = [
    ...new Set(
      liczby(caly.replace(/\{[^}]*\}/g, "")).filter(
        (l) => l.length > 1 && !znane.has(l),
      ),
    ),
  ];
  if (obce.length)
    uwagi.push({ rodzaj: "fakt", opis: t("kontrola.liczby", { liczby: obce.join(", ") }) });

  // 2. Zdania-szablony.
  const szablony = FRAZY.filter((f) => male.includes(f));
  if (szablony.length)
    uwagi.push({ rodzaj: "styl", opis: t("kontrola.szablony", { zwroty: szablony.join("”, „") }) });

  // 3. Przypomnienie zaczyna się od przypominania zamiast od nowej rzeczy.
  if (w.krok > 0 && PUSTE_OTWARCIE.test(otwarcie(w.tresc)))
    uwagi.push({ rodzaj: "styl", opis: t("kontrola.otwarcie") });

  // 4. Długość.
  const n = slowa(w.tresc);
  if (w.krok === 0 && (n < 90 || n > 220))
    uwagi.push({ rodzaj: "styl", opis: t("kontrola.slowaPierwsza", { n }) });
  if (w.krok > 0 && n > 110)
    uwagi.push({ rodzaj: "styl", opis: t("kontrola.slowaPrzypomnienie", { n }) });

  // 5. Kilka pytań naraz rozmywa prośbę.
  const pytania = (w.tresc.match(/\?/g) ?? []).length;
  if (pytania > 2)
    uwagi.push({ rodzaj: "styl", opis: t("kontrola.pytania", { n: pytania }) });

  // 6. Technika: nieznane pola, nawiasy do uzupełnienia, długi myślnik.
  const pola = [...caly.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
  const nieznane = pola.filter((p) => !(POLA as readonly string[]).includes(p));
  if (nieznane.length)
    uwagi.push({
      rodzaj: "technika",
      opis: t("kontrola.nieznanePola", {
        pola: `{${[...new Set(nieznane)].join("}, {")}}`,
        dostepne: `{${POLA.join("}, {")}}`,
      }),
    });
  if (/\[[^\]]{2,40}\]/.test(caly))
    uwagi.push({ rodzaj: "technika", opis: t("kontrola.nawias") });
  if (caly.includes(DLUGI_MYSLNIK))
    uwagi.push({ rodzaj: "technika", opis: t("kontrola.myslnik") });

  return uwagi;
}
