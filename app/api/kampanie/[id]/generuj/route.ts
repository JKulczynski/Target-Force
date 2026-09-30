import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ZRODLA, type ZrodloId } from "@/lib/types";

export const runtime = "nodejs";
// Generowanie kilku wariantów z myśleniem trwa zwykle 1-2 minuty.
export const maxDuration = 300;

const Wynik = z.object({
  psychografia: z.string().describe("Profil grupy odbiorców: jak myślą, co ich przekonuje, czego unikać. 5-8 krótkich punktów."),
  warianty: z.array(z.object({ temat: z.string(), tresc: z.string() })),
  przypomnienia: z.array(z.object({ temat: z.string(), tresc: z.string() })),
});

// Język wiadomości wynika ze źródła odbiorców.
const JEZYK: Partial<Record<ZrodloId, string>> = {
  sejm: "polski",
  tweede_kamer: "niderlandzki",
  parlament_ue: "angielski",
};

const SYSTEM = `Piszesz wiadomości e-mail do decydentów w imieniu nadawcy kampanii (Target Force).
Zasady:
- Psychografia dotyczy GRUPY odbiorców (np. posłowie komisji spraw zagranicznych), nigdy konkretnych nazwanych osób.
- Używasz wyłącznie faktów z celu i materiałów kampanii. Nie wymyślasz liczb, cytatów ani wydarzeń.
- Wiadomość ma brzmieć jak od prawdziwego człowieka: krótko (120-180 słów), rzeczowo, uprzejmie, bez patosu i bez marketingowych haseł.
- Jedna jasna prośba na końcu (np. obejrzenie filmu, odpowiedź, spotkanie). Link, jeśli jest, wpleciony naturalnie.
- Każdy wariant ma inny kąt, inne otwarcie i inną strukturę, żeby maile nie wyglądały na masową wysyłkę.
- Tematy krótkie i konkretne, bez clickbaitu i bez wielkich liter.
- Przypomnienia są krótsze (50-90 słów), nawiązują do wcześniejszej wiadomości i niczego nie wymuszają.
- Zwrot grzecznościowy neutralny płciowo (bez imion). Podpis: nadawca kampanii.
- Nigdy nie używaj długiego myślnika (znak Unicode U+2014). Zamiast niego przecinek, kropka albo nawias.`;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: k } = await supabase
    .from("kampanie")
    .select("id, nazwa, zrodla, kogo_szukamy, cel, nadawca, link_film, materialy, liczba_wariantow, liczba_followupow")
    .eq("id", id)
    .maybeSingle();
  if (!k) return NextResponse.json({ blad: "Nie znaleziono kampanii albo brak dostępu." }, { status: 404 });

  const zrodla = (k.zrodla as ZrodloId[]) ?? [];
  const jezyk = zrodla.map((z) => JEZYK[z]).find(Boolean) ?? "polski";
  const liczbaWariantow = Math.min(Math.max(k.liczba_wariantow ?? 3, 1), 10);
  const liczbaPrzypomnien = Math.min(Math.max(k.liczba_followupow ?? 0, 0), 5);

  const brief = [
    `Kampania: ${k.nazwa}`,
    `Cel: ${k.cel}`,
    `Nadawca: ${k.nadawca || "(nie podano)"}`,
    `Odbiorcy (źródła): ${zrodla.map((z) => ZRODLA[z]?.nazwa ?? z).join(", ") || "(brak)"}`,
    `Kogo dokładnie szukamy: ${k.kogo_szukamy || "(bez zawężenia)"}`,
    `Link: ${k.link_film || "(brak)"}`,
    `Materiały: ${k.materialy || "(brak)"}`,
    "",
    `Napisz wiadomości w języku: ${jezyk}. Psychografię napisz po polsku.`,
    `Przygotuj dokładnie ${liczbaWariantow} wariantów pierwszej wiadomości i ${liczbaPrzypomnien} przypomnień (po jednym na każde kolejne przypomnienie, w kolejności).`,
  ].join("\n");

  const client = new Anthropic();
  let wynik: z.infer<typeof Wynik>;
  try {
    const odp = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(Wynik) },
      system: SYSTEM,
      messages: [{ role: "user", content: brief }],
    });
    if (odp.stop_reason === "refusal") {
      return NextResponse.json({ blad: "Model odmówił napisania tych wiadomości. Zmień cel albo materiały." }, { status: 422 });
    }
    if (!odp.parsed_output) {
      return NextResponse.json({ blad: "Nie udało się odczytać wygenerowanych wiadomości. Spróbuj ponownie." }, { status: 502 });
    }
    wynik = odp.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ blad: "Brak albo zły klucz ANTHROPIC_API_KEY na serwerze." }, { status: 500 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ blad: "Za dużo zapytań do AI. Spróbuj za chwilę." }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ blad: `Błąd AI (${e.status}). Spróbuj ponownie.` }, { status: 502 });
    }
    throw e;
  }

  // Nowe generowanie zastępuje szkice; zatwierdzone warianty zostają.
  await supabase.from("warianty").delete().eq("kampania_id", id).neq("status", "zatwierdzony");

  const wiersze = [
    ...wynik.warianty.slice(0, liczbaWariantow).map((w, i) => ({ kampania_id: id, krok: 0, numer: i + 1, temat: w.temat, tresc: w.tresc })),
    ...wynik.przypomnienia.slice(0, liczbaPrzypomnien).map((w, i) => ({ kampania_id: id, krok: i + 1, numer: 1, temat: w.temat, tresc: w.tresc })),
  ];
  const { error } = await supabase.from("warianty").insert(wiersze);
  if (error) return NextResponse.json({ blad: "Nie udało się zapisać wiadomości." }, { status: 500 });

  await supabase.from("kampanie").update({ psychografia_opis: wynik.psychografia, jezyk }).eq("id", id);
  return NextResponse.json({ ok: true, liczba: wiersze.length });
}
