import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  gminaPoTeryt,
  nazwaGminyDoTekstu,
  terytPowiatu,
  type Gmina,
} from "@/lib/akcja";
import { personalizuj } from "@/lib/personalizacja";

export const runtime = "nodejs";

const POPRAWNY_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Kontakt = {
  id: string;
  zrodlo: string;
  zewnetrzne_id: string | null;
  imie: string | null;
  nazwisko: string | null;
  email: string | null;
  organizacja: string | null;
  stanowisko: string | null;
  dane: Record<string, unknown> | null;
};

/**
 * Dobór decydenta dla sympatyka: najpierw ten „jego” (poseł z okręgu gminy, urząd gminy albo starostwo),
 * potem z tego samego województwa, na końcu ktokolwiek z listy odbiorców kampanii (ministerstwa, własna lista).
 * Wśród kandydatów bierzemy osobę z najmniejszą liczbą podpisów, żeby wiadomości rozkładały się równo.
 */
function kandydaci(kontakty: Kontakt[], gmina: Gmina) {
  const powiat = terytPowiatu(gmina);
  const lokalni = kontakty.filter(
    (c) =>
      (c.zrodlo === "sejm" && Number(c.dane?.okregNr) === gmina.o) ||
      (c.zrodlo === "samorzady" &&
        (c.zewnetrzne_id === gmina.t || c.zewnetrzne_id === powiat)),
  );
  if (lokalni.length) return lokalni;
  const wojewodztwo = kontakty.filter(
    (c) =>
      (c.zrodlo === "sejm" || c.zrodlo === "samorzady") &&
      String(c.dane?.wojewodztwo ?? "") === gmina.w,
  );
  if (wojewodztwo.length) return wojewodztwo;
  return kontakty;
}

function nazwaOdbiorcy(c: Kontakt): string {
  const osoba = [c.imie, c.nazwisko].filter(Boolean).join(" ");
  if (c.zrodlo === "sejm")
    return `${osoba}, ${c.stanowisko ?? "poseł"}${c.organizacja ? ` (${c.organizacja})` : ""}`;
  if (c.zrodlo === "samorzady") return c.nazwisko ?? osoba;
  return [osoba || c.nazwisko, c.stanowisko, c.organizacja]
    .filter(Boolean)
    .join(", ");
}

