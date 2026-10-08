"use client";

import { useEffect, useState } from "react";
import { POLE } from "@/components/ui";
import { useT } from "@/lib/i18n/klient";
import {
  dodajWydarzenie,
  TYPY_WYDARZEN,
  usunWydarzenie,
  wydarzenia,
  type TypWydarzenia,
  type Wydarzenie,
} from "@/lib/store";

const pole = `mt-1.5 ${POLE}`;

/**
 * Raport wpływu (wizja pkt 6): co się wydarzyło dzięki kampanii. Odpowiedzi i spotkania dzieją się poza aplikacją
 * (skrzynka nadawcy, biuro poselskie), więc zespół dopisuje je ręcznie; trafiają na raport dla klienta.
 */
type Interpelacja = {
  numer: number;
  tytul: string;
  data: string;
  do: string;
  poslowie: string[];
  link: string;
};

export function Wplyw({ kampaniaId, zSejmu = false }: { kampaniaId: string; zSejmu?: boolean }) {
  const { t } = useT();
  const [lista, setLista] = useState<Wydarzenie[] | null>(null);
  const [interpelacje, setInterpelacje] = useState<Interpelacja[] | null>(null);
  const [od, setOd] = useState<string | null>(null);
  const [sprawdza, setSprawdza] = useState(false);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [typ, setTyp] = useState<TypWydarzenia>("odpowiedz");
  const [opis, setOpis] = useState("");
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    let aktualny = true;
    wydarzenia(kampaniaId)
      .then((w) => aktualny && setLista(w))
      .catch(() => aktualny && setLista([]));
    return () => {
      aktualny = false;
    };
  }, [kampaniaId]);

  async function dodaj(e: React.FormEvent) {
    e.preventDefault();
    if (!opis.trim()) return setBlad(t("wplyw.napiszCo"));
    setBlad(null);
    setZapisuje(true);
    try {
      await dodajWydarzenie(kampaniaId, { data, typ, opis: opis.trim() });
      setOpis("");
      setLista(await wydarzenia(kampaniaId));
    } catch {
      setBlad(t("wspolne.nieZapisano"));
    } finally {
      setZapisuje(false);
    }
  }

  async function sprawdzInterpelacje() {
    setSprawdza(true);
    setBlad(null);
    try {
      const odp = await fetch(`/api/kampanie/${kampaniaId}/interpelacje`);
      const d = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(d.blad ?? t("wplyw.bladInterpelacji"));
      setInterpelacje(d.interpelacje ?? []);
      setOd(d.od ?? null);
    } catch {
      setBlad(t("wplyw.bladInterpelacji"));
    } finally {
      setSprawdza(false);
    }
  }

  // Opis wpisu zostaje po polsku: to dane w bazie (raport), a tytuły interpelacji i tak są polskie.
  async function dodajInterpelacje(i: Interpelacja) {
    try {
      await dodajWydarzenie(kampaniaId, {
        data: i.data,
        typ: "interpelacja",
        opis: `Interpelacja nr ${i.numer}: ${i.tytul} (${i.poslowie.join(", ")})`,
      });
      setLista(await wydarzenia(kampaniaId));
    } catch {
      setBlad(t("wspolne.nieZapisano"));
    }
  }

  async function usun(id: string) {
    if (!window.confirm(t("wplyw.potwierdzUsun"))) return;
    await usunWydarzenie(id).catch(() => {});
    setLista((l) => l?.filter((w) => w.id !== id) ?? null);
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">
        {t("wplyw.tytul")}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("wplyw.opis")}</p>

      <form onSubmit={dodaj} className="mt-5 grid gap-3 sm:grid-cols-[9rem_13rem_minmax(0,1fr)_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">{t("wplyw.data")}</span>
          <input type="date" className={pole} value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">{t("wplyw.rodzaj")}</span>
          <select className={pole} value={typ} onChange={(e) => setTyp(e.target.value as TypWydarzenia)}>
            {TYPY_WYDARZEN.map((x) => (
              <option key={x} value={x}>
                {t(`typWydarzenia.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">{t("wplyw.coSie")}</span>
          <input
            className={pole}
            value={opis}
            onChange={(e) => setOpis(e.target.value)}
            placeholder={t("wplyw.ph")}
          />
        </label>
        <button
          disabled={zapisuje}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-slate-800 disabled:bg-slate-300"
        >
          {t("wplyw.dodaj")}
        </button>
      </form>
      {blad && <p className="mt-2 text-sm text-red-700">{blad}</p>}

      {lista && lista.length > 0 && (
        <ol className="mt-5 space-y-2">
          {lista.map((w) => (
            <li key={w.id} className="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
              <span className="w-20 shrink-0 tabular-nums text-slate-500">
                {new Date(w.data).toLocaleDateString(t.locale)}
              </span>
              <span className="w-36 shrink-0 text-xs font-medium text-brand-700">
                {t(`typWydarzenia.${w.typ}`)}
              </span>
              <span className="min-w-0 flex-1 text-slate-800">{w.opis}</span>
              <button
                type="button"
                onClick={() => usun(w.id)}
                className="shrink-0 text-xs text-slate-400 hover:text-red-700"
              >
                {t("wplyw.usun")}
              </button>
            </li>
          ))}
        </ol>
      )}
      {lista && lista.length === 0 && (
        <p className="mt-4 text-sm text-slate-400">{t("wplyw.pusto")}</p>
      )}

      {zSejmu && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-slate-900">{t("wplyw.interpelacje.tytul")}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{t("wplyw.interpelacje.opis")}</p>
            </div>
            <button
              type="button"
              onClick={sprawdzInterpelacje}
              disabled={sprawdza}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-900 disabled:opacity-50"
            >
              {sprawdza
                ? t("wplyw.sprawdzam")
                : interpelacje
                  ? t("wplyw.sprawdzPonownie")
                  : t("wplyw.sprawdzInterpelacje")}
            </button>
          </div>
          {interpelacje && interpelacje.length === 0 && (
            <p className="mt-3 text-sm text-slate-400">
              {t("wplyw.brakInterpelacji", {
                od: od ? new Date(od).toLocaleDateString(t.locale) : t("wplyw.odStartu"),
              })}
            </p>
          )}
          {interpelacje && interpelacje.length > 0 && (
            <ul className="mt-3 space-y-2">
              {interpelacje.map((i) => {
                const juz = (lista ?? []).some((w) => w.opis.startsWith(`Interpelacja nr ${i.numer}:`));
                return (
                  <li key={i.numer} className="flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-2.5 text-sm">
                    <span className="w-20 shrink-0 tabular-nums text-slate-500">
                      {new Date(i.data).toLocaleDateString(t.locale)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <a href={i.link} target="_blank" rel="noreferrer" className="text-slate-900 underline-offset-2 hover:underline">
                        {i.tytul}
                      </a>
                      <span className="block text-xs text-slate-500">
                        {i.poslowie.join(", ")}
                        {t("wplyw.do", { do: i.do })}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={juz}
                      onClick={() => dodajInterpelacje(i)}
                      className="shrink-0 text-xs font-medium text-brand-700 hover:underline disabled:text-slate-400 disabled:no-underline"
                    >
                      {juz ? t("wplyw.wRaporcie") : t("wplyw.dodajDoRaportu")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
