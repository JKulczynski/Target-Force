import { resolveTxt } from "node:dns/promises";

/**
 * Sprawdzenie, czy domena nadawcy jest gotowa do wysyłki: SPF, DKIM, DMARC.
 * Od 2024 Gmail i Yahoo odrzucają albo wrzucają do spamu masowe maile z domen bez tych rekordów.
 */

export type Swiatlo = "ok" | "slabe" | "brak";

export type WynikDomeny = {
  domena: string;
  spf: { stan: Swiatlo; rekord: string | null; uwaga: string };
  dkim: { stan: Swiatlo; selektor: string | null; uwaga: string };
  dmarc: { stan: Swiatlo; rekord: string | null; uwaga: string };
};

// DKIM nie da się wylistować, trzeba znać selektor. Sprawdzamy najczęstsze u dużych dostawców.
const SELEKTORY = [
  "google", "20251104", "20230601", "20221208", "20210112", // Google Workspace i Gmail (klucze rotują)
  "selector1", "selector2", // Microsoft 365
  "default", "dkim", "mail", "k1", "k2", "s1", "s2", "smtp", "mx", // hostingi, Mailchimp, SendGrid itd.
];

async function txt(nazwa: string): Promise<string[]> {
  try {
    const rekordy = await resolveTxt(nazwa);
    return rekordy.map((r) => r.join(""));
  } catch {
    return [];
  }
}

export function oczyscDomene(wejscie: string): string | null {
  const d = wejscie.trim().toLowerCase().replace(/^.*@/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null;
}

export async function sprawdzDomene(domena: string): Promise<WynikDomeny> {
  const [txtDomeny, txtDmarc] = await Promise.all([txt(domena), txt(`_dmarc.${domena}`)]);

  const spfRekord = txtDomeny.find((r) => r.toLowerCase().startsWith("v=spf1")) ?? null;
  const spf: WynikDomeny["spf"] = !spfRekord
    ? { stan: "brak", rekord: null, uwaga: "Brak rekordu SPF. Serwery odbiorców nie wiedzą, kto może wysyłać z tej domeny." }
    : /[~-]all\b|\bredirect=/.test(spfRekord)
      ? { stan: "ok", rekord: spfRekord, uwaga: "SPF ustawiony." }
      : { stan: "slabe", rekord: spfRekord, uwaga: "SPF jest, ale kończy się zbyt pobłażliwie (brak ~all lub -all)." };

  const dmarcRekord = txtDmarc.find((r) => r.toLowerCase().startsWith("v=dmarc1")) ?? null;
  const polityka = dmarcRekord?.match(/\bp=(\w+)/i)?.[1]?.toLowerCase();
  const dmarc: WynikDomeny["dmarc"] = !dmarcRekord
    ? { stan: "brak", rekord: null, uwaga: "Brak DMARC. Gmail wymaga go od nadawców wysyłających więcej maili." }
    : polityka === "none"
      ? { stan: "slabe", rekord: dmarcRekord, uwaga: "DMARC jest w trybie obserwacji (p=none). Wystarczy na start, docelowo quarantine albo reject." }
      : { stan: "ok", rekord: dmarcRekord, uwaga: `DMARC ustawiony (p=${polityka}).` };

  let selektor: string | null = null;
  for (const s of SELEKTORY) {
    const r = await txt(`${s}._domainkey.${domena}`);
    // Pusty klucz (p=) oznacza klucz wycofany, nie liczymy go.
    if (r.some((x) => /(^|;)\s*p=[A-Za-z0-9+/]{20,}/.test(x))) {
      selektor = s;
      break;
    }
  }
  const dkim: WynikDomeny["dkim"] = selektor
    ? { stan: "ok", selektor, uwaga: `Klucz DKIM znaleziony (selektor „${selektor}”).` }
    : {
        stan: "slabe",
        selektor: null,
        uwaga: "Nie znaleziono klucza pod typowymi nazwami. Nie musi to znaczyć, że go nie ma. Potwierdzi to testowy mail.",
      };

  return { domena, spf, dkim, dmarc };
}
