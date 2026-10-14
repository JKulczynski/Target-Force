import type { SupabaseClient } from "@supabase/supabase-js";
import { wyslijPrzezWinOver } from "@/lib/poczta-winover";
import { zablokowane } from "@/lib/blokady";
import { tlumacz } from "@/lib/i18n";

/**
 * Pytanie "czy adresat odpowiedział?" (14.10, wzorzec WriteToThem): 14 dni po wysłaniu wiadomości mieszkańca
 * automat pyta go raz mailem, a odpowiedź (merytoryczna / szablonowa / brak) trafia do raportu kampanii.
 * Pomijamy tych, którzy już zgłosili odpowiedź, i adresy z blokady (odbicia, skargi).
 */
export const DNI_DO_PYTANIA = 14;
const MAKS_NA_PRZEBIEG = 200;

export async function wyslijPytaniaOOdpowiedz(admin: SupabaseClient, baza: string): Promise<{ wyslane: number; bledy: number }> {
  const granica = new Date(Date.now() - DNI_DO_PYTANIA * 86_400_000).toISOString();
  const { data: podpisy } = await admin
    .from("podpisy")
    .select("id, imie, odbiorca_nazwa, kampania_id")
    .eq("status_wysylki", "wyslany")
    .lte("wyslano", granica)
    .is("odpowiedz_rodzaj", null)
    .is("zglosil_odpowiedz", null)
    .limit(MAKS_NA_PRZEBIEG * 2);
  if (!podpisy?.length) return { wyslane: 0, bledy: 0 };

  const { data: wysylki } = await admin
    .from("podpisy_wysylka")
    .select("podpis_id, email, token, proba")
    .in(
      "podpis_id",
      podpisy.map((p) => p.id),
    )
    .is("pytanie_wyslane", null);
  // Wiadomości z trybu próbnego nigdy nie wyszły, więc nie ma o co pytać.
  const doPytania = (wysylki ?? []).filter((w) => !w.proba).slice(0, MAKS_NA_PRZEBIEG);
  if (!doPytania.length) return { wyslane: 0, bledy: 0 };

  const blok = await zablokowane(admin, doPytania.map((w) => w.email));
  const { data: kampanie } = await admin
    .from("kampanie")
    .select("id, akcja_tytul, nazwa")
    .in("id", [...new Set(podpisy.map((p) => p.kampania_id))]);
  const sprawa = new Map((kampanie ?? []).map((k) => [k.id, k.akcja_tytul || k.nazwa]));
  const podpis = new Map(podpisy.map((p) => [p.id, p]));
  const t = tlumacz("pl");

  let wyslane = 0;
  let bledy = 0;
  for (const w of doPytania) {
    const p = podpis.get(w.podpis_id);
    if (!p) continue;
    const teraz = new Date().toISOString();
    if (blok.has(String(w.email).trim().toLowerCase())) {
      await admin.from("podpisy_wysylka").update({ pytanie_wyslane: teraz }).eq("podpis_id", w.podpis_id);
      continue;
    }
    const wynik = await wyslijPrzezWinOver({
      doKogo: w.email,
      temat: t("pytanie.mailTemat", { odbiorca: p.odbiorca_nazwa ?? "" }),
      tresc: t("pytanie.mailTresc", {
        imie: p.imie,
        odbiorca: p.odbiorca_nazwa ?? "",
        sprawa: sprawa.get(p.kampania_id) ?? "",
        link: `${baza}/p/${w.token}?pytanie=1`,
      }),
      nadawca: "WinOver",
    });
    if (wynik.ok) {
      wyslane++;
      await admin.from("podpisy_wysylka").update({ pytanie_wyslane: teraz }).eq("podpis_id", w.podpis_id);
    } else bledy++;
  }
  return { wyslane, bledy };
}
