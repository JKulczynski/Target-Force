"use client";

import { useEffect, useMemo, useState } from "react";
import { kontrolaWiadomosci } from "@/lib/kontrola";
import { polaZrodel, type NazwaPola } from "@/lib/personalizacja";
import { WskazowkiPrawne } from "@/components/WskazowkiPrawne";
import { createClient } from "@/lib/supabase/client";
import { POLE } from "@/components/ui";
import { useT } from "@/lib/i18n/klient";
import {
  psychografiaKampanii,
  warianty,
  zmienWariant,
  type Wariant,
} from "@/lib/store";

const pole = POLE;

/**
 * Generowanie wiadomości i etap zatwierdzania (Jan, 30.09: nadawca czyta, poprawia i zatwierdza treść,
 * zanim cokolwiek wyjdzie; bez tego narzędzie staje się generatorem sztucznego poparcia).
 */
export function Wiadomosci({
  kampaniaId,
  fakty,
  zrodla = [],
  onZmiana,
}: {
  kampaniaId: string;
  /** Cel, materiały i dane kampanii: na ich tle sprawdzamy liczby w wiadomościach. */
  fakty: string;
  /** Źródła odbiorców: z nich wynika, które pola personalizacji mają dane (kontrola przed zatwierdzeniem). */
  zrodla?: readonly string[];
  onZmiana?: () => void;
}) {
  const { t } = useT();
  const [lista, setLista] = useState<Wariant[] | null>(null);
  const [psychografia, setPsychografia] = useState<string | null>(null);
  const [jezyk, setJezyk] = useState<string | null>(null);
  const [generuje, setGeneruje] = useState(false);
  const [kluby, setKluby] = useState<string[]>([]);

  // Kluby posłów z listy odbiorców: do przypisania wersji wiadomości do klubu (14.10).
  useEffect(() => {
    createClient()
      .from("kontakty")
      .select("organizacja")
      .eq("kampania_id", kampaniaId)
      .eq("zrodlo", "sejm")
      .limit(1000)
      .then(({ data }) => setKluby([...new Set((data ?? []).map((r) => r.organizacja as string).filter(Boolean))].sort()));
  }, [kampaniaId]);
  const [blad, setBlad] = useState<string | null>(null);

  async function wczytaj() {
    const [w, p] = await Promise.all([
      warianty(kampaniaId),
      psychografiaKampanii(kampaniaId),
    ]);
    setLista(w);
    onZmiana?.();
    setPsychografia(p.opis);
    setJezyk(p.jezyk);
  }

  useEffect(() => {
    let aktualny = true;
    Promise.all([warianty(kampaniaId), psychografiaKampanii(kampaniaId)])
      .then(([w, p]) => {
        if (!aktualny) return;
        setLista(w);
        setPsychografia(p.opis);
        setJezyk(p.jezyk);
        onZmiana?.();
      })
      .catch(() => aktualny && setLista([]));
    return () => {
      aktualny = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kampaniaId]);

  async function generuj() {
    setGeneruje(true);
    setBlad(null);
    try {
      const odp = await fetch(`/api/kampanie/${kampaniaId}/generuj`, {
        method: "POST",
      });
      const dane = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(dane.blad ?? t("wiadomosci.bladGenerowania"));
      await wczytaj();
    } catch {
      setBlad(t("wiadomosci.bladGenerowania"));
    } finally {
      setGeneruje(false);
    }
  }

  const aktywne = (lista ?? []).filter((w) => w.status !== "odrzucony");
  const zatwierdzone = aktywne.filter(
    (w) => w.status === "zatwierdzony",
  ).length;

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            {t("wiadomosci.tytul")}
          </h2>
          {aktywne.length > 0 && (
            <p className="mt-1 text-sm text-slate-600">
              {t("wiadomosci.zatwierdzoneA")}{" "}
              <span className="font-semibold text-slate-900">
                {zatwierdzone}
              </span>{" "}
              {t("wiadomosci.zatwierdzoneB", { razem: aktywne.length })}
              {jezyk && t("wiadomosci.jezyk", { jezyk })}
              {t("wiadomosci.tylkoZatwierdzone")}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            if (aktywne.length && !window.confirm(t("wiadomosci.potwierdzRegeneracje")))
              return;
            generuj();
          }}
          disabled={generuje}
          className={
            aktywne.length
              ? "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-900 disabled:opacity-50"
              : "rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
          }
        >
          {generuje
            ? t("wiadomosci.pisze")
            : aktywne.length
              ? t("wiadomosci.ponownie")
              : t("wiadomosci.wygeneruj")}
        </button>
      </div>

      {blad && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {blad}
        </p>
      )}

      {psychografia && (
        <details className="mt-5 rounded-lg bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            {t("wiadomosci.psychografia")}
          </summary>
          <p className="mt-3 text-sm whitespace-pre-line text-slate-600">
            {psychografia}
          </p>
        </details>
      )}

      {lista && lista.length === 0 && !generuje && (
        <p className="mt-4 text-sm text-slate-500">{t("wiadomosci.pusto")}</p>
      )}

      <div className="mt-5 space-y-4">
        {aktywne.map((w) => (
          <KartaWariantu key={w.id} w={w} fakty={fakty} onZmiana={wczytaj} kampaniaId={kampaniaId} kluby={kluby} dostepnePola={polaZrodel(zrodla)} />
        ))}
      </div>
    </section>
  );
}

