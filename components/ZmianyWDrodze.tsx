"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/klient";

type Ustawa = { eli: string; tytul: string };
type Projekt = {
  druk: string;
  tytul: string;
  wplynal: string;
  etap: string | null;
  etapData: string | null;
  uchwalony: boolean;
  link: string;
};

const wRuchu = (p: Projekt) => !p.uchwalony && Date.now() - new Date(p.etapData ?? p.wplynal).getTime() < 90 * 86_400_000;

/**
 * Zmiany w drodze (14.10): ustawa, której dotyczy kampania, i projekty jej zmian w Sejmie z aktualnym etapem.
 * Projekt "w ruchu" (aktywność w 90 dni) = dobry moment na wiadomości, zanim komisja zamknie prace.
 */
export function ZmianyWDrodze({ kampaniaId }: { kampaniaId: string }) {
  const { t } = useT();
  const [ustawa, setUstawa] = useState<Ustawa | null>(null);
  const [projekty, setProjekty] = useState<Projekt[] | null>(null);
  const [kandydaci, setKandydaci] = useState<Ustawa[] | null>(null);
  const [slowa, setSlowa] = useState<string[]>([]);
  const [laduje, setLaduje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const url = `/api/kampanie/${kampaniaId}/ustawa`;
  const data = (d: string) => new Date(d).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" });

  const odswiez = () =>
    fetch(url)
      .then((o) => o.json())
      .then((d) => {
        setUstawa(d.ustawa ?? null);
        setProjekty(d.projekty ?? null);
        if (d.blad) setBlad(d.blad);
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
      else {
        setKandydaci(d.kandydaci ?? []);
        setSlowa(d.slowa ?? []);
      }
    } catch {
      setBlad(t("wspolne.nieZapisano"));
    } finally {
      setLaduje(false);
    }
  }

  async function zapisz(u: Ustawa | null) {
    setBlad(null);
    setLaduje(true);
    const o = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ustawa: u }) });
    if (!o.ok) setBlad((await o.json().catch(() => ({}))).blad ?? t("wspolne.nieZapisano"));
    setKandydaci(null);
    setProjekty(null);
    await odswiez();
    setLaduje(false);
  }

  const aktywne = (projekty ?? []).filter(wRuchu);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
      <p className="text-xs font-medium text-slate-500">{t("ustawa.tytul")}</p>
      {ustawa ? (
        <>
          <p className="mt-1 font-medium text-slate-800">{ustawa.tytul}</p>
          {projekty && projekty.length === 0 && <p className="mt-1 text-xs text-slate-500">{t("ustawa.brakProjektow")}</p>}
          {aktywne.length > 0 && <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">{t("ustawa.dobryMoment")}</p>}
          {projekty && projekty.length > 0 && (
            <ul className="mt-2 space-y-2">
              {projekty.slice(0, 5).map((p) => (
                <li key={p.druk}>
                  <a href={p.link} target="_blank" rel="noreferrer" className="font-medium text-slate-800 underline-offset-2 hover:underline">
                    {t("ustawa.druk", { nr: p.druk })}: {p.tytul}
                  </a>
                  <span className="block text-xs text-slate-500">
                    {p.uchwalony
                      ? t("ustawa.uchwalony")
                      : p.etap
                        ? t("ustawa.etap", { etap: p.etap, data: data(p.etapData ?? p.wplynal) })
                        : t("ustawa.wplynal", { data: data(p.wplynal) })}
                    {wRuchu(p) && ` · ${t("ustawa.wRuchu")}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => zapisz(null)} disabled={laduje} className="mt-2 text-xs font-medium text-brand-700 underline-offset-2 hover:underline">
            {t("ustawa.zmien")}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-500">{t("ustawa.opis")}</p>
          <button
            type="button"
            onClick={szukaj}
            disabled={laduje}
            className="mt-2 text-xs font-medium text-brand-700 underline-offset-2 hover:underline disabled:text-slate-400"
          >
            {laduje ? t("ustawa.szukam") : t("ustawa.szukaj")}
          </button>
        </>
      )}
      {kandydaci && kandydaci.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {t("ustawa.brak")}
          {slowa.length > 0 && ` ${t("ustawa.szukalem", { slowa: slowa.join(", ") })}`}
        </p>
      )}
      {kandydaci && kandydaci.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
          {kandydaci.map((u) => (
            <li key={u.eli}>
              <button type="button" onClick={() => zapisz(u)} className="text-left text-xs text-slate-800 underline-offset-2 hover:underline">
                {u.tytul}
              </button>
            </li>
          ))}
        </ul>
      )}
      {blad && <p className="mt-2 text-xs text-red-700">{blad}</p>}
    </div>
  );
}
