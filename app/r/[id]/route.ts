import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Link śledzący z maila: zapisuje kliknięcie i przekierowuje na oryginalny adres (np. film).
 * Publiczny (odbiorca nie jest zalogowany). Baza przepuszcza tylko adresy z treści tej wiadomości.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = req.nextUrl.searchParams.get("u") ?? "";
  if (!/^https?:\/\//i.test(url) || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Nieprawidłowy link.", { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.rpc("zapisz_klikniecie", { p_wiadomosc: id, p_url: url });
  if (!data) return new NextResponse("Nieprawidłowy link.", { status: 404 });
  return NextResponse.redirect(data as string, 302);
}
