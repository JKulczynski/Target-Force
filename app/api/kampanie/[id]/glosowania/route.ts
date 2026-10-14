import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { tSerwer } from "@/lib/i18n/serwer";
import { glosowaniaKoncowe, glosyPoslow, type Glosowanie } from "@/lib/glosowania";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Głosowanie jako argument (14.10). GET: wybrane głosowanie i jak głosowali poslowie z listy kampanii.
 * POST: AI proponuje do 3 głosowań końcowych tej kadencji związanych ze sprawą (tylko z listy, bez zmyślania).
 * PUT: zapis wyboru (albo null = bez głosowania).
 */
type Ctx = { params: Promise<{ id: string }> };

async function podsumowanie(supabase: Awaited<ReturnType<typeof createClient>>, id: string, g: Glosowanie) {
  const { data: kontakty } = await supabase.from("kontakty").select("zewnetrzne_id").eq("kampania_id", id).eq("zrodlo", "sejm");
  const glosy = await glosyPoslow(g);
  const licz = { za: 0, przeciw: 0, inne: 0 };
  for (const c of kontakty ?? []) {
    const v = c.zewnetrzne_id ? glosy.get(c.zewnetrzne_id) : undefined;
    if (v === "YES") licz.za++;
    else if (v === "NO") licz.przeciw++;
    else licz.inne++;
  }
  return licz;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const supabase = await createClient();
  const { data: k } = await supabase.from("kampanie").select("glosowanie").eq("id", id).maybeSingle();
  if (!k) return NextResponse.json({ blad: t("api.nieZnalezionoKampanii") }, { status: 404 });
  const g = k.glosowanie as Glosowanie | null;
  if (!g) return NextResponse.json({ wybrane: null });
  try {
    return NextResponse.json({ wybrane: g, poslowie: await podsumowanie(supabase, id, g) });
  } catch {
    return NextResponse.json({ wybrane: g, poslowie: null });
  }
}

const Propozycje = z.object({
  glosowania: z
    .array(
      z.object({
        nr: z.number().describe("Numer z listy (pierwsza liczba w wierszu)."),
        za: z.string().describe("Krótka nazwa ustawy w narzędniku, do zdania „głos za ...”, np. „nowelizacją ustawy o ochronie przyrody”."),
        przeciw: z.string().describe("Ta sama nazwa w celowniku, do zdania „głos przeciw ...”, np. „nowelizacji ustawy o ochronie przyrody”."),
        dlaczego: z.string().describe("Jedno zdanie: jaki związek ma to głosowanie ze sprawą kampanii."),
      }),
    )
    .describe("0-3 głosowania naprawdę związane ze sprawą; pusta lista, jeśli nic nie pasuje."),
});

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const supabase = await createClient();
  const { data: k } = await supabase.from("kampanie").select("nazwa, cel, materialy").eq("id", id).maybeSingle();
  if (!k) return NextResponse.json({ blad: t("api.nieZnalezionoKampanii") }, { status: 404 });

  let lista;
  try {
    lista = await glosowaniaKoncowe();
  } catch {
    return NextResponse.json({ blad: t("glosowanie.brakDanych") }, { status: 502 });
  }
  const prompt = [
    `Sprawa kampanii: ${k.nazwa}`,
    `Cel: ${k.cel || "(brak)"}`,
    `Materiały: ${(k.materialy || "(brak)").slice(0, 3000)}`,
    "",
    "Głosowania końcowe Sejmu X kadencji (nr | data | tytuł):",
    ...lista.map((g, i) => `${i} | ${g.data} | ${g.tytul.slice(0, 300)}`),
    "",
    "Zadanie: wybierz najwyżej 3 głosowania, które dotyczą tej samej sprawy albo ustawy, którą kampania chce zmienić, tak że poseł, który w nich głosował, realnie się tym tematem zajmował. Nie wybieraj głosowań luźno związanych. Lepiej pusta lista niż naciągany związek.",
  ].join("\n");

  try {
    const odp = await new Anthropic().beta.messages.parse({
      model: "claude-sonnet-5-5",
      max_tokens: 2000,
      output_config: { format: betaZodOutputFormat(Propozycje) },
      messages: [{ role: "user", content: prompt }],
    });
    const p = odp.parsed_output;
    if (!p) return NextResponse.json({ blad: t("api.nieudanoPropozycji") }, { status: 502 });
    const propozycje: (Glosowanie & { dlaczego: string; zaWszyscy: number; przeciwWszyscy: number })[] = p.glosowania
      .filter((x) => lista[x.nr])
      .slice(0, 3)
      .map((x) => {
        const g = lista[x.nr];
        return {
          posiedzenie: g.posiedzenie,
          numer: g.numer,
          data: g.data,
          tytul: g.tytul,
          za: x.za,
          przeciw: x.przeciw,
          dlaczego: x.dlaczego,
          zaWszyscy: g.za,
          przeciwWszyscy: g.przeciw,
        };
      });
    return NextResponse.json({ propozycje, przejrzano: lista.length });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ blad: t("api.brakKluczaAI") }, { status: 500 });
    if (e instanceof Anthropic.APIError)
      return NextResponse.json({ blad: t("api.bladAI", { status: String(e.status) }) }, { status: 502 });
    throw e;
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const body = await req.json().catch(() => ({}));
  const g = body?.glosowanie;
  let wartosc: Glosowanie | null = null;
  if (g) {
    const tekst = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    wartosc = {
      posiedzenie: Number(g.posiedzenie),
      numer: Number(g.numer),
      data: tekst(g.data, 10),
      tytul: tekst(g.tytul, 600),
      za: tekst(g.za, 200),
      przeciw: tekst(g.przeciw, 200),
    };
    if (!Number.isInteger(wartosc.posiedzenie) || !Number.isInteger(wartosc.numer) || !/^\d{4}-\d{2}-\d{2}$/.test(wartosc.data) || !wartosc.za || !wartosc.przeciw)
      return NextResponse.json({ blad: t("glosowanie.zleDane") }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("kampanie").update({ glosowanie: wartosc }).eq("id", id).select("id");
  if (error || !data?.length) return NextResponse.json({ blad: t("api.nieZnalezionoKampanii") }, { status: 404 });
  return NextResponse.json({ ok: true, glosowanie: wartosc });
}
