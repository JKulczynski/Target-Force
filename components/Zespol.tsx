"use client";

import { useEffect, useState } from "react";
import { POLE } from "@/components/ui";
import { useT } from "@/lib/i18n/klient";

type Czlonek = { user_id: string; email: string; dodany: string };

const pole = POLE;

/** Zespół: kto widzi kampanie i kogo dopraszamy. Do 07.10 nową osobę trzeba było wpisać ręcznie w bazie. */
export function Zespol() {
  const { t } = useT();
  const [lista, setLista] = useState<Czlonek[] | null>(null);
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [dodaje, setDodaje] = useState(false);

  async function wczytaj() {
    const odp = await fetch("/api/zespol");
    setLista(odp.ok ? await odp.json() : []);
  }

  useEffect(() => {
    fetch("/api/zespol")
      .then((odp) => (odp.ok ? odp.json() : []))
      .then(setLista)
      .catch(() => setLista([]));
  }, []);

  async function dodaj(e: React.FormEvent) {
    e.preventDefault();
    setDodaje(true);
    setInfo(null);
    setBlad(null);
    try {
      const odp = await fetch("/api/zespol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const dane = await odp.json();
      if (!odp.ok) {
        setBlad(dane.blad ?? t("zespol.nieDodano"));
        return;
      }
      setInfo(
        dane.zaproszono
          ? t("zespol.zaproszono", { email: dane.email })
          : t("zespol.maKonto", { email: dane.email }),
      );
      setEmail("");
      await wczytaj();
    } catch {
      setBlad(t("zespol.nieDodano"));
    } finally {
      setDodaje(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-medium">{t("zespol.tytul")}</h2>
      <p className="mt-1 text-sm text-slate-500">{t("zespol.opis")}</p>

      {lista === null ? (
        <p className="mt-5 text-sm text-slate-400">{t("wspolne.wczytuje")}</p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {lista.map((c) => (
            <li
              key={c.user_id}
              className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
            >
              <span className="truncate text-slate-800">{c.email}</span>
              <span className="shrink-0 text-xs text-slate-400">
                {t("zespol.od", { data: new Date(c.dodany).toLocaleDateString(t.locale) })}
              </span>
            </li>
          ))}
          {lista.length === 0 && (
            <li className="px-4 py-2.5 text-sm text-slate-400">{t("zespol.pusto")}</li>
          )}
        </ul>
      )}

      <form onSubmit={dodaj} className="mt-5 flex gap-3">
        <input
          className={pole}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("zespol.ph")}
        />
        <button
          disabled={dodaje || !email.trim()}
          className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
        >
          {dodaje ? t("zespol.dodaje") : t("zespol.dodaj")}
        </button>
      </form>
      {info && <p className="mt-4 text-sm text-emerald-700">{info}</p>}
      {blad && <p className="mt-4 text-sm text-red-600">{blad}</p>}
    </section>
  );
}
