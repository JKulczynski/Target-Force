import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tSerwer } from "@/lib/i18n/serwer";
import { cytat, linkIsap } from "@/lib/cytaty";
import { powolaniaNaArtykuly, wykryj } from "@/lib/wskazowki-prawne";
import type { Ustawa } from "@/lib/ustawy";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Wskazówki prawne do treści wiadomości (14.10). Body { temat, tresc, rola }. Zwraca listę wskazówek
 * z fragmentem tekstu i cytatami przepisów w aktualnym brzmieniu, plus brzmienie artykułów ustawy kampanii,
 * na które powołuje się wiadomość. Podpowiedź, nie opinia prawna.
 */
type Cytat = { przepis: string; tekst: string | null; link: string | null };
type Wskazowka = { id: string; tytul: string; wyjasnienie: string; fragment: string; cytaty: Cytat[]; pilne?: boolean };

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = await tSerwer();
  const body = await req.json().catch(() => ({}));
  const tekst = `${String(body.temat ?? "")}\n${String(body.tresc ?? "")}`.slice(0, 8000);
  const rola: "nadawca" | "sympatyk" = body.rola === "sympatyk" ? "sympatyk" : "nadawca";

  const supabase = await createClient();
  const [{ data: k }, { data: osw }] = await Promise.all([
    supabase.from("kampanie").select("ustawa").eq("id", id).maybeSingle(),
    supabase.from("oswiadczenia").select("tresc").eq("kampania_id", id).order("utworzone", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!k) return NextResponse.json({ blad: t("api.nieZnalezionoKampanii") }, { status: 404 });

  const wskazowki: Wskazowka[] = await Promise.all(
    wykryj(tekst, rola).map(async ({ regula, fragment }) => ({
      id: regula.id,
      tytul: regula.tytul,
      wyjasnienie: regula.wyjasnienie,
      fragment,
      cytaty: await Promise.all(
        regula.zrodla.map(async (z) =>
          "wewnetrzne" in z
            ? { przepis: z.wewnetrzne, tekst: null, link: "/regulamin" }
            : { przepis: `art. ${z.art} ${z.skrot}`, tekst: await cytat(z.eli, z.art), link: await linkIsap(z.eli) },
        ),
      ),
    })),
  );

  // Cisza wyborcza: agitacja w dniu głosowania i 24 h przed nim (art. 107 § 1 Kodeksu wyborczego).
  const o = osw?.tresc as { wybory?: string; wyboryData?: string } | undefined;
  if (o?.wybory === "tak" && o.wyboryData) {
    const doWyborow = (new Date(`${o.wyboryData}T00:00:00`).getTime() - Date.now()) / 86_400_000;
    const agitacja = wskazowki.find((w) => w.id === "agitacja");
    if (agitacja && doWyborow > -1 && doWyborow <= 1) agitacja.pilne = true;
  }

  // Powołania na artykuły ustawy kampanii: pokazujemy aktualne brzmienie, żeby nadawca sprawdził, czy cytuje dobrze.
  const ustawa = k.ustawa as Ustawa | null;
  const artykuly = ustawa ? powolaniaNaArtykuly(tekst) : [];
  if (ustawa && artykuly.length) {
    const link = await linkIsap(ustawa.eli);
    const cytaty = await Promise.all(
      artykuly.map(async (a) => ({ przepis: `art. ${a} (${ustawa.tytul})`, tekst: (await cytat(ustawa.eli, a)) ?? t("wskazowki.brakArtykulu"), link })),
    );
    wskazowki.push({
      id: "artykuly",
      tytul: t("wskazowki.artykulyTytul"),
      wyjasnienie: t("wskazowki.artykulyOpis"),
      fragment: "",
      cytaty,
    });
  }

  return NextResponse.json({ wskazowki });
}
