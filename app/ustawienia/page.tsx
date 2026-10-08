"use client";

import { useState } from "react";
import type { Swiatlo, WynikDomeny } from "@/lib/dns-poczty";
import { Werdykt } from "@/components/Werdykt";
import { Zespol } from "@/components/Zespol";
import { POLE } from "@/components/ui";
import { useT } from "@/lib/i18n/klient";

const pole = POLE;

const KOLOR: Record<Swiatlo, string> = {
  ok: "bg-emerald-500",
  slabe: "bg-amber-400",
  brak: "bg-red-500",
};

export default function Ustawienia() {
  const { t } = useT();
  const [adres, setAdres] = useState("");
  const [wynik, setWynik] = useState<WynikDomeny | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [sprawdzam, setSprawdzam] = useState(false);

  async function sprawdz(e: React.FormEvent) {
    e.preventDefault();
    setSprawdzam(true);
    setBlad(null);
    setWynik(null);
    try {
      const odp = await fetch(`/api/domena?d=${encodeURIComponent(adres)}`);
      const dane = await odp.json();
      if (!odp.ok) setBlad(dane.blad ?? t("ustawienia.bladDomeny"));
      else setWynik(dane);
    } catch {
      setBlad(t("ustawienia.bladDomeny"));
    } finally {
      setSprawdzam(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t("ustawienia.tytul")}</h1>
      <p className="mt-1.5 text-sm text-slate-600">{t("ustawienia.opis")}</p>

      <Zespol />

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-medium">{t("ustawienia.domena.tytul")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("ustawienia.domena.opis")}</p>

        <form onSubmit={sprawdz} className="mt-5 flex gap-3">
          <input
            className={pole}
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
            placeholder={t("ustawienia.ph")}
          />
          <button
            disabled={sprawdzam || !adres.trim()}
            className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
          >
            {sprawdzam ? t("ustawienia.sprawdzam") : t("ustawienia.sprawdz")}
          </button>
        </form>

        {blad && <p className="mt-4 text-sm text-red-600">{blad}</p>}

        {wynik && (
          <div className="mt-6 space-y-3">
            <Werdykt wynik={wynik} />
            <p className="text-sm text-slate-500">
              {t("ustawienia.domena")}{" "}
              <span className="font-medium text-slate-900">{wynik.domena}</span>
            </p>
            <Pozycja
              nazwa="SPF"
              opis={t("ustawienia.spf")}
              stan={wynik.spf.stan}
              uwaga={wynik.spf.uwaga}
              rekord={wynik.spf.rekord}
            />
            <Pozycja
              nazwa="DKIM"
              opis={t("ustawienia.dkim")}
              stan={wynik.dkim.stan}
              uwaga={wynik.dkim.uwaga}
            />
            <Pozycja
              nazwa="DMARC"
              opis={t("ustawienia.dmarc")}
              stan={wynik.dmarc.stan}
              uwaga={wynik.dmarc.uwaga}
              rekord={wynik.dmarc.rekord}
            />
          </div>
        )}
      </section>

      <p className="mt-6 text-sm text-slate-500">{t("ustawienia.skrzynkaInfo")}</p>
    </div>
  );
}

function Pozycja({
  nazwa,
  opis,
  stan,
  uwaga,
  rekord,
}: {
  nazwa: string;
  opis: string;
  stan: Swiatlo;
  uwaga: string;
  rekord?: string | null;
}) {
  return (
    <div className="flex gap-4 rounded-lg border border-slate-200 p-4">
      <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${KOLOR[stan]}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {nazwa} <span className="font-normal text-slate-400">· {opis}</span>
        </p>
        <p className="mt-1 text-sm text-slate-600">{uwaga}</p>
        {rekord && (
          <p className="mt-2 truncate font-mono text-xs text-slate-400">
            {rekord}
          </p>
        )}
      </div>
    </div>
  );
}
