import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { zaszyfruj } from "@/lib/szyfr";
import { opiszBladSmtp, podpowiedzSerwer, transport } from "@/lib/smtp";

export const runtime = "nodejs";

const KOLUMNY = "id, nazwa, email_nadawcy, smtp_host, smtp_port, dzienny_limit, sprawdzona, utworzona";

/** Lista podłączonych skrzynek (bez haseł). */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("skrzynki").select(KOLUMNY).order("utworzona");
  if (error) return NextResponse.json({ blad: "Nie udało się pobrać skrzynek." }, { status: 500 });
  return NextResponse.json(data);
}

/** Podłączenie skrzynki: najpierw sprawdzamy logowanie do SMTP, dopiero potem zapisujemy. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const haslo = String(body.haslo ?? "").replace(/\s+/g, "");
  const nazwa = String(body.nazwa ?? "").trim() || email;
  const znany = podpowiedzSerwer(email);
  const host = String(body.host ?? "").trim() || znany?.host || "";
  const port = Number(body.port) || znany?.port || 587;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ blad: "Podaj poprawny adres e-mail." }, { status: 400 });
  if (!haslo) return NextResponse.json({ blad: "Podaj hasło aplikacji." }, { status: 400 });
  if (!host) return NextResponse.json({ blad: "Nie znamy serwera tej poczty. Podaj host SMTP." }, { status: 400 });

  try {
    await transport({ host, port, uzytkownik: email, haslo }).verify();
  } catch (e) {
    return NextResponse.json({ blad: opiszBladSmtp(e) }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("skrzynki")
    .insert({ nazwa, email_nadawcy: email, smtp_host: host, smtp_port: port, smtp_uzytkownik: email, sprawdzona: new Date().toISOString() })
    .select(KOLUMNY)
    .single();
  if (error) return NextResponse.json({ blad: "Nie udało się zapisać skrzynki. Czy jesteś w zespole?" }, { status: 403 });

  const { error: bladSekretu } = await supabase.rpc("zapisz_sekret_skrzynki", { p_skrzynka: data.id, p_haslo: zaszyfruj(haslo) });
  if (bladSekretu) {
    await supabase.from("skrzynki").delete().eq("id", data.id);
    return NextResponse.json({ blad: "Nie udało się bezpiecznie zapisać hasła." }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ blad: "Brak id." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("skrzynki").delete().eq("id", id);
  if (error) return NextResponse.json({ blad: "Nie udało się usunąć." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
