"use client";

import { useState } from "react";
import type { Swiatlo, WynikDomeny } from "@/lib/dns-poczty";

const pole =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

const KOLOR: Record<Swiatlo, string> = {
  ok: "bg-emerald-500",
  slabe: "bg-amber-400",
  brak: "bg-red-500",
};

export default function Ustawienia() {
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
      if (!odp.ok) setBlad(dane.blad ?? "Nie udało się sprawdzić domeny.");
      else setWynik(dane);
    } catch {
      setBlad("Nie udało się sprawdzić domeny.");
    } finally {
      setSprawdzam(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Ustawienia</h1>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-medium">Czy domena nadawcy jest gotowa do wysyłki</h2>
        <p className="mt-1 text-sm text-slate-500">
          Wpisz adres, z którego chcesz wysyłać kampanię. Sprawdzimy trzy ustawienia domeny, bez
          których maile trafiają do spamu albo w ogóle nie dochodzą.
        </p>

        <form onSubmit={sprawdz} className="mt-5 flex gap-3">
          <input
            className={pole}
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
            placeholder="np. biuro@twojafirma.pl"
          />
          <button
            disabled={sprawdzam || !adres.trim()}
            className="shrink-0 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:bg-slate-300"
          >
            {sprawdzam ? "Sprawdzam..." : "Sprawdź"}
          </button>
        </form>

        {blad && <p className="mt-4 text-sm text-red-600">{blad}</p>}

        {wynik && (
          <div className="mt-6 space-y-3">
            <Werdykt wynik={wynik} />
            <p className="text-sm text-slate-500">
              Domena: <span className="font-medium text-slate-900">{wynik.domena}</span>
            </p>
            <Pozycja nazwa="SPF" opis="Kto może wysyłać z tej domeny" stan={wynik.spf.stan} uwaga={wynik.spf.uwaga} rekord={wynik.spf.rekord} />
            <Pozycja nazwa="DKIM" opis="Podpis potwierdzający, że mail nie został podrobiony" stan={wynik.dkim.stan} uwaga={wynik.dkim.uwaga} />
            <Pozycja nazwa="DMARC" opis="Co robić z mailami, które nie przejdą SPF ani DKIM" stan={wynik.dmarc.stan} uwaga={wynik.dmarc.uwaga} rekord={wynik.dmarc.rekord} />
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6">
        <h2 className="font-medium text-slate-700">Podłącz skrzynkę nadawcy</h2>
        <p className="mt-1 text-sm text-slate-500">
          Wkrótce: podłączenie skrzynki przez SMTP i hasło aplikacji, testowa wysyłka, dzienny limit.
        </p>
      </section>
    </>
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
        {rekord && <p className="mt-2 truncate font-mono text-xs text-slate-400">{rekord}</p>}
      </div>
    </div>
  );
}

const PRYWATNE = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "wp.pl", "o2.pl", "onet.pl", "interia.pl"];

function Werdykt({ wynik }: { wynik: WynikDomeny }) {
  const stany = [wynik.spf.stan, wynik.dkim.stan, wynik.dmarc.stan];
  const [tekst, opis, styl] = stany.includes("brak")
    ? ["Nie wysyłaj jeszcze", "Czerwone światło: maile trafią do spamu albo nie dojdą. Popraw je przed kampanią.", "bg-red-50 text-red-800 ring-red-100"]
    : stany.includes("slabe")
      ? ["Można wysyłać", "Zielone = działa. Żółte = działa, ale da się ustawić lepiej. Nie blokuje wysyłki.", "bg-amber-50 text-amber-900 ring-amber-100"]
      : ["Gotowe do wysyłki", "Wszystkie trzy ustawienia są w porządku.", "bg-emerald-50 text-emerald-800 ring-emerald-100"];
  const prywatna = PRYWATNE.includes(wynik.domena);
  return (
    <div className={`rounded-lg px-4 py-3 text-sm ring-1 ${styl}`}>
      <p className="font-semibold">{tekst}</p>
      <p className="mt-0.5">{opis}</p>
      {prywatna && (
        <p className="mt-2">
          To prywatna skrzynka ({wynik.domena}): dobra do testów, ale ma limit ok. 500 maili dziennie. Na kampanię użyj
          adresu w domenie firmy albo organizacji.
        </p>
      )}
    </div>
  );
}
