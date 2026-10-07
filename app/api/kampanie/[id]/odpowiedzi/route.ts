import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { odszyfruj } from "@/lib/szyfr";
import { opiszBladImap, sprawdzOdpowiedzi } from "@/lib/odpowiedzi-serwer";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Przycisk "Sprawdź odpowiedzi w skrzynce": zagląda przez IMAP do skrzynki kampanii i oznacza, kto odpisał. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: k } = await supabase.from("kampanie").select("id, skrzynka_id").eq("id", id).maybeSingle();
  if (!k) return NextResponse.json({ blad: "Nie znaleziono kampanii albo brak dostępu." }, { status: 404 });
  if (!k.skrzynka_id) return NextResponse.json({ blad: "Kampania nie ma skrzynki nadawcy." }, { status: 400 });

  const [{ data: s }, { data: sekret }] = await Promise.all([
    supabase
      .from("skrzynki")
      .select("id, email_nadawcy, smtp_host, smtp_uzytkownik, imap_host, imap_port, odpowiedzi_sprawdzone")
      .eq("id", k.skrzynka_id)
      .maybeSingle(),
    supabase.rpc("pobierz_sekret_skrzynki", { p_skrzynka: k.skrzynka_id }),
  ]);
  if (!s || !sekret) return NextResponse.json({ blad: "Brak skrzynki albo jej hasła." }, { status: 400 });

  try {
    const wynik = await sprawdzOdpowiedzi(supabase, s, odszyfruj(sekret as string), { kampaniaId: id });
    return NextResponse.json({ ok: true, ...wynik });
  } catch (e) {
    return NextResponse.json({ blad: opiszBladImap(e) }, { status: 400 });
  }
}
