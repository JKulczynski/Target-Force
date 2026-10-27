"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/klient";

type Wiersz = {
  imie: string;
  nazwisko: string;
  gmina_nazwa: string | null;
  odbiorca_nazwa: string | null;
  tresc: string | null;
  potwierdzono: string | null;
};

/**
 * Wiadomości mieszkańców do druku (14.10): pakiet na spotkanie z posłem albo do złożenia w biurze.
 * Tylko wiadomości potwierdzone przez mieszkańców, pogrupowane według adresata, bez adresów e-mail.
 */
export default function PodpisyDruk() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const [sprawa, setSprawa] = useState("");
  const [wiersze, setWiersze] = useState<Wiersz[] | null>(null);

  useEffect(() => {
    const db = createClient();
    db.from("kampanie")
      .select("akcja_tytul, nazwa")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setSprawa(data?.akcja_tytul || data?.nazwa || ""));
    db.from("podpisy")
      .select("imie, nazwisko, gmina_nazwa, odbiorca_nazwa, tresc, potwierdzono")
      .eq("kampania_id", id)
      .not("potwierdzono", "is", null)
      .order("odbiorca_nazwa")
      .order("potwierdzono")
      .limit(5000)
      .then(({ data }) => setWiersze((data as Wiersz[]) ?? []));
  }, [id]);

  if (!wiersze) return <p className="text-sm text-slate-400">{t("wspolne.wczytuje")}</p>;
  const grupy = new Map<string, Wiersz[]>();
  for (const w of wiersze) grupy.set(w.odbiorca_nazwa ?? "?", [...(grupy.get(w.odbiorca_nazwa ?? "?") ?? []), w]);
  const bezPodpisu = (tresc: string | null) => {
    const linie = String(tresc ?? "").trim().split("\n");
    return linie.slice(0, Math.max(linie.length - 2, 1)).join("\n").trim();
  };

  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/kampanie/${id}`} className="text-sm text-slate-500 hover:text-slate-800">
          ← {sprawa}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {t("druk.drukuj")}
        </button>
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("druk.tytul")}: {sprawa}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("druk.opis")}</p>
      {wiersze.length === 0 && <p className="mt-6 text-sm text-slate-500">{t("druk.brak")}</p>}
      {[...grupy.entries()].map(([adresat, lista]) => (
        <section key={adresat} className="mt-8 break-before-page first:break-before-auto">
          <h2 className="text-lg font-semibold">
            {adresat} <span className="text-sm font-normal text-slate-500">({t.n("druk.wiadomosci", lista.length)})</span>
          </h2>
          <ol className="mt-3 space-y-4">
            {lista.map((w, i) => (
              <li key={i} className="break-inside-avoid rounded-lg border border-slate-200 p-4 text-sm">
                <p className="font-medium text-slate-900">
                  {i + 1}. {w.imie} {w.nazwisko}
                  {w.gmina_nazwa && <span className="font-normal text-slate-500">, {w.gmina_nazwa}</span>}
                  {w.potwierdzono && (
                    <span className="font-normal text-slate-400"> · {new Date(w.potwierdzono).toLocaleDateString(t.locale)}</span>
                  )}
                </p>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{bezPodpisu(w.tresc)}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </article>
  );
}
