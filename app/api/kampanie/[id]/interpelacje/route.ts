import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Interpelacja = {
  num: number;
  title: string;
  receiptDate: string;
  from: string[];
  to: string[];
  links?: { href: string; rel: string }[];
};

/**
 * Dowód wpływu z otwartych danych: interpelacje złożone przez posłów z listy odbiorców kampanii
 * od pierwszej wysyłki (albo od utworzenia kampanii, jeśli nic nie poszło). Człowiek decyduje,
 * czy interpelacja ma związek z kampanią, i jednym kliknięciem dopisuje ją do raportu wpływu.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const [{ data: k }, { data: kontakty }, { data: pierwsza }] = await Promise.all([
    supabase.from("kampanie").select("id, utworzona").eq("id", id).maybeSingle(),
    supabase.from("kontakty").select("zewnetrzne_id, imie, nazwisko").eq("kampania_id", id).eq("zrodlo", "sejm"),
    supabase
      .from("wiadomosci")
      .select("wyslana")
      .eq("kampania_id", id)
      .not("wyslana", "is", null)
      .order("wyslana")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!k) return NextResponse.json({ blad: "Nie znaleziono kampanii albo brak dostępu." }, { status: 404 });
  if (!kontakty?.length) return NextResponse.json({ od: null, interpelacje: [] });

  const od = (pierwsza?.wyslana ?? k.utworzona).slice(0, 10);
  const poslowie = new Map(kontakty.map((c) => [Number(c.zewnetrzne_id), [c.imie, c.nazwisko].filter(Boolean).join(" ")]));

  try {
    const odp = await fetch("https://api.sejm.gov.pl/sejm/term10/interpellations?limit=1000&sort_by=-num", {
      next: { revalidate: 60 * 60 * 6 },
    });
    if (!odp.ok) throw new Error(String(odp.status));
    const lista = (await odp.json()) as Interpelacja[];
    const trafione = lista
      .filter((i) => i.receiptDate >= od && i.from.some((f) => poslowie.has(Number(f))))
      .map((i) => ({
        numer: i.num,
        tytul: i.title,
        data: i.receiptDate,
        do: i.to.join(", "),
        poslowie: i.from.map((f) => poslowie.get(Number(f))).filter(Boolean) as string[],
        link: i.links?.find((l) => l.rel === "web-description")?.href ?? `https://sejm.gov.pl/sejm10.nsf/interpelacja.xsp?typ=INT&nr=${i.num}`,
      }));
    return NextResponse.json({ od, interpelacje: trafione, sprawdzono: lista.length });
  } catch {
    return NextResponse.json({ blad: "API Sejmu chwilowo nie odpowiada." }, { status: 502 });
  }
}
