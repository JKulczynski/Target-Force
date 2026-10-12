import type { SupabaseClient } from "@supabase/supabase-js";
import { wyslijPrzezWinOver } from "@/lib/poczta-winover";

/**
 * Powiadomienia dla administratorów WinOver (12.10): kampania czeka na decyzję, automat zgłosił błędy.
 * Adresy z tabeli `zespol` (klient serwisowy). Bez klucza Resend tylko log (tryb próbny).
 * Błąd powiadomienia nigdy nie psuje akcji, która je wywołała.
 */
export async function powiadomAdminow(admin: SupabaseClient, temat: string, tresc: string): Promise<void> {
  try {
    const { data } = await admin.from("zespol").select("email");
    await Promise.all(
      (data ?? [])
        .map((r) => r.email as string)
        .filter(Boolean)
        .map((email) => wyslijPrzezWinOver({ doKogo: email, temat, tresc, nadawca: "WinOver" })),
    );
  } catch (e) {
    console.error("powiadomAdminow", e);
  }
}
