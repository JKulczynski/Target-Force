import { NextResponse } from "next/server";

/**
 * Właściwy moment (wizja pkt 4): najbliższe posiedzenia Sejmu z otwartego API, żeby zaplanować wysyłkę
 * kilka dni przed obradami, kiedy biura poselskie czytają maile pod kątem interpelacji i pytań.
 */
export async function GET() {
  try {
    const odp = await fetch("https://api.sejm.gov.pl/sejm/term10/proceedings", {
      next: { revalidate: 60 * 60 * 12 },
    });
    if (!odp.ok) throw new Error(String(odp.status));
    const lista = (await odp.json()) as {
      number: number;
      title: string;
      dates: string[];
      current?: boolean;
    }[];
    const dzis = new Date().toISOString().slice(0, 10);
    const przyszle = lista
      .filter((p) => p.dates?.length && p.dates[p.dates.length - 1] >= dzis)
      .map((p) => ({
        numer: p.number,
        tytul: p.title,
        od: p.dates[0],
        do: p.dates[p.dates.length - 1],
        trwa: p.dates[0] <= dzis,
      }))
      .sort((a, b) => a.od.localeCompare(b.od))
      .slice(0, 3);
    return NextResponse.json(przyszle, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ blad: "API Sejmu nie odpowiada." }, { status: 502 });
  }
}
