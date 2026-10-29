import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BOT = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|telegram|discord|headless/i;

/** Tylko znane klucze źródła, krótkie wartości (to samo co zrodloWejscia w AkcjaFormularz). */
function oczyscZrodlo(z: unknown): Record<string, string> {
  const wynik: Record<string, string> = {};
  if (!z || typeof z !== "object") return wynik;
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "ref"]) {
    const v = (z as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim()) wynik[k] = v.trim().slice(0, 80);
  }
  return wynik;
}

/**
 * Wejście na stronę akcji (analityka, 29.10). Bez ciasteczek i bez IP: zapisujemy czas, źródło,
 * typ urządzenia i to, czy strona jest w widżecie. Boty i podglądy linków (WhatsApp, Facebook) pomijamy.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (BOT.test(req.headers.get("user-agent") ?? "")) return NextResponse.json({ ok: true });
  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  const { data: k } = await admin
    .from("kampanie")
    .select("id, akcja_wlaczona")
    .eq("akcja_slug", slug)
    .maybeSingle();
  if (!k || !k.akcja_wlaczona) return NextResponse.json({ ok: false }, { status: 404 });
  await admin.from("akcja_wejscia").insert({
    kampania_id: k.id,
    zrodlo: oczyscZrodlo(body.zrodlo),
    urzadzenie: body.urzadzenie === "telefon" ? "telefon" : "komputer",
    osadzona: body.osadzona === true,
  });
  return NextResponse.json({ ok: true });
}
