import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const POPRAWNY_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Lista członków zespołu. RLS: tabelę `zespol` czyta tylko ktoś, kto już w niej jest. */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("zespol")
    .select("user_id, email, dodany")
    .order("dodany");
  if (error)
    return NextResponse.json({ blad: "Nie udało się pobrać zespołu." }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * Dodanie osoby do zespołu po e-mailu (zaproszenie z Ustawień, zamiast ręcznego wpisu w bazie).
 * Tabela `zespol` ma w RLS tylko odczyt, a `user_id` jest wymagany, więc zapis robi klient serwisowy,
 * ale dopiero po sprawdzeniu, że prosi ktoś z zespołu. Gdy konto o tym e-mailu nie istnieje,
 * Supabase zakłada je i wysyła zaproszenie; link z maila prowadzi na /auth/haslo, gdzie osoba ustawia hasło.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!POPRAWNY_EMAIL.test(email))
    return NextResponse.json({ blad: "Podaj poprawny adres e-mail." }, { status: 400 });

  const supabase = await createClient();
  const { data: wZespole } = await supabase.rpc("czy_w_zespole");
  if (!wZespole)
    return NextResponse.json({ blad: "Tylko członek zespołu może zapraszać." }, { status: 403 });

  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json(
      { blad: "Brak klucza serwisowego na serwerze. Dodaj osobę ręcznie w bazie." },
      { status: 500 },
    );

  const { data: juz } = await supabase.from("zespol").select("email").eq("email", email).maybeSingle();
  if (juz) return NextResponse.json({ blad: "Ta osoba już jest w zespole." }, { status: 409 });

  // Szukamy istniejącego konta. Zespół liczy kilka osób, więc jedna strona listy wystarcza.
  const { data: lista, error: bladListy } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (bladListy)
    return NextResponse.json({ blad: "Nie udało się sprawdzić kont." }, { status: 500 });
  let userId = lista.users.find((u) => u.email?.toLowerCase() === email)?.id;
  let zaproszono = false;

  if (!userId) {
    const origin = req.nextUrl.origin;
    const { data: zaproszenie, error: bladZaproszenia } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/haslo`,
      data: { zaproszenie: true },
    });
    if (bladZaproszenia || !zaproszenie.user)
      return NextResponse.json(
        { blad: "Nie udało się wysłać zaproszenia. Poproś tę osobę o założenie konta i spróbuj ponownie." },
        { status: 502 },
      );
    userId = zaproszenie.user.id;
    zaproszono = true;
  }

  const { error } = await admin.from("zespol").insert({ user_id: userId, email });
  if (error)
    return NextResponse.json({ blad: "Nie udało się dopisać do zespołu." }, { status: 500 });

  return NextResponse.json({ ok: true, email, zaproszono });
}
