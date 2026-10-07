"use client";

import { useEffect, useState } from "react";

type Posiedzenie = { numer: number; tytul: string; od: string; do: string; trwa: boolean };

const data = (d: string) =>
  new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "long" });

/** Ile dni od dziś do daty (ujemne = w przeszłości). */
function zaDni(d: string) {
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000);
}

/**
 * Podpowiedź momentu wysyłki do posłów: najbliższe posiedzenia Sejmu z API.
 * Reguła: pierwsza wiadomość 5-7 dni przed posiedzeniem, żeby biuro zdążyło przygotować pytanie albo interpelację.
 */
export function MomentSejmu({ start, onWybierz }: { start?: string | null; onWybierz?: (data: string) => void }) {
  const [lista, setLista] = useState<Posiedzenie[] | null>(null);

  useEffect(() => {
    let aktualny = true;
    fetch("/api/sejm/posiedzenia")
      .then((o) => (o.ok ? o.json() : []))
      .then((d) => aktualny && setLista(Array.isArray(d) ? d : []))
      .catch(() => aktualny && setLista([]));
    return () => {
      aktualny = false;
    };
  }, []);

  if (!lista || lista.length === 0) return null;
  const najblizsze = lista.find((p) => !p.trwa) ?? lista[0];
  const sugerowana = new Date(najblizsze.od);
  sugerowana.setDate(sugerowana.getDate() - 6);
  const sugerowanaIso = sugerowana.toISOString().slice(0, 10);
  const dni = zaDni(najblizsze.od);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
      <p className="text-xs font-medium text-slate-500">Właściwy moment</p>
      <p className="mt-1 text-slate-800">
        {najblizsze.trwa ? "Trwa posiedzenie Sejmu" : "Najbliższe posiedzenie Sejmu"}:{" "}
        <span className="font-medium">
          {data(najblizsze.od)}
          {najblizsze.do !== najblizsze.od && ` do ${data(najblizsze.do)}`}
        </span>
        {!najblizsze.trwa && dni > 0 && <span className="text-slate-500"> (za {dni} dni)</span>}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Biura poselskie przygotowują pytania i interpelacje przed obradami. Wyślij
        pierwszą wiadomość 5-7 dni wcześniej
        {zaDni(sugerowanaIso) >= 0 && <>, czyli około {data(sugerowanaIso)}</>}.
        {lista.length > 1 && (
          <>
            {" "}
            Kolejne: {lista.slice(1).map((p) => data(p.od)).join(", ")}.
          </>
        )}
      </p>
      {onWybierz && zaDni(sugerowanaIso) >= 0 && start !== sugerowanaIso && (
        <button
          type="button"
          onClick={() => onWybierz(sugerowanaIso)}
          className="mt-2 text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
        >
          Ustaw start na {data(sugerowanaIso)}
        </button>
      )}
    </div>
  );
}
