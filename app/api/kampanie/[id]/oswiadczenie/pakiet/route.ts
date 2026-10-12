import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tSerwer } from "@/lib/i18n/serwer";
import { WERSJA_OSWIADCZENIA } from "@/lib/oswiadczenie";

export const runtime = "nodejs";

/**
 * Pakiet zgodności kampanii (legal etap 1, 12.10): pełna historia oświadczeń (append-only, z IP i przeglądarką),
 * decyzja zespołu, wynik silnika reguł. Do pobrania jako JSON z raportu; archiwum na wypadek pytań (7 lat = nie kasujemy).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const supabase = await createClient();
  const [{ data: k, error: bk }, { data: oswiadczenia, error: bo }] = await Promise.all([
    supabase
      .from("kampanie")
      .select("id, nazwa, status, start, zgoda_zespolu, zgoda_powod, zgoda_kto, zgoda_kiedy")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("oswiadczenia")
      .select("id, tresc, wersja_tresci, utworzone, user_id, ip, user_agent")
      .eq("kampania_id", id)
      .order("utworzone", { ascending: true }),
  ]);
  if (bk || bo || !k) return NextResponse.json({ blad: t("api.nieudanoPobracOswiadczenie") }, { status: 500 });

  const pakiet = {
    wygenerowano: new Date().toISOString(),
    narzedzie: "Target Force",
    wersjaTresciOswiadczen: WERSJA_OSWIADCZENIA,
    kampania: k,
    decyzjaZespolu: {
      zgoda: k.zgoda_zespolu,
      powod: k.zgoda_powod,
      kto: k.zgoda_kto,
      kiedy: k.zgoda_kiedy,
    },
    oswiadczenia: oswiadczenia ?? [],
  };
  return new NextResponse(JSON.stringify(pakiet, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pakiet-zgodnosci-${id}.json"`,
    },
  });
}
