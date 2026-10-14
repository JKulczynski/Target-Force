import { zablokowane } from "@/lib/blokady";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIMIT_NA_ODBIORCE_DZIENNIE, nazwaNadawcy, wyslijPrzezWinOver } from "@/lib/poczta-winover";

/**
 * Wysłanie potwierdzonej wiadomości mieszkańca do decydenta (klient serwisowy). Wspólne dla potwierdzenia
 * na stronie /p/{token} i dla automatu, który rano wysyła kolejkę. Zwraca nowy status podpisu.
 * Warunki: globalny wyłącznik nie jest włączony, kampania ma zaakceptowane oświadczenie,
 * odbiorca nie dostał dziś więcej niż LIMIT_NA_ODBIORCE_DZIENNIE wiadomości mieszkańców (wtedy kolejka).
 */
export async function wyslijPodpis(
  admin: SupabaseClient,
  podpisId: string,
): Promise<"wyslany" | "w_kolejce" | "blad" | "wstrzymane"> {
  if (process.env.WYSYLKA_WSTRZYMANA === "1") return "wstrzymane";
  const { data: p } = await admin
    .from("podpisy")
    .select("id, kampania_id, imie, nazwisko, kontakt_id, odbiorca_email, temat, tresc, status_wysylki")
    .eq("id", podpisId)
    .maybeSingle();
  if (!p || !p.odbiorca_email) return "blad";
  if (p.status_wysylki === "wyslany") return "wyslany";
  const [{ data: k }, { data: w }] = await Promise.all([
    admin.from("kampanie").select("zgoda_zespolu, akcja_dostarczanie").eq("id", p.kampania_id).maybeSingle(),
    admin.from("podpisy_wysylka").select("email").eq("podpis_id", p.id).maybeSingle(),
  ]);
  if (k?.zgoda_zespolu !== "zaakceptowana" || !w) return "blad";

  // Adres decydenta odbił się albo zgłosił spam: nie wysyłamy (opis błędu dla twórcy akcji).
  if ((await zablokowane(admin, [p.odbiorca_email])).size) {
    await Promise.all([
      admin.from("podpisy").update({ status_wysylki: "blad" }).eq("id", p.id),
      admin.from("podpisy_wysylka").update({ blad: "Adres odbiorcy zablokowany (odbicie albo zgloszenie spamu)" }).eq("podpis_id", p.id),
    ]);
    return "blad";
  }

  // Tryb zestawienia (14.10): wiadomość czeka w kolejce na dzienne zestawienie dla adresata (lib/zestawienie.ts).
  if (k?.akcja_dostarczanie === "zestawienie") {
    await admin.from("podpisy").update({ status_wysylki: "w_kolejce" }).eq("id", p.id);
    return "w_kolejce";
  }

  const odDoby = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("podpisy")
    .select("id", { count: "exact", head: true })
    .eq("kontakt_id", p.kontakt_id)
    .gte("wyslano", odDoby);
  if ((count ?? 0) >= LIMIT_NA_ODBIORCE_DZIENNIE) {
    await admin.from("podpisy").update({ status_wysylki: "w_kolejce" }).eq("id", p.id);
    return "w_kolejce";
  }

  const wynik = await wyslijPrzezWinOver({
    doKogo: p.odbiorca_email,
    temat: p.temat,
    tresc: p.tresc,
    nadawca: nazwaNadawcy(p.imie, p.nazwisko),
    odpowiedzDo: w.email,
  });
  if (!wynik.ok) {
    await Promise.all([
      admin.from("podpisy").update({ status_wysylki: "blad" }).eq("id", p.id),
      admin.from("podpisy_wysylka").update({ blad: wynik.blad.slice(0, 300) }).eq("podpis_id", p.id),
    ]);
    return "blad";
  }
  await Promise.all([
    admin.from("podpisy").update({ status_wysylki: "wyslany", wyslano: new Date().toISOString() }).eq("id", p.id),
    admin.from("podpisy_wysylka").update({ message_id: wynik.id, proba: wynik.proba, blad: null }).eq("podpis_id", p.id),
  ]);
  return "wyslany";
}
