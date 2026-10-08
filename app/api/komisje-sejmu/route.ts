import { NextResponse } from "next/server";
import { tSerwer } from "@/lib/i18n/serwer";

const DOBA = 60 * 60 * 24;

type Komisja = { code: string; name: string; members?: { id: number; club: string }[] };

/** Komisje Sejmu z liczbą członków i listą klubów, do zawężania odbiorców kampanii. Dostęp tylko po zalogowaniu (proxy). */
export async function GET() {
  try {
    const odp = await fetch("https://api.sejm.gov.pl/sejm/term10/committees", { next: { revalidate: DOBA } });
    if (!odp.ok) throw new Error(String(odp.status));
    const komisje = (await odp.json()) as Komisja[];
    const kluby = new Set<string>();
    const lista = komisje
      .map((k) => {
        (k.members ?? []).forEach((m) => m.club && kluby.add(m.club));
        return { kod: k.code, nazwa: k.name, czlonkow: k.members?.length ?? 0 };
      })
      .sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl"));
    return NextResponse.json({ komisje: lista, kluby: [...kluby].sort() });
  } catch {
    const t = await tSerwer();
    return NextResponse.json({ blad: t("api.sejmNieOdpowiada") }, { status: 502 });
  }
}
