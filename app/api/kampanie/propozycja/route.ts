import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ZRODLA, type ZrodloId } from "@/lib/types";
import { tSerwer } from "@/lib/i18n/serwer";

export const runtime = "nodejs";
export const maxDuration = 120;

const Propozycja = z.object({
  zrodla: z
    .array(z.enum(["sejm", "parlament_ue", "samorzady", "ministerstwa"]))
    .describe("Źródła odbiorców, które naprawdę mają wpływ na tę sprawę. Zwykle jedno, najwyżej dwa."),
  komisje: z
    .array(
      z.object({
        kod: z.string().describe("Kod komisji z listy"),
        dlaczego: z.string().describe("Jedno zdanie: dlaczego ta komisja"),
      }),
    )
    .describe("Komisje Sejmu, które zajmują się tą sprawą. 1-3, tylko gdy źródła zawierają sejm."),
  kogoSzukamy: z
    .string()
    .describe("Jedno zdanie po polsku: kogo dokładnie szukamy, np. „posłowie Komisji Infrastruktury i posłowie z Małopolski”."),
  uzasadnienie: z
    .string()
    .describe("2-3 zdania dla nadawcy: kto decyduje w tej sprawie i dlaczego do nich piszemy. Bez ogólników."),
});

/**
 * TF sam proponuje, do kogo pisać (wizja pkt 2): z celu i materiałów kampanii AI wskazuje źródła i komisje Sejmu.
 * Komisje bierzemy na żywo z API Sejmu, żeby model nie zmyślał nazw. Nadawca zawsze może zmienić.
 */
export async function POST(req: NextRequest) {
  const t = await tSerwer();
  const supabase = await createClient();
  const { data: wZespole } = await supabase.rpc("czy_w_zespole");
  if (!wZespole) return NextResponse.json({ blad: t("api.brakDostepu") }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const cel = String(body.cel ?? "").trim();
  const materialy = String(body.materialy ?? "").trim();
  const nazwa = String(body.nazwa ?? "").trim();
  if (cel.length < 10)
    return NextResponse.json({ blad: t("api.najpierwCel") }, { status: 400 });

  let komisje: { code: string; name: string; type: string }[] = [];
  try {
    const odp = await fetch("https://api.sejm.gov.pl/sejm/term10/committees", {
      next: { revalidate: 60 * 60 * 24 },
    });
    if (odp.ok) komisje = await odp.json();
  } catch {
    komisje = [];
  }
  const stale = komisje.filter((k) => k.type === "STANDING" || k.type === "EXTRAORDINARY");

  const zrodlaOpis = (["sejm", "parlament_ue", "samorzady", "ministerstwa"] as ZrodloId[])
    .map((z) => `- ${z}: ${ZRODLA[z].nazwa}. ${ZRODLA[z].opis}`)
    .join("\n");

  const prompt = [
    `Kampania: ${nazwa || "(bez nazwy)"}`,
    `Cel: ${cel}`,
    `Materiały: ${materialy || "(brak)"}`,
    "",
    "Dostępne źródła odbiorców:",
    zrodlaOpis,
    "",
    "Komisje Sejmu (kod: nazwa):",
    ...stale.map((k) => `${k.code}: ${k.name}`),
    "",
    "Zadanie: wskaż, kto realnie decyduje albo ma wpływ w tej sprawie, i dobierz źródła oraz komisje. Zasady: sprawy lokalne (drogi, szkoły, komunikacja miejska) to przede wszystkim samorządy, a Sejm tylko gdy chodzi o ustawę, budżet państwa albo program rządowy; sprawy europejskie (regulacje UE, fundusze) to parlament_ue; sprawy ustawowe i budżet państwa to sejm plus właściwa komisja; sprawy wykonawcze (rozporządzenia, programy resortowe) to ministerstwa. Komisje tylko z listy, po kodzie. Nie dodawaj źródeł „na wszelki wypadek”.",
  ].join("\n");

  const client = new Anthropic();
  try {
    const odp = await client.beta.messages.parse({
      model: "claude-sonnet-5-5",
      max_tokens: 2000,
      output_config: { format: betaZodOutputFormat(Propozycja) },
      messages: [{ role: "user", content: prompt }],
    });
    if (!odp.parsed_output)
      return NextResponse.json({ blad: t("api.nieudanoPropozycji") }, { status: 502 });
    const p = odp.parsed_output;
    const znane = new Map(stale.map((k) => [k.code, k.name]));
    return NextResponse.json({
      zrodla: p.zrodla,
      komisje: p.komisje
        .filter((k) => znane.has(k.kod))
        .map((k) => ({ kod: k.kod, nazwa: znane.get(k.kod)!, dlaczego: k.dlaczego })),
      kogoSzukamy: p.kogoSzukamy,
      uzasadnienie: p.uzasadnienie,
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      return NextResponse.json({ blad: t("api.brakKluczaAI") }, { status: 500 });
    if (e instanceof Anthropic.APIError)
      return NextResponse.json({ blad: t("api.bladAI", { status: String(e.status) }) }, { status: 502 });
    throw e;
  }
}
