import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { odszyfruj } from "@/lib/szyfr";
import { opiszBladSmtp, transport } from "@/lib/smtp";

export const runtime = "nodejs";

/** Testowa wiadomość z podłączonej skrzynki. Domyślnie na adres samej skrzynki. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const supabase = await createClient();

  const { data: s } = await supabase
    .from("skrzynki")
    .select("id, nazwa, email_nadawcy, smtp_host, smtp_port, smtp_uzytkownik")
    .eq("id", id)
    .maybeSingle();
  if (!s) return NextResponse.json({ blad: "Nie znaleziono skrzynki." }, { status: 404 });

  const odbiorca = String(body.do ?? "").trim() || s.email_nadawcy;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(odbiorca)) return NextResponse.json({ blad: "Podaj poprawny adres odbiorcy." }, { status: 400 });

  const { data: zapis, error } = await supabase.rpc("pobierz_sekret_skrzynki", { p_skrzynka: s.id });
  if (error || !zapis) return NextResponse.json({ blad: "Brak zapisanego hasła. Podłącz skrzynkę ponownie." }, { status: 400 });

  const teraz = new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
  try {
    const info = await transport({ host: s.smtp_host, port: s.smtp_port, uzytkownik: s.smtp_uzytkownik, haslo: odszyfruj(zapis as string) }).sendMail({
      from: { name: s.nazwa, address: s.email_nadawcy },
      to: odbiorca,
      subject: "Target Force: testowa wiadomość",
      text: `To jest testowa wiadomość z Target Force (${teraz}).\n\nJeśli ją widzisz w skrzynce odbiorczej, a nie w spamie, skrzynka ${s.email_nadawcy} jest gotowa do kampanii.`,
    });
    return NextResponse.json({ ok: true, do: odbiorca, id: info.messageId });
  } catch (e) {
    return NextResponse.json({ blad: opiszBladSmtp(e) }, { status: 400 });
  }
}
