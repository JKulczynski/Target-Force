import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { zaszyfruj } from "@/lib/szyfr";
import { opiszBladSmtp, podpowiedzSerwer, transport } from "@/lib/smtp";
import { tSerwer } from "@/lib/i18n/serwer";

export const runtime = "nodejs";

const KOLUMNY = "id, nazwa, email_nadawcy, smtp_host, smtp_port, dzienny_limit, sprawdzona, utworzona";

/** Lista podłączonych skrzynek (bez haseł). */
export async function GET() {
  const t = await tSerwer();
  const supabase = await createClient();
  const { data, error } = await supabase.from("skrzynki").select(KOLUMNY).order("utworzona");
  if (error) return NextResponse.json({ blad: t("api.nieudanoPobracSkrzynek") }, { status: 500 });
  return NextResponse.json(data);
}

/** Podłączenie skrzynki: najpierw sprawdzamy logowanie do SMTP, dopiero potem zapisujemy. */
export async function POST(req: NextRequest) {
  const t = await tSerwer();
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const haslo = String(body.haslo ?? "").replace(/\s+/g, "");
  const nazwa = String(body.nazwa ?? "").trim() || email;
  const znany = podpowiedzSerwer(email);
  const host = String(body.host ?? "").trim() || znany?.host || "";
  const port = Number(body.port) || znany?.port || 587;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ blad: t("api.zlyEmail") }, { status: 400 });
  if (!haslo) return NextResponse.json({ blad: t("api.podajHasloAplikacji") }, { status: 400 });
  if (!host) return NextResponse.json({ blad: t("api.nieznanySerwer") }, { status: 400 });

  try {
    await transport({ host, port, uzytkownik: email, haslo }).verify();
  } catch (e) {
    return NextResponse.json({ blad: opiszBladSmtp(e, t.jezyk) }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("skrzynki")
    .insert({ nazwa, email_nadawcy: email, smtp_host: host, smtp_port: port, smtp_uzytkownik: email, sprawdzona: new Date().toISOString() })
    .select(KOLUMNY)
    .single();
  if (error) return NextResponse.json({ blad: t("api.nieudanoZapisacSkrzynki") }, { status: 403 });

  const { error: bladSekretu } = await supabase.rpc("zapisz_sekret_skrzynki", { p_skrzynka: data.id, p_haslo: zaszyfruj(haslo) });
  if (bladSekretu) {
    await supabase.from("skrzynki").delete().eq("id", data.id);
    return NextResponse.json({ blad: t("api.nieudanoZapisacHasla") }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const t = await tSerwer();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ blad: t("api.brakId") }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("skrzynki").delete().eq("id", id);
  if (error) return NextResponse.json({ blad: t("api.nieudanoUsunac") }, { status: 500 });
  return NextResponse.json({ ok: true });
}
