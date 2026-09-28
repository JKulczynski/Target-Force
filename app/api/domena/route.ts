import { NextResponse, type NextRequest } from "next/server";
import { oczyscDomene, sprawdzDomene } from "@/lib/dns-poczty";

export const runtime = "nodejs";

/** Sprawdzenie SPF, DKIM i DMARC domeny nadawcy. Dostęp tylko po zalogowaniu (proxy). */
export async function GET(req: NextRequest) {
  const domena = oczyscDomene(req.nextUrl.searchParams.get("d") ?? "");
  if (!domena) return NextResponse.json({ blad: "Podaj domenę albo adres e-mail." }, { status: 400 });
  return NextResponse.json(await sprawdzDomene(domena));
}
