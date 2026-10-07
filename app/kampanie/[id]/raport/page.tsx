"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { kampania } from "@/lib/store";
import type { Kampania } from "@/lib/types";

type Odbiorca = {
  id: string;
  imie: string | null;
  nazwisko: string | null;
  email: string | null;
  klub: string | null;
  okreg: string | null;
  wyslanychKrokow: number;
  ostatniaWyslana: string | null;
  kliknal: boolean;
  odpowiedzial: string | null;
  wypisany: boolean;
};

const procent = (a: number, b: number) =>
  b ? `${Math.round((a / b) * 100)}%` : "-";

/**
 * Liczby odniesienia z badań (research TF, Vault: wiedza/research-tf-skille, 06.10.2026).
 * Tylko wartości, które są w wynikach researchu, z nazwą źródła. Orientacyjne: inne kraje, inne tematy, inne lata.
 */
const BENCHMARK = [
  {
    wartosc: "ok. 28%",
    opis: "europosłów odpowiedziało merytorycznie na krótki mail obywatela z własnego kraju",
    zrodlo: "De Vries, Dinas, Solaz 2016, wszyscy posłowie PE",
  },
  {
    wartosc: "15-17%",
    opis: "odpowiedzi na niezamawiane maile rzecznicze do parlamentarzystów stanowych w USA",
    zrodlo: "Kreps i Kriner 2023, 32 tys. maili",
  },
  {
    wartosc: "94%",
    opis: "gmin w Polsce odpowiedziało na formalny wniosek o informację publiczną",
    zrodlo: "Fundacja Batorego 2024, próba 200 gmin",
  },
];
const osoba = (o: Odbiorca) =>
  [o.imie, o.nazwisko].filter(Boolean).join(" ") || o.email || "";

/**
 * Raport kampanii dla klienta: ile wysłano, kto kliknął, kto odpisał, z podziałem na kluby.
 * Druga część dowodu efektu z wizji (30.09). Do PDF przez druk przeglądarki (nawigacja chowa się przy druku).
 */
