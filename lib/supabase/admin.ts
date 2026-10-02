import { createClient as utworz } from "@supabase/supabase-js";

/**
 * Klient serwisowy (omija RLS). TYLKO po stronie serwera i tylko w automacie (cron), gdzie nie ma zalogowanego użytkownika.
 * Zgoda Jana 02.10. Zwraca null, gdy brak klucza w środowisku (wtedy automat po prostu nie działa).
 */
export function createAdminClient() {
  const klucz = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!klucz) return null;
  return utworz(process.env.NEXT_PUBLIC_SUPABASE_URL!, klucz, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
