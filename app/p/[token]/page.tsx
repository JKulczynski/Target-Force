import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { tlumacz } from "@/lib/i18n";
import { jezykZCookie } from "@/lib/i18n/serwer";
import { trybProbny } from "@/lib/poczta-winover";
import { Potwierdzenie } from "@/components/Potwierdzenie";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "WinOver", robots: { index: false } };

/**
 * Link z maila potwierdzającego (wysyłka w imieniu mieszkańca, 12.10). Samo otwarcie niczego nie wysyła:
 * mieszkaniec widzi, co i do kogo pójdzie, i klika "Potwierdzam i wysyłam" (skanery poczty otwierają linki same).
 */
export default async function Strona({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ wypisz?: string }>;
}) {
  const { token } = await params;
  const { wypisz } = await searchParams;
  if (!/^[0-9a-f]{48}$/.test(token)) notFound();
  const admin = createAdminClient();
  if (!admin) notFound();
  const { data: w } = await admin.from("podpisy_wysylka").select("podpis_id, email, proba").eq("token", token).maybeSingle();
  if (!w) notFound();
  const { data: p } = await admin
    .from("podpisy")
    .select("imie, nazwisko, odbiorca_nazwa, temat, tresc, status_wysylki, wyslano, zglosil_odpowiedz, odpowiedz_rodzaj, kampania_id, kod_polecenia, zgoda_informacje")
    .eq("id", w.podpis_id)
    .maybeSingle();
  if (!p) notFound();
  const { data: k } = await admin.from("kampanie").select("akcja_slug, akcja_tytul, nazwa, akcja_dostarczanie").eq("id", p.kampania_id).maybeSingle();
  const t = tlumacz(await jezykZCookie());

  return (
    <article className="mx-auto max-w-2xl">
      <p className="text-sm text-slate-500">{k?.akcja_tytul || k?.nazwa}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {wypisz === "1" ? t("potw.wypiszTytul") : t("potw.tytul", { imie: p.imie })}
      </h1>
      {wypisz !== "1" && trybProbny() && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">{t("potw.proba")}</p>
      )}
      {wypisz !== "1" && (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <p className="text-xs font-medium text-slate-500">{t("potw.od")}</p>
        <p className="mt-0.5 text-slate-900">
          {p.imie} {p.nazwisko} <span className="text-slate-500">({t("potw.odpowiedzDo", { email: w.email })})</span>
        </p>
        <p className="mt-3 text-xs font-medium text-slate-500">{t("akcja.do")}</p>
        <p className="mt-0.5 text-slate-900">{p.odbiorca_nazwa}</p>
        <p className="mt-3 text-xs font-medium text-slate-500">{t("akcja.temat")}</p>
        <p className="mt-0.5 font-medium text-slate-900">{p.temat}</p>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">{p.tresc}</p>
      </div>
      )}
      <Potwierdzenie
        token={token}
        status={p.status_wysylki}
        wyslano={p.wyslano}
        odpisal={Boolean(p.zglosil_odpowiedz)}
        rodzaj={p.odpowiedz_rodzaj ?? null}
        zestawienie={k?.akcja_dostarczanie === "zestawienie"}
        odbiorca={p.odbiorca_nazwa ?? ""}
        linkAkcji={k?.akcja_slug ? `/a/${k.akcja_slug}${p.kod_polecenia ? `?od=${p.kod_polecenia}` : ""}` : null}
        wypisz={wypisz === "1"}
        zapisany={Boolean(p.zgoda_informacje)}
      />
    </article>
  );
}
