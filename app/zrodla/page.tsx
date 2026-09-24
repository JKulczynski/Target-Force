import { ZRODLA, type ZrodloId } from "@/lib/types";

export default function Zrodla() {
  const lista = Object.keys(ZRODLA) as ZrodloId[];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Źródła kontaktów</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Trzy pierwsze mają otwarte API, bez klucza i bez rejestracji. Sprawdzone 24.09.2026:
        każde odpowiedziało poprawnymi danymi. Apollo i Clay wymagają kluczy.
      </p>

      <ul className="mt-8 space-y-3">
        {lista.map((id) => {
          const z = ZRODLA[id];
          return (
            <li key={id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-medium">{z.nazwa}</h2>
                  <p className="mt-1 text-sm text-slate-500">{z.opis}</p>
                  {z.api && (
                    <p className="mt-2 truncate font-mono text-xs text-slate-400">{z.api}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                    z.api
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-slate-100 text-slate-500 ring-slate-200"
                  }`}
                >
                  {z.api ? "Otwarte API" : "Wymaga klucza"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
