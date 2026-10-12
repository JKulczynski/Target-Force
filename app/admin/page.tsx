"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { POLE, PRZYCISK_GLOWNY } from "@/components/ui";
import { useT } from "@/lib/i18n/klient";

type Dane = {
  czekajace: { id: string; nazwa: string; organizacja: string }[];
  organizacje: {
    id: string;
    nazwa: string;
    testowa: boolean;
    utworzona: string;
    czlonkowie: { email: string; rola: string }[];
    kampanie: number;
  }[];
};

/**
 * Panel administratora WinOver (Jan, Piotr): kampanie czekające na decyzję o oświadczeniu,
 * klienci (organizacje) i dodawanie nowego klienta z zaproszeniem. Klient dostaje z API 403.
 */
export default function Administracja() {
  const { t } = useT();
  const [dane, setDane] = useState<Dane | null | undefined>(undefined);
  const [nazwa, setNazwa] = useState("");
  const [email, setEmail] = useState("");
  const [zapisuje, setZapisuje] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  const wczytaj = useCallback(async () => {
    const odp = await fetch("/api/admin");
    setDane(odp.ok ? await odp.json() : null);
  }, []);

  useEffect(() => {
    let aktualny = true;
    fetch("/api/admin")
      .then((odp) => (odp.ok ? odp.json() : null))
      .then((d) => aktualny && setDane(d))
      .catch(() => aktualny && setDane(null));
    return () => {
      aktualny = false;
    };
  }, []);

  async function dodaj(e: React.FormEvent) {
    e.preventDefault();
    setZapisuje(true);
    setInfo(null);
    setBlad(null);
    try {
      const odp = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nazwa, email }),
      });
      const d = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(d.blad ?? t("admin.nieUtworzono"));
      setInfo(d.zaproszono ? t("admin.zaproszono", { email: d.email }) : t("admin.dodanoIstniejace", { email: d.email }));
      setNazwa("");
      setEmail("");
      await wczytaj();
    } catch {
      setBlad(t("admin.nieUtworzono"));
    } finally {
      setZapisuje(false);
    }
  }

  if (dane === undefined) return <p className="text-sm text-slate-400">{t("wspolne.wczytuje")}</p>;
  if (dane === null) return <p className="text-sm text-slate-600">{t("api.tylkoAdmin")}</p>;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.tytul")}</h1>
      <p className="mt-1.5 max-w-xl text-sm text-slate-600">{t("admin.opis")}</p>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-medium">{t("admin.czekajace")}</h2>
        {dane.czekajace.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t("admin.czekajace.pusto")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {dane.czekajace.map((k) => (
              <li key={k.id}>
                <Link
                  href={`/kampanie/${k.id}#zleca`}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <span className="truncate font-medium text-slate-900">{k.nazwa}</span>
                  <span className="shrink-0 text-xs text-slate-500">{k.organizacja}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-medium">{t("admin.klienci")}</h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {dane.organizacje.map((o) => (
            <li key={o.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-900">
                  {o.nazwa}
                  {o.testowa && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{t("admin.testowa")}</span>}
                </span>
                <span className="text-xs text-slate-500">{t.n("admin.kampanii", o.kampanie)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {o.czlonkowie.map((c) => `${c.email}${c.rola === "wlasciciel" ? ` (${t("admin.wlasciciel")})` : ""}`).join(", ") || t("admin.brakCzlonkow")}
              </p>
            </li>
          ))}
        </ul>

        <form onSubmit={dodaj} className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">{t("admin.nazwaOrg")}</span>
            <input className={`mt-1.5 ${POLE}`} value={nazwa} onChange={(e) => setNazwa(e.target.value)} placeholder={t("admin.nazwaOrg.ph")} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">{t("admin.emailWlasciciela")}</span>
            <input className={`mt-1.5 ${POLE}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@fundacja.pl" />
          </label>
          <button disabled={zapisuje} className={PRZYCISK_GLOWNY}>
            {zapisuje ? t("admin.dodaje") : t("admin.dodajKlienta")}
          </button>
        </form>
        {info && <p className="mt-3 text-sm text-emerald-700">{info}</p>}
        {blad && <p className="mt-3 text-sm text-red-700">{blad}</p>}
      </section>
    </>
  );
}