export default function RaportKampanii() {
  const { id } = useParams<{ id: string }>();
  const [k, setK] = useState<Kampania | null | undefined>(undefined);
  const [lista, setLista] = useState<Odbiorca[] | null>(null);

  useEffect(() => {
    kampania(id)
      .then((wynik) => setK(wynik ?? null))
      .catch(() => setK(null));
    fetch(`/api/kampanie/${id}/odbiorcy`)
      .then((odp) => (odp.ok ? odp.json() : null))
      .then((dane) => setLista(dane?.odbiorcy ?? []))
      .catch(() => setLista([]));
  }, [id]);

  if (k === undefined || lista === null)
    return <p className="text-sm text-slate-400">Wczytuję...</p>;
  if (k === null)
    return <p className="text-sm text-slate-500">Nie ma takiej kampanii.</p>;

  const wyslani = lista.filter((o) => o.wyslanychKrokow > 0);
  const kliknieci = wyslani.filter((o) => o.kliknal);
  const odpisali = wyslani.filter((o) => o.odpowiedzial);
  const wypisani = wyslani.filter((o) => o.wypisany);
  const maile = wyslani.reduce((s, o) => s + o.wyslanychKrokow, 0);
  const daty = wyslani
    .map((o) => o.ostatniaWyslana)
    .filter((d): d is string => !!d)
    .sort();

  const kluby = new Map<
    string,
    { razem: number; wyslani: number; kliknieci: number; odpisali: number }
  >();
  for (const o of lista) {
    const nazwa = o.klub || "Bez klubu";
    const w = kluby.get(nazwa) ?? {
      razem: 0,
      wyslani: 0,
      kliknieci: 0,
      odpisali: 0,
    };
    w.razem++;
    if (o.wyslanychKrokow > 0) w.wyslani++;
    if (o.wyslanychKrokow > 0 && o.kliknal) w.kliknieci++;
    if (o.wyslanychKrokow > 0 && o.odpowiedzial) w.odpisali++;
    kluby.set(nazwa, w);
  }
  const wierszeKlubow = [...kluby.entries()]
    .filter(([, w]) => w.wyslani > 0)
    .sort((a, b) => b[1].wyslani - a[1].wyslani || a[0].localeCompare(b[0]));

  const zaangazowani = wyslani
    .filter((o) => o.kliknal || o.odpowiedzial)
    .sort(
      (a, b) =>
        Number(!!b.odpowiedzial) - Number(!!a.odpowiedzial) ||
        (a.nazwisko ?? "").localeCompare(b.nazwisko ?? ""),
    );

  const liczby = [
    {
      etykieta: "Adresaci",
      wartosc: wyslani.length,
      opis: `${maile} ${maile === 1 ? "mail" : "maili"} z przypomnieniami`,
    },
    {
      etykieta: "Kliknęli w link",
      wartosc: kliknieci.length,
      opis: `${procent(kliknieci.length, wyslani.length)} adresatów`,
    },
    {
      etykieta: "Odpisali",
      wartosc: odpisali.length,
      opis: `${procent(odpisali.length, wyslani.length)} adresatów`,
    },
    {
      etykieta: "Wypisali się",
      wartosc: wypisani.length,
      opis: `${procent(wypisani.length, wyslani.length)} adresatów`,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href={`/kampanie/${id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          &larr; Kampania
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700"
        >
          Zapisz jako PDF
        </button>
      </div>

      <header className="mt-6">
        <p className="flex items-center gap-2 text-sm font-medium text-brand-700">
          <span aria-hidden className="h-2 w-2 rounded-full bg-brand-600" />
          Target Force · raport kampanii
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {k.nazwa}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {daty.length
            ? `Wysyłka ${new Date(daty[0]).toLocaleDateString("pl-PL")}${daty.length > 1 && daty[0].slice(0, 10) !== daty[daty.length - 1].slice(0, 10) ? ` - ${new Date(daty[daty.length - 1]).toLocaleDateString("pl-PL")}` : ""}`
            : "Wysyłka jeszcze nie ruszyła"}
          {" · "}stan na {new Date().toLocaleDateString("pl-PL")}
        </p>
        {k.cel && (
          <p className="mt-3 max-w-3xl text-sm text-slate-600">
            <span className="text-slate-400">Cel: </span>
            {k.cel}
          </p>
        )}
      </header>

      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {liczby.map((l) => (
          <div
            key={l.etykieta}
            className="rounded-xl border border-slate-200 bg-white p-5 break-inside-avoid"
          >
            <p className="text-xs text-slate-400">{l.etykieta}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {l.wartosc}
            </p>
            <p className="mt-1 text-xs text-slate-500">{l.opis}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 break-inside-avoid">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">
          Dla porównania
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Odsetek odpowiedzi w badaniach kontaktu z decydentami. Liczby
          orientacyjne: inne kraje, tematy i lata, nie ta kampania.
        </p>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {BENCHMARK.map((b) => (
            <li key={b.zrodlo}>
              <p className="text-2xl font-semibold tracking-tight">
                {b.wartosc}
              </p>
              <p className="mt-1 text-sm text-slate-600">{b.opis}</p>
              <p className="mt-1 text-xs text-slate-400">({b.zrodlo})</p>
            </li>
          ))}
        </ul>
      </section>

      {wierszeKlubow.length > 1 && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 break-inside-avoid">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Według klubów
          </h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="py-2 pr-3 font-medium">Klub</th>
                <th className="py-2 pr-3 font-medium">Adresaci</th>
                <th className="py-2 pr-3 font-medium">Kliknęli</th>
                <th className="py-2 font-medium">Odpisali</th>
              </tr>
            </thead>
            <tbody>
              {wierszeKlubow.map(([nazwa, w]) => (
                <tr key={nazwa} className="border-t border-slate-100">
                  <td className="py-2 pr-3 text-slate-800">{nazwa}</td>
                  <td className="py-2 pr-3 text-slate-600">{w.wyslani}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    {w.kliknieci}{" "}
                    <span className="text-xs text-slate-400">
                      ({procent(w.kliknieci, w.wyslani)})
                    </span>
                  </td>
                  <td className="py-2 text-slate-600">
                    {w.odpisali}{" "}
                    <span className="text-xs text-slate-400">
                      ({procent(w.odpisali, w.wyslani)})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">
          Kto zareagował
        </h2>
        {zaangazowani.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Na razie nikt nie kliknął ani nie odpisał.
          </p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <tbody>
              {zaangazowani.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-slate-100 first:border-t-0"
                >
                  <td className="py-2 pr-3 text-slate-800">{osoba(o)}</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">
                    {[o.klub, o.okreg].filter(Boolean).join(" · ")}
                  </td>
                  <td className="py-2 text-right text-xs">
                    {o.odpowiedzial ? (
                      <span className="font-medium text-emerald-700">
                        odpisał(a)
                      </span>
                    ) : (
                      <span className="text-slate-600">kliknął(a) w link</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-6 text-xs text-slate-400">
        Kliknięcia liczone przez link śledzący w treści maila. Odpowiedzi
        oznacza nadawca, bo trafiają do jego skrzynki.
      </p>
    </>
  );
}
