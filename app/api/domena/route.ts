import { NextResponse, type NextRequest } from "next/server";
import { oczyscDomene, sprawdzDomene } from "@/lib/dns-poczty";
import { tSerwer } from "@/lib/i18n/serwer";

export const runtime = "nodejs";

/** Sprawdzenie SPF, DKIM i DMARC domeny nadawcy. Dostęp tylko po zalogowaniu (proxy). */
export async function GET(req: NextRequest) {
  const t = await tSerwer();
  const domena = oczyscDomene(req.nextUrl.searchParams.get("d") ?? "");
  if (!domena) return NextResponse.json({ blad: t("api.podajDomene") }, { status: 400 });
  return NextResponse.json(await sprawdzDomene(domena, t.jezyk));
}
