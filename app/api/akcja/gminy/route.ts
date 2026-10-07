import { NextResponse } from "next/server";
import { GMINY } from "@/lib/akcja";

/** Lista gmin (z okręgiem do Sejmu) do wyszukiwarki na stronie akcji. Publiczna, stała, cache na dobę. */
export function GET() {
  return NextResponse.json(GMINY, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
