import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { odszyfruj } from "@/lib/szyfr";
import { powiadomAdminow } from "@/lib/powiadomienia";
import { opiszBladImap, sprawdzOdpowiedzi } from "@/lib/odpowiedzi-serwer";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Automat odpowiedzi (Vercel Cron, dni robocze rano, przed wysyłką): dla każdej skrzynki z kampanią,
 * z której coś poszło, sprawdza IMAP i oznacza, kto odpisał. Dzięki temu przypomnienia omijają osoby,
 * które już odpowiedziały, bez ręcznego klikania. Chroniony CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const sekret = process.env.CRON_SECRET;
  if (!sekret || req.headers.get("authorization") !== `Bearer ${sekret}`)
    return NextResponse.json({ blad: "Brak dostępu." }, { status: 401 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ blad: "Brak SUPABASE_SERVICE_ROLE_KEY w środowisku." }, { status: 500 });

  const { data: skrzynki } = await supabase
    .from("skrzynki")
    .select("id, email_nadawcy, smtp_host, smtp_uzytkownik, imap_host, imap_port, odpowiedzi_sprawdzone");
  const raport: { skrzynka: string; wynik: string; blad?: boolean }[] = [];
  for (const s of skrzynki ?? []) {
    const { data: sek } = await supabase.from("skrzynki_sekrety").select("haslo_zaszyfrowane").eq("skrzynka_id", s.id).maybeSingle();
    if (!sek?.haslo_zaszyfrowane) {
      raport.push({ skrzynka: s.email_nadawcy, wynik: "brak hasła" });
      continue;
    }
    try {
      const w = await sprawdzOdpowiedzi(supabase, s, odszyfruj(sek.haslo_zaszyfrowane));
      raport.push({ skrzynka: s.email_nadawcy, wynik: `sprawdzono ${w.sprawdzono}, nowych odpowiedzi ${w.nowe.length}` });
    } catch (e) {
      raport.push({ skrzynka: s.email_nadawcy, wynik: opiszBladImap(e), blad: true });
    }
  }
  console.log("cron odpowiedzi", JSON.stringify(raport));
  const bledy = raport.filter((r) => r.blad);
  if (bledy.length)
    await powiadomAdminow(
      supabase,
      `WinOver: automat odpowiedzi nie sprawdził ${bledy.length} skrzynek`,
      bledy.map((b) => `${b.skrzynka}: ${b.wynik}`).join("\n") + "\n\nBez tego raport nie pokaże, kto odpisał, a przypomnienia mogą pójść do osób, które już odpowiedziały.",
    );
  return NextResponse.json({ ok: true, raport });
}
