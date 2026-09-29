"use client";

import { useEffect, useState } from "react";

type Skrzynka = {
  id: string;
  nazwa: string;
  email_nadawcy: string;
  smtp_host: string;
  smtp_port: number;
  dzienny_limit: number;
  sprawdzona: string | null;
};

const pole =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

const przycisk =
  "shrink-0 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:bg-slate-300";

export function Skrzynki() {
  const [lista, setLista] = useState<Skrzynka[]>([]);
  const [email, setEmail] = useState("");
  const [haslo, setHaslo] = useState("");
  const [nazwa, setNazwa] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [inny, setInny] = useState(false);
  const [trwa, setTrwa] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function wczytaj() {
    const odp = await fetch("/api/skrzynka");
    if (odp.ok) setLista(await odp.json());
  }

  useEffect(() => {
    wczytaj();
  }, []);

  async function podlacz(e: React.FormEvent) {
    e.preventDefault();
    setTrwa(true);
    setBlad(null);
    try {
      const odp = await fetch("/api/skrzynka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, haslo, nazwa, host: inny ? host : "", port: inny ? port : "" }),
      });
      const dane = await odp.json();
      if (!odp.ok) return setBlad(dane.blad ?? "Nie udało się podłączyć skrzynki.");
      setEmail("");
      setHaslo("");
      setNazwa("");
      await wczytaj();
    } catch {
      setBlad("Nie udało się podłączyć skrzynki.");
    } finally {
      setTrwa(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-medium">Skrzynka nadawcy</h2>
      <p className="mt-1 text-sm text-slate-500">
        Z tej skrzynki pójdą wiadomości kampanii. Przy Gmailu wpisz <b>hasło aplikacji</b> (16 znaków z
        myaccount.google.com/apppasswords), nie zwykłe hasło. Hasło zapisujemy zaszyfrowane.
      </p>

      {lista.length > 0 && (
        <ul className="mt-5 space-y-3">
          {lista.map((s) => (
            <PozycjaSkrzynki key={s.id} s={s} poUsunieciu={wczytaj} />
          ))}
        </ul>
      )}

      <form onSubmit={podlacz} className="mt-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={pole} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adres, np. biuro@firma.pl" />
          <input className={pole} type="password" required value={haslo} onChange={(e) => setHaslo(e.target.value)} placeholder="hasło aplikacji" autoComplete="new-password" />
        </div>
        <input className={pole} value={nazwa} onChange={(e) => setNazwa(e.target.value)} placeholder="nazwa nadawcy widoczna u odbiorcy, np. Piotr z Manifesto (opcjonalnie)" />
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input type="checkbox" checked={inny} onChange={(e) => setInny(e.target.checked)} />
          Poczta firmowa albo inna niż Gmail/Outlook (podam serwer sam)
        </label>
        {inny && (
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <input className={pole} value={host} onChange={(e) => setHost(e.target.value)} placeholder="serwer SMTP, np. smtp.twojadomena.pl" />
            <input className={pole} value={port} onChange={(e) => setPort(e.target.value)} placeholder="port, np. 465" />
          </div>
        )}
        {blad && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{blad}</p>}
        <button disabled={trwa} className={przycisk}>
          {trwa ? "Sprawdzam połączenie..." : "Podłącz i sprawdź"}
        </button>
      </form>
    </section>
  );
}

function PozycjaSkrzynki({ s, poUsunieciu }: { s: Skrzynka; poUsunieciu: () => void }) {
  const [odbiorca, setOdbiorca] = useState("");
  const [trwa, setTrwa] = useState(false);
  const [wynik, setWynik] = useState<{ ok: boolean; tekst: string } | null>(null);

  async function test() {
    setTrwa(true);
    setWynik(null);
    try {
      const odp = await fetch("/api/skrzynka/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, do: odbiorca }),
      });
      const dane = await odp.json();
      setWynik(
        odp.ok
          ? { ok: true, tekst: `Wysłane na ${dane.do}. Sprawdź, czy trafiło do odebranych, a nie do spamu.` }
          : { ok: false, tekst: dane.blad ?? "Nie udało się wysłać." },
      );
    } catch {
      setWynik({ ok: false, tekst: "Nie udało się wysłać." });
    } finally {
      setTrwa(false);
    }
  }

  async function usun() {
    if (!confirm(`Odłączyć skrzynkę ${s.email_nadawcy}?`)) return;
    await fetch(`/api/skrzynka?id=${s.id}`, { method: "DELETE" });
    poUsunieciu();
  }

  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {s.nazwa !== s.email_nadawcy ? `${s.nazwa} · ` : ""}
            {s.email_nadawcy}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Połączenie działa · {s.smtp_host}:{s.smtp_port} · limit {s.dzienny_limit} maili dziennie
          </p>
        </div>
        <button onClick={usun} className="text-xs text-slate-400 transition hover:text-red-600">
          Odłącz
        </button>
      </div>
      <div className="mt-3 flex gap-3">
        <input className={pole} type="email" value={odbiorca} onChange={(e) => setOdbiorca(e.target.value)} placeholder={`wyślij test na... (domyślnie ${s.email_nadawcy})`} />
        <button onClick={test} disabled={trwa} className={przycisk}>
          {trwa ? "Wysyłam..." : "Wyślij test"}
        </button>
      </div>
      {wynik && (
        <p className={`mt-3 rounded-lg px-4 py-3 text-sm ring-1 ${wynik.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-red-50 text-red-700 ring-red-100"}`}>
          {wynik.tekst}
        </p>
      )}
    </li>
  );
}
