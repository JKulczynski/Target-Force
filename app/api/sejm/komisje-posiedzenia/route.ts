import { NextResponse, type NextRequest } from "next/server";
import { tSerwer } from "@/lib/i18n/serwer";

type Posiedzenie = { code: string; date: string; startDateTime?: string; status?: string; agenda?: string; room?: string; remote?: boolean };

/** Tekst porządku obrad bez HTML, skrócony do jednego zdania. */
function agenda(html: string | undefined): string {
  const tekst = (html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return tekst.length > 220 ? `${tekst.slice(0, 217).trimEnd()}...` : tekst;
}

/**
 * Posiedzenia komisji Sejmu (wizja pkt 4, "właściwy moment"): najbliższe zaplanowane posiedzenia komisji
 * wybranych w kampanii. Sejm publikuje je w API zwykle kilka dni naprzód, więc pusta lista to normalny stan.
 * ?kody=ASW,EKS (najwyżej 12). Cache 3 h na komisję.
 */
export async function GET(req: NextRequest) {
  const kody = (req.nextUrl.searchParams.get("kody") ?? "")
    .split(",")
    .map((k) => k.trim().toUpperCase())
    .filter((k) => /^[A-Z0-9]{2,6}$/.test(k))
    .slice(0, 12);
  if (kody.length === 0) return NextResponse.json([]);
  const dzis = new Date().toISOString().slice(0, 10);
  try {
    const wyniki = await Promise.all(
      kody.map(async (kod) => {
        const odp = await fetch(`https://api.sejm.gov.pl/sejm/term10/committees/${kod}/sittings`, {
          next: { revalidate: 60 * 60 * 3 },
        });
        if (!odp.ok) return [] as Posiedzenie[];
        return ((await odp.json()) as Posiedzenie[]).filter((p) => p.date >= dzis);
      }),
    );
    const lista = wyniki
      .flat()
      .map((p) => ({
        kod: p.code,
        data: p.date,
        godzina: p.startDateTime?.slice(11, 16) ?? "",
        agenda: agenda(p.agenda),
        zdalne: Boolean(p.remote),
      }))
      .sort((a, b) => (a.data + a.godzina).localeCompare(b.data + b.godzina))
      .slice(0, 6);
    return NextResponse.json(lista, { headers: { "Cache-Control": "private, max-age=1800" } });
  } catch {
    const t = await tSerwer();
    return NextResponse.json({ blad: t("api.sejmNieOdpowiada") }, { status: 502 });
  }
}
