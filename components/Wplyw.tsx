"use client";

import { useEffect, useState } from "react";
import {
  dodajWydarzenie,
  TYPY_WYDARZEN,
  usunWydarzenie,
  wydarzenia,
  type TypWydarzenia,
  type Wydarzenie,
} from "@/lib/store";

const pole =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15";

/**
 * Raport wpływu (wizja pkt 6): co się wydarzyło dzięki kampanii. Odpowiedzi i spotkania dzieją się poza aplikacją
 * (skrzynka nadawcy, biuro poselskie), więc zespół dopisuje je ręcznie; trafiają na raport dla klienta.
 */
export function Wplyw({ kampaniaId }: { kampaniaId: string }) {
  const [lista, setLista] = useState<Wydarzenie[] | null>(null);
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
    if (!opis.trim()) return setBlad("Napisz, co się wydarzyło.");
    setBlad(null);
    setZapisuje(true);
    try {
      await dodajWydarzenie(kampaniaId, { data, typ, opis: opis.trim() });
      setOpis("");
      setLista(await wydarzenia(kampaniaId));
    } catch {
      setBlad("Nie udało się zapisać.");
    } finally {
      setZapisuje(false);
    }
  }

  async function usun(id: string) {
    if (!window.confirm("Usunąć to wydarzenie z raportu?")) return;
    await usunWydarzenie(id).catch(() => {});
    setLista((l) => l?.filter((w) => w.id !== id) ?? null);
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">
        Wpływ: co się wydarzyło
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Odpowiedzi, spotkania, interpelacje, zmiany decyzji, wzmianki w mediach.
        Dopisujesz ręcznie, bo dzieją się poza aplikacją. Trafiają na raport dla
        klienta jako oś czasu.
      </p>

      <form onSubmit={dodaj} className="mt-5 grid gap-3 sm:grid-cols-[9rem_13rem_minmax(0,1fr)_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Data</span>
          <input type="date" className={pole} value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Rodzaj</span>
          <select className={pole} value={typ} onChange={(e) => setTyp(e.target.value as TypWydarzenia)}>
            {(Object.keys(TYPY_WYDARZEN) as TypWydarzenia[]).map((t) => (
              <option key={t} value={t}>
                {TYPY_WYDARZEN[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Co się wydarzyło</span>
          <input
            className={pole}
            value={opis}
            onChange={(e) => setOpis(e.target.value)}
            placeholder="np. Posłanka X złożyła interpelację nr 1234 w sprawie przejść"
          />
        </label>
        <button
          disabled={zapisuje}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-slate-800 disabled:bg-slate-300"
        >
          Dodaj
        </button>
      </form>
      {blad && <p className="mt-2 text-sm text-red-700">{blad}</p>}

      {lista && lista.length > 0 && (
        <ol className="mt-5 space-y-2">
          {lista.map((w) => (
            <li key={w.id} className="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
              <span className="w-20 shrink-0 tabular-nums text-slate-500">
                {new Date(w.data).toLocaleDateString("pl-PL")}
              </span>
              <span className="w-36 shrink-0 text-xs font-medium text-brand-700">
                {TYPY_WYDARZEN[w.typ]}
              </span>
              <span className="min-w-0 flex-1 text-slate-800">{w.opis}</span>
              <button
                type="button"
                onClick={() => usun(w.id)}
                className="shrink-0 text-xs text-slate-400 hover:text-red-700"
              >
                Usuń
              </button>
            </li>
          ))}
        </ol>
      )}
      {lista && lista.length === 0 && (
        <p className="mt-4 text-sm text-slate-400">
          Jeszcze nic. Pierwsza odpowiedź posła albo zaproszenie na spotkanie
          będą tu pierwszym wpisem.
        </p>
      )}
    </section>
  );
}
