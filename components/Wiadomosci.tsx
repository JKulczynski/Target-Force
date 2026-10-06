"use client";

import { useEffect, useState } from "react";
import {
  psychografiaKampanii,
  warianty,
  zmienWariant,
  type Wariant,
} from "@/lib/store";

const pole =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15";

/**
 * Generowanie wiadomości i etap zatwierdzania (Jan, 30.09: nadawca czyta, poprawia i zatwierdza treść,
 * zanim cokolwiek wyjdzie; bez tego narzędzie staje się generatorem sztucznego poparcia).
 */
export function Wiadomosci({
  kampaniaId,
  onZmiana,
}: {
  kampaniaId: string;
  onZmiana?: () => void;
}) {
  const [lista, setLista] = useState<Wariant[] | null>(null);
  const [psychografia, setPsychografia] = useState<string | null>(null);
  const [jezyk, setJezyk] = useState<string | null>(null);
  const [generuje, setGeneruje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function wczytaj() {
    const [w, p] = await Promise.all([
      warianty(kampaniaId),
      psychografiaKampanii(kampaniaId),
    ]);
    setLista(w);
    onZmiana?.();
    setPsychografia(p.opis);
    setJezyk(p.jezyk);
  }

  useEffect(() => {
    wczytaj().catch(() => setLista([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kampaniaId]);

  async function generuj() {
    setGeneruje(true);
    setBlad(null);
    try {
      const odp = await fetch(`/api/kampanie/${kampaniaId}/generuj`, {
        method: "POST",
      });
      const dane = await odp.json().catch(() => ({}));
      if (!odp.ok)
        return setBlad(dane.blad ?? "Nie udało się wygenerować wiadomości.");
      await wczytaj();
    } catch {
      setBlad("Nie udało się wygenerować wiadomości.");
    } finally {
      setGeneruje(false);
    }
  }

  const aktywne = (lista ?? []).filter((w) => w.status !== "odrzucony");
  const zatwierdzone = aktywne.filter(
    (w) => w.status === "zatwierdzony",
  ).length;

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Wiadomości
          </h2>
          {aktywne.length > 0 && (
            <p className="mt-1 text-sm text-slate-600">
              Zatwierdzone{" "}
              <span className="font-semibold text-slate-900">
                {zatwierdzone}
              </span>{" "}
              z {aktywne.length}
              {jezyk && ` · język: ${jezyk}`}. Wysyłamy tylko zatwierdzone.
            </p>
          )}
        </div>
        <button
          onClick={generuj}
          disabled={generuje}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
        >
          {generuje
            ? "Piszę wiadomości (ok. 1-2 min)..."
            : aktywne.length
              ? "Wygeneruj ponownie"
              : "Wygeneruj wiadomości"}
        </button>
      </div>

      {blad && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {blad}
        </p>
      )}

      {psychografia && (
        <details className="mt-5 rounded-lg bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Psychografia odbiorców (na tej podstawie pisane są wiadomości)
          </summary>
          <p className="mt-3 text-sm whitespace-pre-line text-slate-600">
            {psychografia}
          </p>
        </details>
      )}

      {lista && lista.length === 0 && !generuje && (
        <p className="mt-4 text-sm text-slate-500">
          Jeszcze nic nie ma. Kliknij „Wygeneruj wiadomości”: AI przygotuje
          psychografię odbiorców i warianty maili na podstawie celu i materiałów
          kampanii.
        </p>
      )}

      <div className="mt-5 space-y-4">
        {aktywne.map((w) => (
          <KartaWariantu key={w.id} w={w} onZmiana={wczytaj} />
        ))}
      </div>
    </section>
  );
}

function KartaWariantu({
  w,
  onZmiana,
}: {
  w: Wariant;
  onZmiana: () => Promise<void>;
}) {
  const [temat, setTemat] = useState(w.temat);
  const [tresc, setTresc] = useState(w.tresc);
  const [zapisuje, setZapisuje] = useState(false);
  const zmieniony = temat !== w.temat || tresc !== w.tresc;
  const etykieta =
    w.krok === 0
      ? `Pierwsza wiadomość, wariant ${w.numer}`
      : `Przypomnienie ${w.krok}`;

  async function zapisz(status?: Wariant["status"]) {
    setZapisuje(true);
    try {
      await zmienWariant(w.id, { temat, tresc, ...(status ? { status } : {}) });
      await onZmiana();
    } finally {
      setZapisuje(false);
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 ${w.status === "zatwierdzony" ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{etykieta}</p>
        {w.status === "zatwierdzony" && (
          <span className="text-xs font-medium text-emerald-700">
            Zatwierdzona
          </span>
        )}
      </div>
      <input
        className={`${pole} mt-2 font-medium`}
        value={temat}
        onChange={(e) => setTemat(e.target.value)}
      />
      <textarea
        className={`${pole} mt-2 min-h-40 resize-y`}
        value={tresc}
        onChange={(e) => setTresc(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-3">
        {w.status !== "zatwierdzony" ? (
          <button
            onClick={() => zapisz("zatwierdzony")}
            disabled={zapisuje}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
          >
            {zmieniony ? "Zapisz i zatwierdź" : "Zatwierdź"}
          </button>
        ) : (
          zmieniony && (
            <button
              onClick={() => zapisz()}
              disabled={zapisuje}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
            >
              Zapisz zmiany
            </button>
          )
        )}
        {w.status === "zatwierdzony" && (
          <button
            onClick={() => zapisz("szkic")}
            disabled={zapisuje}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Cofnij zatwierdzenie
          </button>
        )}
        <button
          onClick={() => zapisz("odrzucony")}
          disabled={zapisuje}
          className="text-sm text-slate-400 transition hover:text-red-600"
        >
          Odrzuć
        </button>
      </div>
    </div>
  );
}
