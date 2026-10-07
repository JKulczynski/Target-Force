"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function dane(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function zaloguj(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(dane(formData));
  if (error) redirect("/login?blad=logowanie");
  revalidatePath("/", "layout");
  redirect("/");
}

export async function zalozKonto(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.signUp({
    ...dane(formData),
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect("/login?blad=rejestracja");
  redirect("/login?info=potwierdz");
}

/**
 * Zapomniane hasło: Supabase wysyła link, który wraca na /auth/haslo (ta sama strona co przy zaproszeniu).
 * Odpowiedź jest taka sama niezależnie od tego, czy konto istnieje, żeby nie zdradzać listy adresów.
 */
export async function przypomnijHaslo(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/login?tryb=haslo&blad=haslo");
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/haslo`,
  });
  redirect("/login?tryb=haslo&info=link");
}

export async function wyloguj() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
