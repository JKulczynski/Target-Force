import type { SupabaseClient } from "@supabase/supabase-js";
import { wyslijPrzezWinOver } from "@/lib/poczta-winover";
import { DOMENA_PRODUKCYJNA } from "@/lib/adres";
import { zablokowane } from "@/lib/blokady";
import { stopkaNadawcy, type TrescOswiadczenia } from "@/lib/oswiadczenie";

/**
 * Dzienne zestawienie dla biura (14.10, wzorzec ActionKit/Proca): w kampanii z dostarczaniem "zestawienie"
 * potwierdzone wiadomości mieszkańców czekają w kolejce, a automat raz dziennie wysyła do każdego adresata
 * JEDEN mail z wszystkimi wiadomościami (imię i nazwisko, gmina, treść), od organizacji, ze stopką nadawcy.
 * Biuro dostaje jedną wiadomość zamiast setek, a każda opinia mieszkańca jest w niej w całości.
 */
const MAKS_W_ZESTAWIENIU = 300;

type Podpis = {
  id: string;
  kampania_id: string;
  kontakt_id: string;
  imie: string;
  nazwisko: string;
  gmina_nazwa: string | null;
  odbiorca_nazwa: string | null;
  odbiorca_email: string | null;
  tresc: string | null;
};

/** Treść zestawienia dla jednego adresata. */
export function trescZestawienia(o: { sprawa: string; organizacja: string; data: string; podpisy: Pick<Podpis, "imie" | "nazwisko" | "gmina_nazwa" | "tresc">[]; stopka: string }) {
  const wiadomosci = o.podpisy
    .map((p, i) => {
      // Treść mieszkańca kończy się podpisem (imię i nazwisko, gmina), który pokazujemy w nagłówku wpisu.
      const linie = String(p.tresc ?? "").trim().split("\n");
      const bezPodpisu = linie.slice(0, Math.max(linie.length - 2, 1)).join("\n").trim();
      return `${i + 1}. ${p.imie} ${p.nazwisko}${p.gmina_nazwa ? `, gmina ${p.gmina_nazwa}` : ""}\n\n${bezPodpisu}`;
    })
    .join("\n\n----------\n\n");
  return [
    `Dzień dobry,`,
    ``,
    `przesyłamy zestawienie wiadomości od mieszkańców w sprawie: ${o.sprawa}. Każdą z nich mieszkaniec przygotował na stronie akcji i potwierdził z własnej skrzynki e-mail. Zamiast ${o.podpisy.length} osobnych maili wysyłamy jeden, żeby nie zasypywać biura.`,
    ``,
    `Liczba wiadomości: ${o.podpisy.length} (${o.data}).`,
    ``,
    `----------`,
    ``,
    wiadomosci,
    ``,
    `----------`,
    ``,
    `Odpowiedź na ten mail trafi do organizatora akcji (${o.organizacja}). Zasady wysyłki: ${DOMENA_PRODUKCYJNA}/dla-biur`,
    ...(o.stopka ? [``, `--`, o.stopka] : []),
  ].join("\n");
}

export async function wyslijZestawienia(admin: SupabaseClient): Promise<{ maile: number; wiadomosci: number; bledy: number }> {
  if (process.env.WYSYLKA_WSTRZYMANA === "1") return { maile: 0, wiadomosci: 0, bledy: 0 };
  const { data: kampanie } = await admin
    .from("kampanie")
    .select("id, nazwa, akcja_tytul, nadawca, zgoda_zespolu")
    .eq("akcja_dostarczanie", "zestawienie")
    .eq("zgoda_zespolu", "zaakceptowana");
  let maile = 0;
  let wiadomosci = 0;
  let bledy = 0;
  for (const k of kampanie ?? []) {
    const { data: podpisy } = await admin
      .from("podpisy")
      .select("id, kampania_id, kontakt_id, imie, nazwisko, gmina_nazwa, odbiorca_nazwa, odbiorca_email, tresc")
      .eq("kampania_id", k.id)
      .eq("status_wysylki", "w_kolejce")
      .order("potwierdzono", { ascending: true })
      .limit(5000);
    if (!podpisy?.length) continue;
    const { data: osw } = await admin
      .from("oswiadczenia")
      .select("tresc")
      .eq("kampania_id", k.id)
      .order("utworzone", { ascending: false })
      .limit(1)
      .maybeSingle();
    const tresc = osw?.tresc as TrescOswiadczenia | undefined;
    const organizacja = tresc?.zleceniodawca || k.nadawca || "organizator akcji";
    const grupy = new Map<string, Podpis[]>();
    for (const p of podpisy as Podpis[]) if (p.odbiorca_email) grupy.set(p.kontakt_id, [...(grupy.get(p.kontakt_id) ?? []), p]);
    const blok = await zablokowane(admin, [...grupy.values()].map((g) => String(g[0].odbiorca_email)));

    for (const grupa of grupy.values()) {
      const doWyslania = grupa.slice(0, MAKS_W_ZESTAWIENIU);
      const ids = doWyslania.map((p) => p.id);
      const adresat = String(grupa[0].odbiorca_email);
      if (blok.has(adresat.trim().toLowerCase())) {
        await admin.from("podpisy").update({ status_wysylki: "blad" }).in("id", ids);
        continue;
      }
      const wynik = await wyslijPrzezWinOver({
        doKogo: adresat,
        temat: `Wiadomości od mieszkańców: ${k.akcja_tytul || k.nazwa} (${doWyslania.length})`,
        tresc: trescZestawienia({
          sprawa: k.akcja_tytul || k.nazwa,
          organizacja,
          data: new Date().toLocaleDateString("pl-PL"),
          podpisy: doWyslania,
          stopka: tresc ? stopkaNadawcy(tresc) : "",
        }),
        nadawca: organizacja.replace(/["<>\r\n,;]/g, " ").slice(0, 70),
        odpowiedzDo: tresc?.email || undefined,
      });
      if (!wynik.ok) {
        bledy++;
        continue;
      }
      maile++;
      wiadomosci += ids.length;
      const teraz = new Date().toISOString();
      await admin.from("podpisy").update({ status_wysylki: "wyslany", wyslano: teraz }).in("id", ids);
      await admin.from("podpisy_wysylka").update({ message_id: wynik.id, proba: wynik.proba, blad: null }).in("podpis_id", ids);
    }
  }
  return { maile, wiadomosci, bledy };
}
