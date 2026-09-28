import { NextResponse } from "next/server";
import { POBIERACZE } from "@/lib/zrodla-serwer";

/** Licznik do kreatora: ile osób w źródle i ile z nich ma e-mail. Dostęp tylko po zalogowaniu (proxy). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pobierz = POBIERACZE[id];
  if (!pobierz) return NextResponse.json({ blad: "Nieznane źródło" }, { status: 404 });
  try {
    const kontakty = await pobierz();
    return NextResponse.json({
      razem: kontakty.length,
      zEmailem: kontakty.filter((k) => k.email).length,
    });
  } catch {
    return NextResponse.json({ blad: "Źródło chwilowo nie odpowiada" }, { status: 502 });
  }
}
