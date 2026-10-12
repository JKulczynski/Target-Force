import type { TrescOswiadczenia } from "@/lib/oswiadczenie";

/**
 * Silnik reguł zgodności (legal etap 1, 12.10): z treści oświadczenia liczy jeden z czterech statusów
 * z propozycji Piotra (08.10) i listę obowiązków. Czysta funkcja, bez AI, bez bazy. Decyzja o kampanii
 * nadal należy do zespołu (zgoda_zespolu); silnik podpowiada i wymaga powodu przy akceptacji "niedozwolone".
 * Każda reguła ma w komentarzu przepis, żeby prawnik mógł ją przeczytać i poprawić.
 */
export type StatusZgodnosci =
  | "poza_zakresem"
  | "dozwolone_po_obowiazkach"
  | "zablokowane_do_uzupelnienia"
  | "niedozwolone_lub_prawnik";

export type Obowiazek =
  | "stopka" // stopka nadawcy w mailach organizacji i na stronie akcji (jawność zleceniodawcy)
  | "wypisanie" // link wypisania w każdym mailu (List-Unsubscribe, RFC 8058; jest w wysyłce)
  | "redakcja" // każdą wiadomość AI zatwierdza człowiek (AI Act art. 50 ust. 4: wyjątek przy odpowiedzialności redakcyjnej)
  | "ujawnij_zleceniodawce" // działanie na zlecenie albo za pieniądze podmiotu trzeciego: nazwa zleceniodawcy w stopce
  | "rejestr_mswia" // ustawa z 7.07.2005 o działalności lobbingowej: zawodowy lobbing wymaga wpisu do rejestru MSWiA
  | "rejestr_ue" // odbiorcy w Parlamencie Europejskim: Rejestr Przejrzystości UE
  | "program_w_stopce" // grant albo środki publiczne: nazwa programu w stopce
  | "nota_wyborcza"; // sprawa związana z wyborami: rozp. (UE) 2024/900 (etykieta i nota przejrzystości, jeśli to reklama polityczna)

export type PowodZgodnosci =
  | "spoza_ue_wybory" // rozp. (UE) 2024/900 art. 16: zakaz sponsorowania reklamy politycznej z państw trzecich przed wyborami
  | "komercyjny_wybory_90" // płatna kampania w interesie podmiotu trzeciego w 90 dni przed wyborami: opinia prawnika
  | "kraj_inny" // brak profilu prawnego dla odbiorców spoza PL / PE / NL
  | "brak_opisu"
  | "brak_nip"
  | "brak_daty_wyborow"
  | "brak_osoby";

export type WynikZgodnosci = {
  status: StatusZgodnosci;
  obowiazki: Obowiazek[];
  powody: PowodZgodnosci[];
  /** Data oceny (ISO), żeby reguła "90 dni" była odtwarzalna. */
  ocenione: string;
};

export const OBOWIAZKI_BAZOWE: Obowiazek[] = ["stopka", "wypisanie", "redakcja"];
const TWARDE: PowodZgodnosci[] = ["spoza_ue_wybory", "komercyjny_wybory_90", "kraj_inny"];
const DZIEN_MS = 24 * 60 * 60 * 1000;

export function ocenZgodnosc(t: TrescOswiadczenia, dzis: Date = new Date()): WynikZgodnosci {
  const obowiazki: Obowiazek[] = [...OBOWIAZKI_BAZOWE];
  const powody: PowodZgodnosci[] = [];
  const naZlecenie = t.rola === "zlecenie" || t.zrodlo === "komercyjny" || t.platneNaRzeczTrzeciego === true;
  const wybory = t.wybory === "tak";
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(t.wyboryData ?? "");
  const dniDoWyborow =
    wybory && dataOk ? Math.round((new Date(t.wyboryData!).getTime() - dzis.getTime()) / DZIEN_MS) : null;

  // Braki (zablokowane do uzupełnienia)
  const opisWymagany = t.rola === "zlecenie" || ["grant", "komercyjny", "inne"].includes(t.zrodlo);
  if (opisWymagany && !t.zrodloOpis?.trim()) powody.push("brak_opisu");
  if ((t.formaPrawna === "spółka" || t.zrodlo === "komercyjny") && !t.nipKrs?.trim()) powody.push("brak_nip");
  if (wybory && !dataOk) powody.push("brak_daty_wyborow");
  if (!t.osoba?.trim() || !t.email?.trim()) powody.push("brak_osoby");
  const braki = powody.length > 0;

  // Twarde przypadki (niedozwolone albo prawnik)
  if (t.siedzibaPozaUE && wybory) powody.push("spoza_ue_wybory");
  if (naZlecenie && dniDoWyborow !== null && dniDoWyborow >= 0 && dniDoWyborow <= 90)
    powody.push("komercyjny_wybory_90");
  if (t.krajOdbiorcow === "inny") powody.push("kraj_inny");
  const twarde = powody.some((p) => TWARDE.includes(p));

  // Obowiązki zależne od odpowiedzi
  if (naZlecenie) obowiazki.push("ujawnij_zleceniodawce", "rejestr_mswia");
  if (t.krajOdbiorcow === "pe") obowiazki.push("rejestr_ue");
  if (t.zrodlo === "grant" || t.zrodlo === "publiczne") obowiazki.push("program_w_stopce");
  if (wybory) obowiazki.push("nota_wyborcza");

  const status: StatusZgodnosci = twarde
    ? "niedozwolone_lub_prawnik"
    : braki
      ? "zablokowane_do_uzupelnienia"
      : obowiazki.length > OBOWIAZKI_BAZOWE.length
        ? "dozwolone_po_obowiazkach"
        : "poza_zakresem";
  return { status, obowiazki, powody, ocenione: dzis.toISOString() };
}