/** Podpis ze strony akcji: zapisuje sympatyka, dobiera odbiorcę i składa wiadomość do wysłania z jego poczty. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  // Pułapka na boty: pole, którego człowiek nie widzi. Udajemy sukces, nic nie zapisujemy.
  if (typeof body.www === "string" && body.www.trim())
    return NextResponse.json({ ok: true, podpisId: null });

  const imie = String(body.imie ?? "").trim();
  const nazwisko = String(body.nazwisko ?? "").trim();
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const gminaTeryt = String(body.gminaTeryt ?? "");
  // Własne zdanie sympatyka: autentyczność i różnorodność tekstów. Bez linków, krótko.
  const dlaczego = String(body.dlaczego ?? "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
  if (imie.length < 2 || imie.length > 60)
    return NextResponse.json({ blad: "Podaj imię." }, { status: 400 });
  if (nazwisko.length > 80)
    return NextResponse.json(
      { blad: "Nazwisko jest za długie." },
      { status: 400 },
    );
  if (email && !POPRAWNY_EMAIL.test(email))
    return NextResponse.json(
      { blad: "Podaj poprawny adres e-mail albo zostaw puste." },
      { status: 400 },
    );
  if (!body.zgoda)
    return NextResponse.json(
      { blad: "Potrzebna jest zgoda na przetwarzanie danych." },
      { status: 400 },
    );
  const gmina = gminaPoTeryt(gminaTeryt);
  if (!gmina)
    return NextResponse.json({ blad: "Wybierz gminę z listy." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json(
      { blad: "Strona akcji chwilowo nie działa." },
      { status: 500 },
    );

  const { data: k } = await admin
    .from("kampanie")
    .select("id, akcja_wlaczona")
    .eq("akcja_slug", slug)
    .maybeSingle();
  if (!k || !k.akcja_wlaczona)
    return NextResponse.json({ blad: "Nie ma takiej akcji." }, { status: 404 });

  // Prosty limit: jeden adres IP nie podpisuje się więcej niż 10 razy na godzinę.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "brak";
  const ipHash = createHash("sha256")
    .update(`${ip}|${k.id}`)
    .digest("hex")
    .slice(0, 24);
  const { count: ostatnie } = await admin
    .from("podpisy")
    .select("id", { count: "exact", head: true })
    .eq("kampania_id", k.id)
    .eq("ip_hash", ipHash)
    .gte("utworzony", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((ostatnie ?? 0) >= 10)
    return NextResponse.json(
      { blad: "Za dużo podpisów z tego adresu. Spróbuj za godzinę." },
      { status: 429 },
    );

  const [{ data: kontakty }, { data: warianty }] = await Promise.all([
    admin
      .from("kontakty")
      .select(
        "id, zrodlo, zewnetrzne_id, imie, nazwisko, email, organizacja, stanowisko, dane",
      )
      .eq("kampania_id", k.id)
      .eq("wypisany", false)
      .not("email", "is", null),
    admin
      .from("warianty")
      .select("id, temat, tresc")
      .eq("kampania_id", k.id)
      .eq("rola", "sympatyk")
      .eq("status", "zatwierdzony"),
  ]);
  if (!kontakty?.length || !warianty?.length)
    return NextResponse.json(
      { blad: "Akcja jest jeszcze w przygotowaniu. Wróć za chwilę." },
      { status: 409 },
    );

  const kand = kandydaci(kontakty as Kontakt[], gmina);
  const { data: licz } = await admin
    .from("podpisy")
    .select("kontakt_id")
    .eq("kampania_id", k.id)
    .in(
      "kontakt_id",
      kand.map((c) => c.id),
    );
  const ile = new Map<string, number>();
  (licz ?? []).forEach((p) =>
    ile.set(p.kontakt_id, (ile.get(p.kontakt_id) ?? 0) + 1),
  );
  const min = Math.min(...kand.map((c) => ile.get(c.id) ?? 0));
  const najmniej = kand.filter((c) => (ile.get(c.id) ?? 0) === min);
  const odbiorca = najmniej[Math.floor(Math.random() * najmniej.length)];
  const wariant = warianty[Math.floor(Math.random() * warianty.length)];

  const pola = {
    imie: odbiorca.imie ?? undefined,
    nazwisko: odbiorca.nazwisko ?? undefined,
    okreg:
      typeof odbiorca.dane?.okreg === "string" ? odbiorca.dane.okreg : undefined,
    wojewodztwo:
      typeof odbiorca.dane?.wojewodztwo === "string"
        ? odbiorca.dane.wojewodztwo
        : undefined,
    gmina: nazwaGminyDoTekstu(gmina),
  };
  const temat = personalizuj(wariant.temat, pola);
  const podpis = [imie, nazwisko].filter(Boolean).join(" ");
  // Zdanie sympatyka wchodzi przed ostatni akapit (prośbę albo pożegnanie), żeby prośba została na końcu.
  const akapity = personalizuj(wariant.tresc, pola).trim().split(/\n\s*\n/);
  if (dlaczego) akapity.splice(Math.max(akapity.length - 1, 1), 0, dlaczego);
  const tresc = `${akapity.join("\n\n")}\n\n${podpis}\n${pola.gmina}`;

  const { data: zapis, error } = await admin
    .from("podpisy")
    .insert({
      kampania_id: k.id,
      imie,
      nazwisko,
      email: email || null,
      zgoda_informacje: !!body.zgodaInformacje && !!email,
      gmina_teryt: gmina.t,
      gmina_nazwa:
        gmina.typ === "dzielnica" ? `Warszawa, ${gmina.n}` : gmina.n,
      okreg_nr: gmina.o,
      kontakt_id: odbiorca.id,
      odbiorca_email: odbiorca.email,
      odbiorca_nazwa: nazwaOdbiorcy(odbiorca),
      wariant_id: wariant.id,
      temat,
      tresc,
      dlaczego,
      ip_hash: ipHash,
    })
    .select("id")
    .single();
  if (error || !zapis)
    return NextResponse.json(
      { blad: "Nie udało się zapisać podpisu." },
      { status: 500 },
    );

  const { count: razem } = await admin
    .from("podpisy")
    .select("id", { count: "exact", head: true })
    .eq("kampania_id", k.id);

  return NextResponse.json({
    ok: true,
    podpisId: zapis.id,
    odbiorca: {
      nazwa: nazwaOdbiorcy(odbiorca),
      email: odbiorca.email,
      okreg: pola.okreg ?? null,
    },
    temat,
    tresc,
    razem: razem ?? 0,
  });
}
