"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/klient";

type Glosowanie = { posiedzenie: number; numer: number; data: string; tytul: string; za: string; przeciw: string };
type Propozycja = Glosowanie & { dlaczego: string; zaWszyscy: number; przeciwWszyscy: number };
type Liczby = { za: number; przeciw: number; inne: number };

/**
 * Głosowanie jako argument (14.10): nadawca wybiera głosowanie Sejmu związane ze sprawą,
 * a pole {glosowanie} w wiadomości dostaje głos konkretnego posła. Propozycje z AI, tylko z listy Sejmu.
 */
export function GlosowanieArgument({ kampaniaId }: { kampaniaId: string }) {
  const { t } = useT();
  const [wybrane, setWybrane] = useState<Glosowanie | null>(null);
  const [liczby, setLiczby] = useState<Liczby | null>(null);
  const [propozycje, setPropozycje] = useState<Propozycja[] | null>(null);
  const [laduje, setLaduje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const url = `/api/kampanie/${kampaniaId}/glosowania`;
  const data = (d: string) => new Date(d).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" });

  const odswiez = () =>
    fetch(url)
      .then((o) => o.json())
      .then((d) => {
        setWybrane(d.wybrane ?? null);
        setLiczby(d.poslowie ?? null);
      })
      .catch(() => {});

  useEffect(() => {
    odswiez();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kampaniaId]);

  async function szukaj() {
    setLaduje(true);
    setBlad(null);
    try {
      const o = await fetch(url, { method: "POST" });
      const d = await o.json();
      if (!o.ok) setBlad(d.blad ?? t("wspolne.nieZapisano"));
      else setPropozycje(d.propozycje ?? []);
    } catch {
      setBlad(t("wspolne.nieZapisano"));
    } finally {
      setLaduje(false);
    }
  }

  async function zapisz(g: Glosowanie | null) {
    setBlad(null);
    const o = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ glosowanie: g }) });
    if (!o.ok) {
      setBlad((await o.json().catch(() => ({}))).blad ?? t("wspolne.nieZapisano"));
      return;
    }
    setPropozycje(null);
    setLiczby(null);
    await odswiez();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
      <p className="text-xs font-medium text-slate-500">{t("glosowanie.tytul")}</p>
      {wybrane ? (
        <>
          <p className="mt-1 text-slate-800">
            <span className="font-medium">{data(wybrane.data)}</span>: {wybrane.za.replace(/^./, (c) => c.toUpperCase())}
          </p>
          {liczby && (
            <p className="mt-1 text-xs text-slate-500">
              {t("glosowanie.liczby", { za: liczby.za, przeciw: liczby.przeciw, inne: liczby.inne })}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">{t("glosowanie.jakDziala")}</p>
          <button type="button" onClick={() => zapisz(null)} className="mt-2 text-xs font-medium text-brand-700 underline-offset-2 hover:underline">
            {t("glosowanie.usun")}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-500">{t("glosowanie.opis")}</p>
          <button
            type="button"
            onClick={szukaj}
            disabled={laduje}
            className="mt-2 text-xs font-medium text-brand-700 underline-offset-2 hover:underline disabled:text-slate-400"
          >
            {laduje ? t("glosowanie.szukam") : t("glosowanie.szukaj")}
          </button>
        </>
      )}
      {propozycje && propozycje.length === 0 && <p className="mt-2 text-xs text-slate-500">{t("glosowanie.brak")}</p>}
      {propozycje && propozycje.length > 0 && (
        <ul className="mt-2 space-y-2 border-t border-slate-200 pt-2">
          {propozycje.map((p) => (
            <li key={`${p.posiedzenie}-${p.numer}`}>
              <p className="font-medium text-slate-800">
                {data(p.data)}: {p.za}
              </p>
              <p className="text-xs text-slate-500">{p.dlaczego}</p>
              <p className="text-xs text-slate-500">{t("glosowanie.wynik", { za: p.zaWszyscy, przeciw: p.przeciwWszyscy })}</p>
              <button
                type="button"
                onClick={() => zapisz(p)}
                className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
              >
                {t("glosowanie.wybierz")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {blad && <p className="mt-2 text-xs text-red-700">{blad}</p>}
    </div>
  );
}
