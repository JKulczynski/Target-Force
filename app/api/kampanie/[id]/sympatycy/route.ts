import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tSerwer } from "@/lib/i18n/serwer";
import { trybProbny, wyslijWiele } from "@/lib/poczta-winover";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAKS_ODBIORCOW = 2000;

/**
 * Mail do sympatyków (plan strony akcji, część 4, 12.10): tylko do osób, które zaznaczyły zgodę na kontakt
 * od organizatora. Nadawca: nazwa organizacji, odpowiedzi do osoby odpowiedzialnej z oświadczenia.
 * Każdy mail ma link do wypisania (/p/{token}?wypisz=1). Najwyżej jeden mail na godzinę na kampanię.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const body = await req.json().catch(() => ({}));
  const temat = String(body.temat ?? "").trim().slice(0, 200);
  const tresc = String(body.tresc ?? "").trim().slice(0, 5000);
  if (temat.length < 3 || tresc.length < 20)
    return NextResponse.json({ blad: t("sympatycy.zaKrotko") }, { status: 400 });

  // Dostęp sprawdza RLS: jeśli użytkownik nie widzi kampanii, nie wyśle.
  const supabase = await createClient();
  const { data: uzytkownik } = await supabase.auth.getUser();
  const { data: k } = await supabase
    .from("kampanie")
    .select("id, nazwa, nadawca, akcja_slug, akcja_tytul, zgoda_zespolu")
    .eq("id", id)
    .maybeSingle();
  if (!k || !uzytkownik.user) return NextResponse.json({ blad: t("api.nieZnalezionoKampanii") }, { status: 404 });
  if (k.zgoda_zespolu !== "zaakceptowana")
    return NextResponse.json({ blad: t("api.brakZgody") }, { status: 403 });
  if (process.env.WYSYLKA_WSTRZYMANA === "1")
    return NextResponse.json({ blad: t("api.wysylkaWstrzymana") }, { status: 503 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ blad: t("api.brakKluczaSerwisowego") }, { status: 500 });

  const godzinaTemu = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: ostatnie } = await admin
    .from("maile_sympatykow")
    .select("id", { count: "exact", head: true })
    .eq("kampania_id", k.id)
    .gte("wyslano", godzinaTemu);
  if ((ostatnie ?? 0) > 0) return NextResponse.json({ blad: t("sympatycy.raz") }, { status: 429 });

  const [{ data: odbiorcy }, { data: osw }] = await Promise.all([
    admin
      .from("podpisy")
      .select("id, imie, email")
      .eq("kampania_id", k.id)
      .eq("zgoda_informacje", true)
      .not("email", "is", null)
      .limit(MAKS_ODBIORCOW),
    admin
      .from("oswiadczenia")
      .select("tresc")
      .eq("kampania_id", k.id)
      .order("utworzone", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const lista = odbiorcy ?? [];
  if (lista.length === 0) return NextResponse.json({ blad: t("sympatycy.brakOdbiorcow") }, { status: 400 });
  const { data: tokeny } = await admin
    .from("podpisy_wysylka")
    .select("podpis_id, token")
    .in(
      "podpis_id",
      lista.map((p) => p.id),
    );
  const tokenDla = new Map((tokeny ?? []).map((r) => [r.podpis_id, r.token]));
  const odpowiedzDo = (osw?.tresc as { email?: string } | undefined)?.email;
  const sprawa = k.akcja_tytul || k.nazwa;

  const wynik = await wyslijWiele(
    lista.map((p) => {
      const token = tokenDla.get(p.id);
      const stopka = t("sympatycy.stopka", {
        nadawca: k.nadawca || "organizator",
        sprawa,
        link: token ? `${req.nextUrl.origin}/p/${token}?wypisz=1` : `${req.nextUrl.origin}/a/${k.akcja_slug ?? ""}`,
      });
      return {
        doKogo: p.email as string,
        temat,
        tresc: `${tresc.replaceAll("{imie}", p.imie)}\n\n--\n${stopka}`,
        nadawca: (k.nadawca || "WinOver").replace(/["<>\r\n]/g, " ").slice(0, 70),
        odpowiedzDo,
      };
    }),
  );
  await admin.from("maile_sympatykow").insert({
    kampania_id: k.id,
    user_id: uzytkownik.user.id,
    temat,
    tresc,
    odbiorcow: wynik.wyslane,
    proba: trybProbny(),
  });
  return NextResponse.json({ ok: true, wyslane: wynik.wyslane, bledy: wynik.bledy, proba: trybProbny() });
}
