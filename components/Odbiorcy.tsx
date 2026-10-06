"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Odbiorca = {
  id: string;
  imie: string | null;
  nazwisko: string | null;
  email: string | null;
  klub: string | null;
  okreg: string | null;
  wyslanychKrokow: number;
  ostatniaWyslana: string | null;
  blad: string | null;
  kliknal: boolean;
  odpowiedzial: string | null;
  wypisany: boolean;
};

type Widok = "wszyscy" | "wyslane" | "kliknieci" | "odpisali";

/**
 * Lista odbiorców ze statusem. "Odpisał" zaznacza nadawca ręcznie, bo odpowiedzi trafiają do jego skrzynki.
 * To pierwsza część dowodu efektu z wizji (30.09): kto dostał, kto kliknął, kto odpowiedział.
 */
export function Odbiorcy({
  kampaniaId,
  odswiez,
}: {
  kampaniaId: string;
  odswiez: number;
}) {
  const [lista, setLista] = useState<Odbiorca[] | null>(null);
  const [widok, setWidok] = useState<Widok>("wszyscy");
  const [szukaj, setSzukaj] = useState("");

  useEffect(() => {
    fetch(`/api/kampanie/${kampaniaId}/odbiorcy`)
      .then((odp) => (odp.ok ? odp.json() : null))
      .then((dane) => dane && setLista(dane.odbiorcy))
      .catch(() => {});
  }, [kampaniaId, odswiez]);

  async function przelaczOdpisal(o: Odbiorca) {
    const odpisal = !o.odpowiedzial;
    setLista(
      (l) =>
        l?.map((x) =>
          x.id === o.id
            ? { ...x, odpowiedzial: odpisal ? new Date().toISOString() : null }
            : x,
        ) ?? null,
    );
    await fetch(`/api/kampanie/${kampaniaId}/odbiorcy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kontaktId: o.id, odpisal }),
    }).catch(() => {});
  }

  if (!lista || lista.length === 0) return null;

  const licz = {
    wszyscy: lista.length,
    wyslane: lista.filter((o) => o.wyslanychKrokow > 0).length,
    kliknieci: lista.filter((o) => o.kliknal).length,
    odpisali: lista.filter((o) => o.odpowiedzial).length,
  };
  const fraza = szukaj.trim().toLowerCase();
  const widoczni = lista
    .filter((o) =>
      widok === "wyslane"
        ? o.wyslanychKrokow > 0
        : widok === "kliknieci"
          ? o.kliknal
          : widok === "odpisali"
            ? !!o.odpowiedzial
            : true,
    )
    .filter(
      (o) =>
        !fraza ||
        [o.imie, o.nazwisko, o.email, o.klub, o.okreg].some((v) =>
          v?.toLowerCase().includes(fraza),
        ),
    );

  const zakladki: { id: Widok; etykieta: string }[] = [
    { id: "wszyscy", etykieta: "Wszyscy" },
    { id: "wyslane", etykieta: "Wysłane" },
    { id: "kliknieci", etykieta: "Kliknęli" },
    { id: "odpisali", etykieta: "Odpisali" },
  ];

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">
          Odbiorcy
        </h2>
        <div className="flex items-center gap-3">
          <Link
            href={`/kampanie/${kampaniaId}/raport`}
            className="text-sm text-slate-500 underline-offset-2 transition hover:text-slate-900 hover:underline"
          >
            Raport dla klienta
          </Link>
          <input
            className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-900"
            placeholder="Szukaj: nazwisko, klub, okręg"
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {zakladki.map((z) => (
          <button
            key={z.id}
            onClick={() => setWidok(z.id)}
            className={`rounded-full px-3 py-1 text-xs ring-1 transition ${widok === z.id ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300 hover:ring-slate-900"}`}
          >
            {z.etykieta} {licz[z.id]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Odpowiedzi przychodzą do skrzynki nadawcy. Zaznacz „Odpisał”, żeby
        liczyć wynik i nie wysyłać tej osobie przypomnień.
      </p>

      <div className="mt-4 max-h-[28rem] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white text-xs text-slate-400">
            <tr>
              <th className="py-2 pr-3 font-medium">Osoba</th>
              <th className="py-2 pr-3 font-medium">Klub / okręg</th>
              <th className="py-2 pr-3 font-medium">Wysłane</th>
              <th className="py-2 pr-3 font-medium">Kliknął</th>
              <th className="py-2 font-medium">Odpisał</th>
            </tr>
          </thead>
          <tbody>
            {widoczni.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="py-2 pr-3">
                  <p className="text-slate-800">
                    {[o.imie, o.nazwisko].filter(Boolean).join(" ") || o.email}
                  </p>
                  <p className="text-xs text-slate-400">{o.email}</p>
                </td>
                <td className="py-2 pr-3 text-xs text-slate-500">
                  {[o.klub, o.okreg].filter(Boolean).join(" · ")}
                </td>
                <td className="py-2 pr-3 text-xs">
                  {o.blad ? (
                    <span className="text-red-600" title={o.blad}>
                      Błąd
                    </span>
                  ) : o.wyslanychKrokow > 0 ? (
                    <span className="text-slate-700">
                      {o.wyslanychKrokow === 1
                        ? "1 mail"
                        : `${o.wyslanychKrokow} maile`}
                      {o.ostatniaWyslana && (
                        <span className="text-slate-400">
                          {" "}
                          ·{" "}
                          {new Date(o.ostatniaWyslana).toLocaleDateString(
                            "pl-PL",
                          )}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-300">nie</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs">
                  {o.kliknal ? (
                    <span className="font-medium text-emerald-700">tak</span>
                  ) : (
                    <span className="text-slate-300">nie</span>
                  )}
                </td>
                <td className="py-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={!!o.odpowiedzial}
                      onChange={() => przelaczOdpisal(o)}
                      disabled={o.wyslanychKrokow === 0}
                    />
                    {o.odpowiedzial ? "tak" : ""}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {widoczni.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">
            Nikogo w tym widoku.
          </p>
        )}
      </div>
    </section>
  );
}
