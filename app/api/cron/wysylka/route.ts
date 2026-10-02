import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wyslijKolejke } from "@/lib/wysylka-serwer";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Zapas przed limitem czasu funkcji: po tym czasie nie zaczynamy kolejnego maila. */
const BUDZET_MS = 240_000;

/**
 * Automat wysyłki (Vercel Cron, dni robocze rano, vercel.json). Dla każdej kampanii z włączoną automatyczną wysyłką,
 * od dnia startu: kolejna partia pierwszych wiadomości w limicie skrzynki, potem przypomnienia.
 * Chroniony CRON_SECRET (Vercel dokleja go sam w nagłówku Authorization).
 */
export async function GET(req: NextRequest) {
  const sekret = process.env.CRON_SECRET;
  if (!sekret || req.headers.get("authorization") !== `Bearer ${sekret}`)
    return NextResponse.json({ blad: "Brak dostępu." }, { status: 401 });
  const supabase = createAdminClient();
  if (!supabase)
    return NextResponse.json(
      { blad: "Brak SUPABASE_SERVICE_ROLE_KEY w środowisku." },
      { status: 500 },
    );

  const koniec = Date.now() + BUDZET_MS;
  const dzis = new Date().toISOString().slice(0, 10);
  const { data: kampanie, error } = await supabase
    .from("kampanie")
    .select("id, nazwa, status, skrzynka_id, start")
    .eq("auto_wysylka", true)
    .neq("status", "zakonczona")
    .not("skrzynka_id", "is", null)
    .or(`start.is.null,start.lte.${dzis}`);
  // Np. błędny klucz serwisowy: bez tego automat wyglądałby jak "brak kampanii".
  if (error) {
    console.error("cron wysylka: blad bazy", error.message);
    return NextResponse.json({ blad: `Baza: ${error.message}` }, { status: 500 });
  }

  const raport: { kampania: string; partia: string; przypomnienia: string }[] =
    [];
  for (const k of kampanie ?? []) {
    if (Date.now() > koniec) break;
    const [{ data: s }, { data: sekretSkrzynki }, { data: warianty }] =
      await Promise.all([
        supabase
          .from("skrzynki")
          .select(
            "id, nazwa, email_nadawcy, smtp_host, smtp_port, smtp_uzytkownik, dzienny_limit",
          )
          .eq("id", k.skrzynka_id)
          .maybeSingle(),
        supabase
          .from("skrzynki_sekrety")
          .select("haslo_zaszyfrowane")
          .eq("skrzynka_id", k.skrzynka_id)
          .maybeSingle(),
        supabase
          .from("warianty")
          .select("id, krok, numer, temat, tresc")
          .eq("kampania_id", k.id)
          .eq("status", "zatwierdzony")
          .order("krok")
          .order("numer"),
      ]);
    if (!s || !sekretSkrzynki?.haslo_zaszyfrowane) {
      raport.push({
        kampania: k.nazwa,
        partia: "brak skrzynki lub hasła",
        przypomnienia: "-",
      });
      continue;
    }
    const wspolne = {
      kampaniaId: k.id,
      skrzynka: s,
      hasloZaszyfrowane: sekretSkrzynki.haslo_zaszyfrowane as string,
      warianty: warianty ?? [],
      baza: req.nextUrl.origin,
      koniec,
    };
    // Prosimy o cały dzienny limit; silnik sam przytnie do tego, co zostało dziś, i do czasu.
    const partia = await wyslijKolejke(supabase, {
      ...wspolne,
      statusKampanii: k.status,
      tryb: "partia",
      ile: s.dzienny_limit,
    });
    const przyp = await wyslijKolejke(supabase, {
      ...wspolne,
      statusKampanii: "uruchomiona",
      tryb: "przypomnienia",
      ile: s.dzienny_limit,
    });
    const opis = (w: Awaited<ReturnType<typeof wyslijKolejke>>) =>
      w.ok
        ? `wysłano ${w.wyslane}${w.bledy.length ? `, błędy ${w.bledy.length}` : ""}`
        : w.blad;
    raport.push({
      kampania: k.nazwa,
      partia: opis(partia),
      przypomnienia: opis(przyp),
    });
  }
  console.log("cron wysylka", JSON.stringify(raport));
  return NextResponse.json({ ok: true, raport });
}