export function KartaWariantu({
  w,
  fakty,
  onZmiana,
  kampaniaId,
  rola = "nadawca",
  kluby = [],
  dostepnePola,
}: {
  w: Wariant;
  fakty: string;
  onZmiana: () => Promise<void>;
  /** Gdy podane: wskazówki prawne pod treścią (14.10). */
  kampaniaId?: string;
  rola?: "nadawca" | "sympatyk";
  /** Kluby posłów z listy odbiorców; gdy są, pierwszą wiadomość można przypisać do klubu. */
  kluby?: string[];
  /** Pola z danymi u odbiorców (lib/personalizacja polaZrodel); pole spoza listy dostaje ostrzeżenie. */
  dostepnePola?: readonly NazwaPola[];
}) {
  const { t, jezyk } = useT();
  const [temat, setTemat] = useState(w.temat);
  const [tresc, setTresc] = useState(w.tresc);
  const [zapisuje, setZapisuje] = useState(false);
  const [otwarta, setOtwarta] = useState(w.status !== "zatwierdzony");
  const zmieniony = temat !== w.temat || tresc !== w.tresc;
  const uwagi = useMemo(
    () => kontrolaWiadomosci({ temat, tresc, krok: w.krok }, fakty, jezyk, dostepnePola),
    [temat, tresc, w.krok, fakty, jezyk, dostepnePola],
  );
  const etykieta =
    w.krok === 0
      ? t("wiadomosci.etykietaPierwsza", { n: w.numer })
      : t("wiadomosci.etykietaPrzypomnienie", { n: w.krok });

  async function zapisz(status?: Wariant["status"]) {
    setZapisuje(true);
    try {
      await zmienWariant(w.id, { temat, tresc, ...(status ? { status } : {}) });
      await onZmiana();
    } finally {
      setZapisuje(false);
    }
  }

  if (!otwarta)
    return (
      <button
        onClick={() => setOtwarta(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50"
      >
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs text-emerald-700"
          aria-hidden
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-slate-500">{etykieta}</span>
          <span className="block truncate text-sm font-medium text-slate-900">
            {w.temat}
          </span>
        </span>
        {uwagi.length > 0 && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {t("wiadomosci.doSprawdzenia", { n: uwagi.length })}
          </span>
        )}
        <span className="shrink-0 text-xs text-slate-500">{t("wiadomosci.pokaz")}</span>
      </button>
    );

  return (
    <div
      className={`rounded-lg border p-4 ${w.status === "zatwierdzony" ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{etykieta}</p>
        {w.status === "zatwierdzony" && (
          <button
            onClick={() => setOtwarta(false)}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
          >
            {t("wiadomosci.zatwierdzonaZwin")}
          </button>
        )}
      </div>
      <input
        className={`${pole} mt-2 font-medium`}
        value={temat}
        onChange={(e) => setTemat(e.target.value)}
      />
      <textarea
        className={`${pole} mt-2 min-h-40 resize-y`}
        value={tresc}
        onChange={(e) => setTresc(e.target.value)}
      />
      {uwagi.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
          <p className="font-medium">{t("wiadomosci.doSprawdzeniaTytul")}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {uwagi.map((u) => (
              <li key={u.opis}>{u.opis}</li>
            ))}
          </ul>
        </div>
      )}
      {kluby.length > 1 && w.krok === 0 && rola === "nadawca" && (
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          {t("klub.dla")}
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
            value={w.dla_klubu ?? ""}
            onChange={async (e) => {
              await zmienWariant(w.id, { dla_klubu: e.target.value || null });
              await onZmiana();
            }}
          >
            <option value="">{t("klub.wszystkie")}</option>
            {kluby.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      )}
      {kampaniaId && <WskazowkiPrawne kampaniaId={kampaniaId} temat={temat} tresc={tresc} rola={rola} />}
      <div className="mt-3 flex flex-wrap gap-3">
        {w.status !== "zatwierdzony" ? (
          <button
            onClick={async () => {
              await zapisz("zatwierdzony");
              setOtwarta(false);
            }}
            disabled={zapisuje}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-emerald-800 disabled:bg-slate-300"
          >
            {zmieniony ? t("wiadomosci.zapiszIZatwierdz") : t("wiadomosci.zatwierdz")}
          </button>
        ) : (
          zmieniony && (
            <button
              onClick={() => zapisz()}
              disabled={zapisuje}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
            >
              {t("wiadomosci.zapiszZmiany")}
            </button>
          )
        )}
        {w.status === "zatwierdzony" && (
          <button
            onClick={() => zapisz("szkic")}
            disabled={zapisuje}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            {t("wiadomosci.cofnij")}
          </button>
        )}
        <button
          onClick={() => zapisz("odrzucony")}
          disabled={zapisuje}
          className="text-sm text-slate-500 transition-colors duration-150 hover:text-red-700"
        >
          {t("wiadomosci.odrzuc")}
        </button>
      </div>
    </div>
  );
}
