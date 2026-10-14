"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/klient";

type Cytat = { przepis: string; tekst: string | null; link: string | null };
type Wskazowka = { id: string; tytul: string; wyjasnienie: string; fragment: string; cytaty: Cytat[]; pilne?: boolean };

/**
 * Wskazówki prawne obok edytowanej wiadomości (14.10). Sprawdza tekst po chwili bez pisania (1,2 s),
 * pokazuje fragment, krótkie wyjaśnienie i aktualne brzmienie przepisu. Nie blokuje zatwierdzenia.
 */
export function WskazowkiPrawne({
  kampaniaId,
  temat,
  tresc,
  rola = "nadawca",
}: {
  kampaniaId: string;
  temat: string;
  tresc: string;
  rola?: "nadawca" | "sympatyk";
}) {
  const { t } = useT();
  const [lista, setLista] = useState<Wskazowka[]>([]);

  useEffect(() => {
    const kontroler = new AbortController();
    const czasomierz = setTimeout(() => {
      fetch(`/api/kampanie/${kampaniaId}/wskazowki`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temat, tresc, rola }),
        signal: kontroler.signal,
      })
        .then((o) => (o.ok ? o.json() : { wskazowki: [] }))
        .then((d) => setLista(d.wskazowki ?? []))
        .catch(() => {});
    }, 1200);
    return () => {
      clearTimeout(czasomierz);
      kontroler.abort();
    };
  }, [kampaniaId, temat, tresc, rola]);

  if (!lista.length) return null;
  return (
    <div className="mt-3 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-950 ring-1 ring-sky-100">
      <p className="font-medium">{t("wskazowki.tytul")}</p>
      <ul className="mt-2 space-y-3">
        {lista.map((w) => (
          <li key={w.id}>
            <p className={`font-medium ${w.pilne ? "text-red-700" : ""}`}>
              {w.pilne ? `${t("wskazowki.cisza")} ` : ""}
              {w.tytul}
            </p>
            {w.fragment && <p className="mt-0.5 italic text-sky-900">„{w.fragment}”</p>}
            <p className="mt-1 text-sky-900">{w.wyjasnienie}</p>
            {w.cytaty.map((c) => (
              <details key={c.przepis} className="mt-1">
                <summary className="cursor-pointer text-xs font-medium text-sky-800">{c.przepis}</summary>
                {c.tekst && <p className="mt-1 whitespace-pre-line rounded bg-white/70 px-2 py-1.5 text-xs text-slate-700">{c.tekst}</p>}
                {c.link && (
                  <a href={c.link} target="_blank" rel="noreferrer" className="text-xs text-sky-800 underline">
                    {t("wskazowki.zrodlo")}
                  </a>
                )}
              </details>
            ))}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-sky-800">{t("wskazowki.zastrzezenie")}</p>
    </div>
  );
}
