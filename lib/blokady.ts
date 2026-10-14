import type { SupabaseClient } from "@supabase/supabase-js";

/** Adresy, do których WinOver nie pisze (twarde odbicie albo zgłoszenie spamu w Resend). */
export async function zablokowane(admin: SupabaseClient, adresy: string[]): Promise<Set<string>> {
  const male = [...new Set(adresy.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (!male.length) return new Set();
  const { data } = await admin.from("blokady_adresow").select("email").in("email", male);
  return new Set((data ?? []).map((r) => r.email as string));
}
