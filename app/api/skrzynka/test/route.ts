import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { odszyfruj } from "@/lib/szyfr";
import { opiszBladSmtp, transport } from "@/lib/smtp";
import { tSerwer } from "@/lib/i18n/serwer";

export const runtime = "nodejs";

/** Testowa wiadomość z podłączonej skrzynki. Domyślnie na adres samej skrzynki. */
export async function POST(req: NextRequest) {
  const t = await tSerwer();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const supabase = await createClient();

  const { data: s } = await supabase
    .from("skrzynki")
    .select("id, nazwa, email_nadawcy, smtp_host, smtp_port, smtp_uzytkownik")
    .eq("id", id)
    .maybeSingle();
  if (!s) return NextResponse.json({ blad: t("api.nieZnalezionoSkrzynki") }, { status: 404 });

  const odbiorca = String(body.do ?? "").trim() || s.email_nadawcy;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(odbiorca)) return NextResponse.json({ blad: t("api.zlyAdresOdbiorcy") }, { status: 400 });

  const { data: zapis, error } = await supabase.rpc("pobierz_sekret_skrzynki", { p_skrzynka: s.id });
  if (error || !zapis) return NextResponse.json({ blad: t("api.brakHaslaPodlacz") }, { status: 400 });

  const teraz = new Date().toLocaleString(t.locale, { timeZone: "Europe/Warsaw" });
  try {
    const info = await transport({ host: s.smtp_host, port: s.smtp_port, uzytkownik: s.smtp_uzytkownik, haslo: odszyfruj(zapis as string) }).sendMail({
      from: { name: s.nazwa, address: s.email_nadawcy },
      to: odbiorca,
      subject: t("api.testTemat"),
      text: t("api.testTresc", { teraz, email: s.email_nadawcy }),
    });
    return NextResponse.json({ ok: true, do: odbiorca, id: info.messageId });
  } catch (e) {
    return NextResponse.json({ blad: opiszBladSmtp(e, t.jezyk) }, { status: 400 });
  }
}
