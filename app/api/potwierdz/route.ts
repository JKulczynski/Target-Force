import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tSerwer } from "@/lib/i18n/serwer";
import { wyslijPodpis } from "@/lib/wysylka-sympatyka";

export const runtime = "nodejs";

/**
 * Strona /p/{token}: mieszkaniec klika "Potwierdzam i wysyłam" (POST, nie samo otwarcie linku,
 * bo skanery poczty otwierają linki same) albo "Poseł mi odpisał".
 */
export async function POST(req: NextRequest) {
  const t = await tSerwer();
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const co = body.co === "odpisal" ? "odpisal" : "wyslij";
  if (!/^[0-9a-f]{48}$/.test(token)) return NextResponse.json({ blad: t("potw.zlyLink") }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ blad: t("api.akcja.nieDziala") }, { status: 500 });
  const { data: w } = await admin.from("podpisy_wysylka").select("podpis_id").eq("token", token).maybeSingle();
  if (!w) return NextResponse.json({ blad: t("potw.zlyLink") }, { status: 404 });

  if (co === "odpisal") {
    await admin.from("podpisy").update({ zglosil_odpowiedz: new Date().toISOString() }).eq("id", w.podpis_id).is("zglosil_odpowiedz", null);
    return NextResponse.json({ ok: true, status: "odpisal" });
  }
  await admin
    .from("podpisy")
    .update({ potwierdzono: new Date().toISOString() })
    .eq("id", w.podpis_id)
    .is("potwierdzono", null);
  const status = await wyslijPodpis(admin, w.podpis_id);
  if (status === "blad") return NextResponse.json({ blad: t("potw.blad") }, { status: 502 });
  if (status === "wstrzymane") return NextResponse.json({ blad: t("api.wysylkaWstrzymana") }, { status: 503 });
  return NextResponse.json({ ok: true, status });
}
