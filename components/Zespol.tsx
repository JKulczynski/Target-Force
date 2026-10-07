"use client";

import { useEffect, useState } from "react";

type Czlonek = { user_id: string; email: string; dodany: string };

const pole =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15";

/** Zespół: kto widzi kampanie i kogo dopraszamy. Do 07.10 nową osobę trzeba było wpisać ręcznie w bazie. */
export function Zespol() {
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
        setBlad(dane.blad ?? "Nie udało się dodać.");
        return;
      }
      setInfo(
        dane.zaproszono
          ? `Wysłaliśmy zaproszenie na ${dane.email}. Po kliknięciu w link ta osoba ustawi hasło i od razu zobaczy kampanie.`
          : `${dane.email} ma już konto i od teraz widzi kampanie zespołu.`,
      );
      setEmail("");
      await wczytaj();
    } catch {
      setBlad("Nie udało się dodać.");
    } finally {
      setDodaje(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-medium">Zespół</h2>
      <p className="mt-1 text-sm text-slate-500">
        Osoby z tej listy widzą i prowadzą wszystkie kampanie. Jeśli ktoś nie
        ma jeszcze konta, dostanie mailem zaproszenie z linkiem do ustawienia
        hasła.
      </p>

      {lista === null ? (
        <p className="mt-5 text-sm text-slate-400">Wczytuję...</p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {lista.map((c) => (
            <li
              key={c.user_id}
              className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
            >
              <span className="truncate text-slate-800">{c.email}</span>
              <span className="shrink-0 text-xs text-slate-400">
                od {new Date(c.dodany).toLocaleDateString("pl-PL")}
              </span>
            </li>
          ))}
          {lista.length === 0 && (
            <li className="px-4 py-2.5 text-sm text-slate-400">
              Nie widzisz zespołu, bo jeszcze w nim nie jesteś.
            </li>
          )}
        </ul>
      )}

      <form onSubmit={dodaj} className="mt-5 flex gap-3">
        <input
          className={pole}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="np. anna@agencja.pl"
        />
        <button
          disabled={dodaje || !email.trim()}
          className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
        >
          {dodaje ? "Dodaję..." : "Dodaj"}
        </button>
      </form>
      {info && <p className="mt-4 text-sm text-emerald-700">{info}</p>}
      {blad && <p className="mt-4 text-sm text-red-600">{blad}</p>}
    </section>
  );
}
