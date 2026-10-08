import { NextResponse } from "next/server";
import { POBIERACZE } from "@/lib/zrodla-serwer";
import { createClient } from "@/lib/supabase/server";
import { tSerwer } from "@/lib/i18n/serwer";

/** Licznik do kreatora: ile osób w źródle i ile z nich ma e-mail. Dostęp tylko po zalogowaniu (proxy). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await tSerwer();
  const pobierz = POBIERACZE[id];
  if (!pobierz) return NextResponse.json({ blad: t("api.nieznaneZrodlo") }, { status: 404 });
  try {
    const kontakty = await pobierz(await createClient());
    return NextResponse.json({
      razem: kontakty.length,
      zEmailem: kontakty.filter((k) => k.email).length,
    });
  } catch {
    return NextResponse.json({ blad: t("api.zrodloChwilowo") }, { status: 502 });
  }
}
