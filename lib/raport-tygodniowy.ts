import type { SupabaseClient } from "@supabase/supabase-js";
import { wyslijPrzezWinOver } from "@/lib/poczta-winover";

/**
 * Raport tygodniowy dla klienta (14.10, wzorzec Spaak "recurring deliverables"): w poniedziałek rano każdy
 * członek organizacji dostaje mail z liczbami z ostatnich 7 dni dla kampanii, w których coś się działo,
 * i link do pełnego raportu (PDF przez druk). Agencja może go przekazać swojemu klientowi.
 */
export type Liczby = {
  nazwa: string;
  id: string;
  maile: number;
  klikniecia: number;
  odpowiedzi: number;
  podpisy: number;
  wyslaliMieszkancy: number;
  odpowiedziMerytoryczne: number;
};

export function trescRaportu(organizacja: string, od: string, kampanie: Liczby[], baza: string): string {
  const linie = kampanie.map((k) =>
    [
      `${k.nazwa}`,
      `  maile organizacji: ${k.maile}, kliknięcia w link: ${k.klikniecia}, odpowiedzi decydentów: ${k.odpowiedzi}`,
      `  strona akcji: ${k.podpisy} podpisów, ${k.wyslaliMieszkancy} wiadomości mieszkańców, ${k.odpowiedziMerytoryczne} odpowiedzi w sprawie (wg mieszkańców)`,
      `  pełny raport: ${baza}/kampanie/${k.id}/raport`,
    ].join("\n"),
  );
  return [
    `Dzień dobry,`,
    ``,
    `podsumowanie kampanii organizacji ${organizacja} za tydzień od ${od}:`,
    ``,
    linie.join("\n\n"),
    ``,
    `Raport w PDF: otwórz link i wybierz „Drukuj / zapisz PDF”.`,
    ``,
    `WinOver`,
  ].join("\n");
}

const odDni = (dni: number) => new Date(Date.now() - dni * 86_400_000).toISOString();

export async function wyslijRaportyTygodniowe(admin: SupabaseClient, baza: string): Promise<{ organizacje: number; maile: number }> {
  if (process.env.WYSYLKA_WSTRZYMANA === "1") return { organizacje: 0, maile: 0 };
  const od = odDni(7);
  const { data: organizacje } = await admin.from("organizacje").select("id, nazwa");
  let liczOrg = 0;
  let liczMaile = 0;
  for (const o of organizacje ?? []) {
    const { data: kampanie } = await admin.from("kampanie").select("id, nazwa").eq("organizacja_id", o.id);
    const wynik: Liczby[] = [];
    for (const k of kampanie ?? []) {
      const [{ data: wiad }, podpisy, wyslali, merytoryczne, odpowiedzi] = await Promise.all([
        admin.from("wiadomosci").select("id").eq("kampania_id", k.id).gte("wyslana", od).limit(10000),
        admin.from("podpisy").select("id", { count: "exact", head: true }).eq("kampania_id", k.id).gte("utworzony", od),
        admin.from("podpisy").select("id", { count: "exact", head: true }).eq("kampania_id", k.id).gte("wyslano", od),
        admin.from("podpisy").select("id", { count: "exact", head: true }).eq("kampania_id", k.id).eq("odpowiedz_rodzaj", "merytoryczna"),
        admin.from("kontakty").select("id", { count: "exact", head: true }).eq("kampania_id", k.id).gte("odpowiedzial", od),
      ]);
      const ids = (wiad ?? []).map((w) => w.id);
      const { count: klikniecia } = ids.length
        ? await admin.from("zdarzenia").select("id", { count: "exact", head: true }).in("wiadomosc_id", ids.slice(0, 1000)).eq("typ", "klikniecie")
        : { count: 0 };
      const l: Liczby = {
        nazwa: k.nazwa,
        id: k.id,
        maile: ids.length,
        klikniecia: klikniecia ?? 0,
        odpowiedzi: odpowiedzi.count ?? 0,
        podpisy: podpisy.count ?? 0,
        wyslaliMieszkancy: wyslali.count ?? 0,
        odpowiedziMerytoryczne: merytoryczne.count ?? 0,
      };
      // Tylko kampanie, w których w tym tygodniu coś się działo.
      if (l.maile + l.podpisy + l.wyslaliMieszkancy + l.odpowiedzi > 0) wynik.push(l);
    }
    if (!wynik.length) continue;
    const { data: czlonkowie } = await admin.from("czlonkowie").select("email").eq("organizacja_id", o.id);
    const tresc = trescRaportu(o.nazwa, new Date(od).toLocaleDateString("pl-PL"), wynik, baza);
    for (const c of czlonkowie ?? []) {
      const w = await wyslijPrzezWinOver({ doKogo: c.email, temat: `WinOver: tydzień w kampaniach ${o.nazwa}`, tresc, nadawca: "WinOver" });
      if (w.ok) liczMaile++;
    }
    liczOrg++;
  }
  return { organizacje: liczOrg, maile: liczMaile };
}
