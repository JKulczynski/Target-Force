import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tSerwer } from "@/lib/i18n/serwer";
import type { Tlumacz } from "@/lib/i18n";

/**
 * Wypisanie odbiorcy: /w/{kod wiadomości}. GET pokazuje stronę z przyciskiem, POST wypisuje
 * (także "one-click" z nagłówka List-Unsubscribe, który Gmail i Outlook wysyłają same).
 * Wypisany nie dostaje przypomnień ani kolejnych wysyłek z tej kampanii.
 * Odbiorca zwykle nie ma cookie języka, więc domyślnie strona jest po polsku.
 */
const strona = (t: Tlumacz, tresc: string) => `<!doctype html><html lang="${t.jezyk}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Target Force</title>
<style>body{font-family:system-ui,sans-serif;background:#faf7f8;color:#1f1a1c;margin:0;padding:48px 16px}
main{max-width:480px;margin:0 auto;background:#fff;border:1px solid #e8dfe2;border-radius:16px;padding:32px}
h1{font-size:22px;margin:0 0 8px}p{color:#5a4f53;line-height:1.5}button{background:#b3133f;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:15px;cursor:pointer}</style>
</head><body><main>${tresc}</main></body></html>`;

const HTML = { "Content-Type": "text/html; charset=utf-8" };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ kod: string }> }) {
  const { kod } = await ctx.params;
  const t = await tSerwer();
  if (!/^[0-9a-f]{8}$/.test(kod))
    return new NextResponse(strona(t, `<h1>${t("wypis.nieprawidlowy")}</h1>`), { status: 400, headers: HTML });
  return new NextResponse(
    strona(
      t,
      `<h1>${t("wypis.tytul")}</h1>
<p>${t("wypis.opis")}</p>
<form method="post"><button type="submit">${t("wypis.przycisk")}</button></form>`,
    ),
    { headers: HTML },
  );
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ kod: string }> }) {
  const { kod } = await ctx.params;
  const t = await tSerwer();
  if (!/^[0-9a-f]{8}$/.test(kod)) return new NextResponse(t("wypis.nieprawidlowy"), { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("wypisz_kod", { p_kod: kod });
  if (!data)
    return new NextResponse(strona(t, `<h1>${t("wypis.nieprawidlowy")}</h1>`), { status: 404, headers: HTML });
  return new NextResponse(strona(t, `<h1>${t("wypis.gotowe")}</h1><p>${t("wypis.gotowe.opis")}</p>`), {
    headers: HTML,
  });
}
