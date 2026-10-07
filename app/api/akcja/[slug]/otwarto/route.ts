import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sympatyk kliknął „Otwórz w poczcie” (albo skopiował treść) i „Udostępnij”.
 * W wariancie A nie widzimy, czy mail naprawdę wyszedł, więc to jest nasza miara zamiaru wysyłki
 * i raport mówi o tym uczciwie.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const podpisId = String(body.podpisId ?? "");
  const co = body.co === "udostepnil" ? "udostepnil" : "otworzyl_poczte";
  if (!/^[0-9a-f-]{36}$/.test(podpisId))
    return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  const { data: k } = await admin
    .from("kampanie")
    .select("id")
    .eq("akcja_slug", slug)
    .maybeSingle();
  if (!k) return NextResponse.json({ ok: false }, { status: 404 });
  await admin
    .from("podpisy")
    .update({ [co]: new Date().toISOString() })
    .eq("id", podpisId)
    .eq("kampania_id", k.id)
    .is(co, null);
  return NextResponse.json({ ok: true });
}
