import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ZRODLA, type ZrodloId } from "@/lib/types";
import { WARSZTAT } from "@/lib/prompty/pisanie";
import { psychografiaDla } from "@/lib/prompty/odbiorcy";

export const runtime = "nodejs";
// Generowanie kilku wariantów z myśleniem trwa zwykle 1-2 minuty.
export const maxDuration = 300;

const Wynik = z.object({
  psychografia: z
    .string()
    .describe(
      "Profil grupy odbiorców dopasowany do tej kampanii: co chcą osiągnąć, czego się boją, co ich przekonuje, czego unikać. 5-8 krótkich punktów, każdy ze źródłem w nawiasie ([profil bazowy], [materiały] albo [hipoteza]); hipotezy na końcu, najwyżej dwie.",
    ),
  warianty: z.array(z.object({ temat: z.string(), tresc: z.string() })),
  przypomnienia: z.array(z.object({ temat: z.string(), tresc: z.string() })),
});

// Język wiadomości wynika ze źródła odbiorców.
const JEZYK: Partial<Record<ZrodloId, string>> = {
  sejm: "polski",
  samorzady: "polski",
  ministerstwa: "polski",
  tweede_kamer: "niderlandzki",
  parlament_ue: "angielski",
};

const SYSTEM = `Piszesz wiadomości e-mail do decydentów w imieniu nadawcy kampanii w narzędziu Target Force.
Psychografia dotyczy GRUPY odbiorców (np. posłowie komisji spraw zagranicznych), nigdy konkretnych nazwanych osób.
Najpierw ułóż psychografię grupy według metody i profilu bazowego (dostaniesz je osobno), potem pisz wiadomości tak, żeby wynikały z tej psychografii. Trzymaj się poniższego warsztatu.

${WARSZTAT}`;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: k } = await supabase
    .from("kampanie")
    .select(
      "id, nazwa, zrodla, kogo_szukamy, cel, nadawca, link_film, materialy, liczba_wariantow, liczba_followupow",
    )
    .eq("id", id)
    .maybeSingle();
  if (!k)
    return NextResponse.json(
      { blad: "Nie znaleziono kampanii albo brak dostępu." },
      { status: 404 },
    );

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
    ...(zrodla.includes("sejm")
      ? [
          "Lokalny argument: odbiorcami są posłowie na Sejm. W jednym zdaniu każdej wiadomości naturalnie użyj pola {okreg} (miasto okręgu wyborczego posła, np. Kraków), najlepiej w zdaniu o skutku sprawy dla mieszkańców, np. „...a w {okreg} dotyczy to kilkuset rodzin”. Nie pisz formułki w stylu „piszę do Pana/Pani jako posła z okręgu”. Pola wstawimy automatycznie, nie wpisuj za nie żadnych nazw. Nie używaj zwrotów zależnych od płci poza formą „Pan/Pani”.",
        ]
      : []),
    ...(zrodla.includes("samorzady")
      ? [
          "Odbiorcami są urzędy samorządowe (gminy, powiaty, województwa), mail trafia na ogólny adres urzędu. Zwracaj się do urzędu, np. „Szanowni Państwo”, i poproś o przekazanie wiadomości wójtowi, burmistrzowi, prezydentowi miasta albo staroście. W jednym zdaniu użyj pola {okreg} (nazwa gminy, powiatu albo województwa), np. „Piszę do Państwa w sprawie, która dotyczy mieszkańców {okreg}”. Nie używaj pól {imie} ani {nazwisko}.",
        ]
      : []),
    ...(zrodla.includes("ministerstwa")
      ? [
          "Odbiorcami są ministerstwa, mail trafia na ogólny adres kancelarii. Zwracaj się do urzędu, np. „Szanowni Państwo”, i poproś o przekazanie wiadomości właściwemu departamentowi (nazwij go tylko, jeśli wynika z materiałów). W tekście nie używaj pól {imie}, {nazwisko} ani {okreg}; nazwę ministerstwa możesz wstawić polem {nazwisko} wyłącznie w zdaniu typu „Piszę do {nazwisko} w sprawie...”.",
        ]
      : []),
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
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: psychografiaDla(zrodla) },
      ],
      messages: [{ role: "user", content: brief }],
    });
    if (odp.stop_reason === "refusal") {
      return NextResponse.json(
        {
          blad: "Model odmówił napisania tych wiadomości. Zmień cel albo materiały.",
        },
        { status: 422 },
      );
    }
    if (!odp.parsed_output) {
      return NextResponse.json(
        {
          blad: "Nie udało się odczytać wygenerowanych wiadomości. Spróbuj ponownie.",
        },
        { status: 502 },
      );
    }
    wynik = odp.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { blad: "Brak albo zły klucz ANTHROPIC_API_KEY na serwerze." },
        { status: 500 },
      );
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { blad: "Za dużo zapytań do AI. Spróbuj za chwilę." },
        { status: 429 },
      );
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { blad: `Błąd AI (${e.status}). Spróbuj ponownie.` },
        { status: 502 },
      );
    }
    throw e;
  }

  // Nowe generowanie zastępuje szkice; zatwierdzone warianty zostają.
  await supabase
    .from("warianty")
    .delete()
    .eq("kampania_id", id)
    .neq("status", "zatwierdzony");

  const wiersze = [
    ...wynik.warianty
      .slice(0, liczbaWariantow)
      .map((w, i) => ({
        kampania_id: id,
        krok: 0,
        numer: i + 1,
        temat: w.temat,
        tresc: w.tresc,
      })),
    ...wynik.przypomnienia
      .slice(0, liczbaPrzypomnien)
      .map((w, i) => ({
        kampania_id: id,
        krok: i + 1,
        numer: 1,
        temat: w.temat,
        tresc: w.tresc,
      })),
  ];
  const { error } = await supabase.from("warianty").insert(wiersze);
  if (error)
    return NextResponse.json(
      { blad: "Nie udało się zapisać wiadomości." },
      { status: 500 },
    );

  await supabase
    .from("kampanie")
    .update({ psychografia_opis: wynik.psychografia, jezyk })
    .eq("id", id);
  return NextResponse.json({ ok: true, liczba: wiersze.length });
}
