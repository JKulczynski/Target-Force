import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { tSerwer } from "@/lib/i18n/serwer";
import { projektyZmian, szukajUstaw, type Ustawa } from "@/lib/ustawy";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Zmiany w drodze (14.10). GET: ustawa kampanii i projekty jej zmian w Sejmie z etapem.
 * POST: AI podaje słowa z tytułu ustawy, serwer szuka w Dzienniku Ustaw (sejmdiff), nadawca wybiera.
 * PUT: zapis wyboru albo null.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const supabase = await createClient();
  const { data: k } = await supabase.from("kampanie").select("ustawa").eq("id", id).maybeSingle();
  if (!k) return NextResponse.json({ blad: t("api.nieZnalezionoKampanii") }, { status: 404 });
  const u = k.ustawa as Ustawa | null;
  if (!u) return NextResponse.json({ ustawa: null });
  try {
    return NextResponse.json({ ustawa: u, projekty: await projektyZmian(u.eli) });
  } catch {
    return NextResponse.json({ ustawa: u, projekty: null, blad: t("ustawa.brakDanych") });
  }
}

const Slowa = z.object({
  ustawy: z
    .array(
      z
        .string()
        .describe("Kilka słów z tytułu ustawy w formie z tytułu, np. „ochronie przyrody”, „prawo oświatowe”, „systemie oświaty”."),
    )
    .describe("1-3 ustawy, które kampania realnie chce zmienić albo których dotyczy sprawa; pusta lista, jeśli sprawa nie dotyczy ustawy."),
});

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const supabase = await createClient();
  const { data: k } = await supabase.from("kampanie").select("nazwa, cel, materialy").eq("id", id).maybeSingle();
  if (!k) return NextResponse.json({ blad: t("api.nieZnalezionoKampanii") }, { status: 404 });
  try {
    const odp = await new Anthropic().beta.messages.parse({
      model: "claude-sonnet-5-5",
      max_tokens: 500,
      output_config: { format: betaZodOutputFormat(Slowa) },
      messages: [
        {
          role: "user",
          content: `Sprawa kampanii: ${k.nazwa}\nCel: ${k.cel || "(brak)"}\nMateriały: ${(k.materialy || "(brak)").slice(0, 3000)}\n\nJakich polskich ustaw dotyczy ta sprawa? Podaj słowa z ich tytułów do wyszukania w Dzienniku Ustaw.`,
        },
      ],
    });
    const slowa = odp.parsed_output?.ustawy.slice(0, 3) ?? [];
    const widziane = new Set<string>();
    const kandydaci = (await Promise.all(slowa.map((s) => szukajUstaw(s).catch(() => [] as Ustawa[]))))
      .flatMap((l) => l.slice(0, 3))
      .filter((u) => !widziane.has(u.eli) && !!widziane.add(u.eli))
      .slice(0, 6);
    return NextResponse.json({ kandydaci });
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
  const u = body?.ustawa;
  const wartosc: Ustawa | null = u ? { eli: String(u.eli ?? ""), tytul: String(u.tytul ?? "").slice(0, 400) } : null;
  if (wartosc && !/^(DU|MP)\/\d{4}\/\d+$/.test(wartosc.eli))
    return NextResponse.json({ blad: t("ustawa.zleDane") }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("kampanie").update({ ustawa: wartosc }).eq("id", id).select("id");
  if (error || !data?.length) return NextResponse.json({ blad: t("api.nieZnalezionoKampanii") }, { status: 404 });
  return NextResponse.json({ ok: true, ustawa: wartosc });
}
