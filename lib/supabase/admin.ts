import { createClient as utworz } from "@supabase/supabase-js";

/**
 * Klient serwisowy (omija RLS). TYLKO po stronie serwera: w automacie (cron), gdzie nie ma zalogowanego użytkownika
 * (zgoda Jana 02.10), i w zaproszeniach do zespołu (/api/zespol, 07.10), zawsze po sprawdzeniu czy_w_zespole().
 * Zwraca null, gdy brak klucza w środowisku (wtedy automat i zaproszenia po prostu nie działają).
 */
export function createAdminClient() {
  const klucz = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!klucz) return null;
  return utworz(process.env.NEXT_PUBLIC_SUPABASE_URL!, klucz, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
