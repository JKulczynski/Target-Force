"use client";

import { useEffect, useState } from "react";
import { Werdykt } from "@/components/Werdykt";
import type { WynikDomeny } from "@/lib/dns-poczty";

type Skrzynka = {
  id: string;
  nazwa: string;
  email_nadawcy: string;
  smtp_host: string;
  smtp_port: number;
  dzienny_limit: number;
};

const pole =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15";
const przycisk =
  "shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300";

/**
 * Skrzynka nadawcy przypisana do jednej kampanii (decyzja Jana 30.09: każda sprawa ma swoją skrzynkę,
 * żeby adresy nie mieszały się między kampaniami).
 */
export function SkrzynkaKampanii({
  skrzynkaId,
  onZmiana,
}: {
  skrzynkaId: string | null;
  onZmiana: (id: string | null) => Promise<void>;
}) {
  const [lista, setLista] = useState<Skrzynka[]>([]);

  async function wczytaj() {
    const odp = await fetch("/api/skrzynka");
    if (odp.ok) setLista(await odp.json());
  }

  useEffect(() => {
    wczytaj();
  }, []);

  const wybrana = lista.find((s) => s.id === skrzynkaId);

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">
        Skrzynka nadawcy
      </h2>
      {wybrana ? (
        <Podlaczona s={wybrana} onOdlacz={() => onZmiana(null)} />
      ) : (
        <Wybor
          lista={lista}
          onWybierz={onZmiana}
          onNowa={async (id) => {
            await wczytaj();
            await onZmiana(id);
          }}
        />
      )}
    </section>
  );
}

function Podlaczona({ s, onOdlacz }: { s: Skrzynka; onOdlacz: () => void }) {
  const [domena, setDomena] = useState<WynikDomeny | null>(null);
  const [odbiorca, setOdbiorca] = useState("");
  const [trwa, setTrwa] = useState(false);
  const [wynik, setWynik] = useState<{ ok: boolean; tekst: string } | null>(
    null,
  );

  useEffect(() => {
    fetch(`/api/domena?d=${encodeURIComponent(s.email_nadawcy)}`)
      .then((o) => (o.ok ? o.json() : null))
      .then(setDomena)
      .catch(() => setDomena(null));
  }, [s.email_nadawcy]);

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
          ? {
              ok: true,
              tekst: `Skrzynka działa: krótki mail techniczny poszedł na ${dane.do}. Teksty kampanii testujesz niżej, w Wysyłce, krok 2.`,
            }
          : { ok: false, tekst: dane.blad ?? "Nie udało się wysłać." },
      );
    } catch {
      setWynik({ ok: false, tekst: "Nie udało się wysłać." });
    } finally {
      setTrwa(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {s.nazwa !== s.email_nadawcy ? `${s.nazwa} · ` : ""}
            {s.email_nadawcy}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Połączenie działa · limit {s.dzienny_limit} maili dziennie
          </p>
        </div>
        <button
          onClick={onOdlacz}
          className="text-xs text-slate-400 transition hover:text-red-600"
        >
          Zmień skrzynkę
        </button>
      </div>
      {domena && <Werdykt wynik={domena} />}
      <div className="flex gap-3">
        <input
          className={pole}
          type="email"
          value={odbiorca}
          onChange={(e) => setOdbiorca(e.target.value)}
          placeholder={`krótki mail techniczny na... (domyślnie ${s.email_nadawcy})`}
        />
        <button onClick={test} disabled={trwa} className={przycisk}>
          {trwa ? "Sprawdzam..." : "Sprawdź skrzynkę"}
        </button>
      </div>
      {wynik && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ring-1 ${wynik.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-red-50 text-red-700 ring-red-100"}`}
        >
          {wynik.tekst}
        </p>
      )}
    </div>
  );
}

function Wybor({
  lista,
  onWybierz,
  onNowa,
}: {
  lista: Skrzynka[];
  onWybierz: (id: string) => Promise<void>;
  onNowa: (id: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [haslo, setHaslo] = useState("");
  const [nazwa, setNazwa] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [inny, setInny] = useState(false);
  const [trwa, setTrwa] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function podlacz(e: React.FormEvent) {
    e.preventDefault();
    setTrwa(true);
    setBlad(null);
    try {
      const odp = await fetch("/api/skrzynka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          haslo,
          nazwa,
          host: inny ? host : "",
          port: inny ? port : "",
        }),
      });
      const dane = await odp.json();
      if (!odp.ok)
        return setBlad(dane.blad ?? "Nie udało się podłączyć skrzynki.");
      await onNowa(dane.id);
    } catch {
      setBlad("Nie udało się podłączyć skrzynki.");
    } finally {
      setTrwa(false);
    }
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-slate-500">
        Z tej skrzynki pójdą wiadomości tej kampanii. Przy Gmailu wpisz{" "}
        <b>hasło aplikacji</b> (16 znaków z myaccount.google.com/apppasswords),
        nie zwykłe hasło. Hasło zapisujemy zaszyfrowane.
      </p>

      {lista.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">
            Użyj skrzynki podłączonej wcześniej:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lista.map((s) => (
              <button
                key={s.id}
                onClick={() => onWybierz(s.id)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-900"
              >
                {s.email_nadawcy}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm font-medium text-slate-700">
            albo podłącz nową:
          </p>
        </div>
      )}

      <form onSubmit={podlacz} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={pole}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="adres, np. biuro@firma.pl"
          />
          <input
            className={pole}
            type="password"
            required
            value={haslo}
            onChange={(e) => setHaslo(e.target.value)}
            placeholder="hasło aplikacji"
            autoComplete="new-password"
          />
        </div>
        <input
          className={pole}
          value={nazwa}
          onChange={(e) => setNazwa(e.target.value)}
          placeholder="nazwa nadawcy widoczna u odbiorcy, np. Piotr z Manifesto (opcjonalnie)"
        />
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={inny}
            onChange={(e) => setInny(e.target.checked)}
          />
          Poczta firmowa albo inna niż Gmail/Outlook (podam serwer sam)
        </label>
        {inny && (
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <input
              className={pole}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="serwer SMTP, np. smtp.twojadomena.pl"
            />
            <input
              className={pole}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="port, np. 465"
            />
          </div>
        )}
        {blad && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {blad}
          </p>
        )}
        <button disabled={trwa} className={przycisk}>
          {trwa ? "Sprawdzam połączenie..." : "Podłącz i sprawdź"}
        </button>
      </form>
    </div>
  );
}
