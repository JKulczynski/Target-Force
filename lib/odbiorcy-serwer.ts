import type { createClient } from "@/lib/supabase/server";
import type { FiltrOdbiorcow } from "@/lib/types";
import { POBIERACZE } from "@/lib/zrodla-serwer";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** ID posłów z wybranych komisji Sejmu (puste = bez zawężenia po komisjach). */
async function poslowieKomisji(kody: string[]): Promise<Set<string> | null> {
  if (kody.length === 0) return null;
  const odp = await fetch("https://api.sejm.gov.pl/sejm/term10/committees", {
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!odp.ok) throw new Error("komisje");
  const komisje = (await odp.json()) as {
    code: string;
    members?: { id: number }[];
  }[];
  return new Set(
    komisje
      .filter((k) => kody.includes(k.code))
      .flatMap((k) => (k.members ?? []).map((m) => String(m.id))),
  );
}

/**
 * Buduje listę odbiorców kampanii ze źródeł (Sejm, PE, samorządy, ministerstwa, Tweede Kamer) z zawężeniem.
 * Zawężenie zapisujemy w kampanii, żeby było widać, do kogo idzie wysyłka, i żeby strona akcji dobierała z tej samej listy.
 * Zmiana zawężenia usuwa osoby spoza zakresu, o ile nic do nich jeszcze nie wysłaliśmy.
 */
export async function przygotujOdbiorcow(
  supabase: Supabase,
  id: string,
  zrodlaKampanii: string[],
  surowy: unknown,
): Promise<{ dodane: number; filtr: FiltrOdbiorcow } | { blad: string; status: number }> {
  // Zawężenie (Sejm: komisje i kluby). Zapisujemy je w kampanii, żeby było widać, do kogo idzie wysyłka.
  const f = (surowy ?? {}) as Record<string, unknown>;
  const lista = (x: unknown) => (Array.isArray(x) ? x.map(String) : []);
  const filtr: FiltrOdbiorcow = {
    komisje: lista(f.komisje),
    kluby: lista(f.kluby),
    wojewodztwa: lista(f.wojewodztwa),
    typy: lista(f.typy),
  };
  await supabase
    .from("kampanie")
    .update({ filtr_odbiorcow: filtr })
    .eq("id", id);

  const zrodla = (zrodlaKampanii ?? []).filter((z) => POBIERACZE[z]);
  let dodane = 0;
  for (const z of zrodla) {
    let kontakty;
    let wKomisjach: Set<string> | null = null;
    try {
      kontakty = await POBIERACZE[z](supabase);
      if (z === "sejm")
        wKomisjach = await poslowieKomisji(filtr.komisje ?? []);
    } catch {
      return { blad: `Źródło ${z} chwilowo nie odpowiada. Spróbuj za chwilę.`, status: 502 };
    }
    if (z === "samorzady") {
      kontakty = kontakty.filter(
        (c) =>
          (!filtr.wojewodztwa?.length ||
            filtr.wojewodztwa.includes(String(c.dane?.wojewodztwo ?? ""))) &&
          (!filtr.typy?.length || filtr.typy.includes(c.organizacja)),
      );
    }
    if (z === "sejm") {
      kontakty = kontakty.filter(
        (c) =>
          (!wKomisjach || wKomisjach.has(c.zewnetrzneId)) &&
          (!filtr.kluby?.length || filtr.kluby.includes(c.organizacja)),
      );
    }
    if (z === "sejm" || z === "samorzady") {
      // Zmiana zawężenia: usuwamy posłów spoza nowego zakresu, o ile nic jeszcze do nich nie wysłaliśmy.
      const dozwolone = new Set(kontakty.map((c) => c.zewnetrzneId));
      const { data: obecni } = await supabase
        .from("kontakty")
        .select("id, zewnetrzne_id")
        .eq("kampania_id", id)
        .eq("zrodlo", z);
      const { data: zWiadomoscia } = await supabase
        .from("wiadomosci")
        .select("kontakt_id")
        .eq("kampania_id", id);
      const chronieni = new Set(
        (zWiadomoscia ?? []).map((w) => w.kontakt_id),
      );
      const doUsuniecia = (obecni ?? [])
        .filter(
          (o) =>
            !dozwolone.has(o.zewnetrzne_id ?? "") && !chronieni.has(o.id),
        )
        .map((o) => o.id);
      if (doUsuniecia.length)
        await supabase.from("kontakty").delete().in("id", doUsuniecia);
    }
    const wiersze = kontakty
      .filter((c) => c.email)
      .map((c) => ({
        kampania_id: id,
        zrodlo: z,
        zewnetrzne_id: c.zewnetrzneId,
        imie: c.imie,
        nazwisko: c.nazwisko,
        email: c.email!.trim().toLowerCase(),
        organizacja: c.organizacja,
        stanowisko: c.stanowisko,
        dane: c.dane ?? {},
      }));
    if (wiersze.length === 0) continue;
    const { count: przed } = await supabase
      .from("kontakty")
      .select("id", { count: "exact", head: true })
      .eq("kampania_id", id);
    // Bez ignoreDuplicates: odświeża dane istniejących osób (np. okręg do personalizacji).
    const { error } = await supabase
      .from("kontakty")
      .upsert(wiersze, { onConflict: "kampania_id,email" });
    if (error)
      return { blad: "Nie udało się zapisać odbiorców.", status: 500 };
    const { count: po } = await supabase
      .from("kontakty")
      .select("id", { count: "exact", head: true })
      .eq("kampania_id", id);
    dodane += Math.max((po ?? 0) - (przed ?? 0), 0);
  }
  return { dodane, filtr };
}
