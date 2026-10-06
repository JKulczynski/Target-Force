import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Krótki link śledzący z maila: /r/{kod wiadomości}/{numer linku w treści}.
 * Zapisuje kliknięcie i przekierowuje na n-ty adres z treści tej wiadomości (baza nie przepuści innego).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; nr: string }> },
) {
  const { id: kod, nr } = await ctx.params;
  const numer = Number(nr);
  if (!/^[0-9a-f]{8}$/.test(kod) || !Number.isInteger(numer) || numer < 1)
    return new NextResponse("Nieprawidłowy link.", { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.rpc("zapisz_klikniecie_kod", {
    p_kod: kod,
    p_nr: numer,
  });
  if (!data) return new NextResponse("Nieprawidłowy link.", { status: 404 });
  return NextResponse.redirect(data as string, 302);
}
