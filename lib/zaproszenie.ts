import type { SupabaseClient } from "@supabase/supabase-js";

export const POPRAWNY_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Znajduje konto po e-mailu albo zakłada je i wysyła zaproszenie (link prowadzi na /auth/haslo).
 * Klient serwisowy; wołać dopiero po sprawdzeniu uprawnień. Kont jest kilkadziesiąt, jedna strona listy wystarcza.
 */
export async function znajdzLubZapros(
  admin: SupabaseClient,
  email: string,
  origin: string,
): Promise<{ userId: string; zaproszono: boolean } | { blad: "konta" | "zaproszenie" }> {
  const { data: lista, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { blad: "konta" };
  const istniejacy = lista.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (istniejacy) return { userId: istniejacy, zaproszono: false };
  const { data, error: bladZaproszenia } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/haslo`,
    data: { zaproszenie: true },
  });
  if (bladZaproszenia || !data.user) return { blad: "zaproszenie" };
  return { userId: data.user.id, zaproszono: true };
}
