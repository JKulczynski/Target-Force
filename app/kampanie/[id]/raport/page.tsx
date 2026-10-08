"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  kampania,
  podpisyKampanii,
  wydarzenia,
  type Wydarzenie,
} from "@/lib/store";
import type { Kampania } from "@/lib/types";
import type { TrescOswiadczenia } from "@/lib/oswiadczenie";
import { useT } from "@/lib/i18n/klient";

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
 * Opis w słowniku (raport.bench.N), źródło (cytowanie) zostaje jak w publikacji.
 */
const BENCHMARK = [
  { n: 1, wartosc: "ok. 28%", zrodlo: "De Vries, Dinas, Solaz 2016, wszyscy posłowie PE" },
  { n: 2, wartosc: "15-17%", zrodlo: "Kreps i Kriner 2023, 32 tys. maili" },
  { n: 3, wartosc: "94%", zrodlo: "Fundacja Batorego 2024, próba 200 gmin" },
] as const;
const osoba = (o: Odbiorca) =>
  [o.imie, o.nazwisko].filter(Boolean).join(" ") || o.email || "";

/**
 * Raport kampanii dla klienta: ile wysłano, kto kliknął, kto odpisał, z podziałem na kluby.
 * Druga część dowodu efektu z wizji (30.09). Do PDF przez druk przeglądarki (nawigacja chowa się przy druku).
 */
export default function RaportKampanii() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const [k, setK] = useState<Kampania | null | undefined>(undefined);
  const [lista, setLista] = useState<Odbiorca[] | null>(null);
  const [wplyw, setWplyw] = useState<Wydarzenie[]>([]);
  const [oswiadczenie, setOswiadczenie] = useState<{ tresc: TrescOswiadczenia; utworzone: string } | null>(null);
  const [akcja, setAkcja] = useState<{
    razem: number;
    otworzyli: number;
    udostepnili: number;
    zrodla: { nazwa: string; ile: number }[];
  } | null>(null);

  useEffect(() => {
    kampania(id)
      .then((wynik) => setK(wynik ?? null))
      .catch(() => setK(null));
    wydarzenia(id)
      .then(setWplyw)
      .catch(() => {});
    fetch(`/api/kampanie/${id}/oswiadczenie`)
      .then((o) => (o.ok ? o.json() : null))
      .then((d) => d?.oswiadczenie && setOswiadczenie(d.oswiadczenie))
      .catch(() => {});
    podpisyKampanii(id, 1)
      .then((p) => setAkcja({ razem: p.razem, otworzyli: p.otworzyli, udostepnili: p.udostepnili, zrodla: p.zrodla }))
      .catch(() => {});
    fetch(`/api/kampanie/${id}/odbiorcy`)
      .then((odp) => (odp.ok ? odp.json() : null))
      .then((dane) => setLista(dane?.odbiorcy ?? []))
      .catch(() => setLista([]));
  }, [id]);

  if (k === undefined || lista === null)
    return <p className="text-sm text-slate-400">{t("wspolne.wczytuje")}</p>;
  if (k === null)
    return <p className="text-sm text-slate-500">{t("raport.brak")}</p>;

  const data = (d: string | Date) => new Date(d).toLocaleDateString(t.locale);
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
    const nazwa = o.klub || t("raport.bezKlubu");
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
      etykieta: t("raport.l.adresaci"),
      wartosc: wyslani.length,
      opis: t.n("raport.maili", maile),
    },
    {
      etykieta: t("raport.l.kliknieli"),
      wartosc: kliknieci.length,
      opis: t("raport.adresatow", { p: procent(kliknieci.length, wyslani.length) }),
    },
    {
      etykieta: t("raport.l.odpisali"),
      wartosc: odpisali.length,
      opis: t("raport.adresatow", { p: procent(odpisali.length, wyslani.length) }),
    },
    {
      etykieta: t("raport.l.wypisali"),
      wartosc: wypisani.length,
      opis: t("raport.adresatow", { p: procent(wypisani.length, wyslani.length) }),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href={`/kampanie/${id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          &larr; {t("raport.kampania")}
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700"
        >
          {t("raport.pdf")}
        </button>
      </div>

      <header className="mt-6">
        <p className="flex items-center gap-2 text-sm font-medium text-brand-700">
          <span aria-hidden className="h-2 w-2 rounded-full bg-brand-600" />
          {t("raport.naglowek")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {k.nazwa}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {daty.length
            ? t("raport.wysylka", { od: data(daty[0]) }) +
              (daty.length > 1 && daty[0].slice(0, 10) !== daty[daty.length - 1].slice(0, 10)
                ? t("raport.wysylkaDo", { do: data(daty[daty.length - 1]) })
                : "")
            : t("raport.nieRuszyla")}
          {" · "}
          {t("raport.stanNa", { data: data(new Date()) })}
        </p>
        {k.cel && (
          <p className="mt-3 max-w-3xl text-sm text-slate-600">
            <span className="text-slate-400">{t("raport.cel")}</span>
            {k.cel}
          </p>
        )}
        {oswiadczenie && (
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            <span className="text-slate-400">{t("raport.zleceniodawca")}</span>
            {oswiadczenie.tresc.zleceniodawca}
            {oswiadczenie.tresc.rola === "zlecenie" &&
              t("raport.naZlecenie", { kto: oswiadczenie.tresc.naZlecenieKogo })}
            {" · "}
            <span className="text-slate-400">{t("raport.zrodloFin")}</span>
            {t(`zrodloFin.${oswiadczenie.tresc.zrodlo}`)}
            {oswiadczenie.tresc.zrodloOpis && ` (${oswiadczenie.tresc.zrodloOpis})`}
            {" · "}
            <span className="text-slate-400">{t("raport.oswZ")}</span>
            {data(oswiadczenie.utworzone)}
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

      {wplyw.length > 0 && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 break-inside-avoid">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            {t("raport.coSie")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t("raport.coSie.opis")}</p>
          <ol className="mt-4 space-y-3">
            {wplyw.map((w) => (
              <li key={w.id} className="flex gap-4 text-sm">
                <span className="w-20 shrink-0 tabular-nums text-slate-500">
                  {data(w.data)}
                </span>
                <span>
                  <span className="mr-2 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
                    {t(`typWydarzenia.${w.typ}`)}
                  </span>
                  <span className="text-slate-800">{w.opis}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {k.akcjaSlug && akcja && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 break-inside-avoid">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            {t("raport.akcja.tytul")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t("raport.akcja.opis")}</p>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {[
              [t("raport.akcja.podpisalo"), akcja.razem],
              [t("raport.akcja.otworzylo"), akcja.otworzyli],
              [t("raport.akcja.udostepnilo"), akcja.udostepnili],
            ].map(([e, v]) => (
              <div key={String(e)}>
                <p className="text-3xl font-semibold tracking-tight">{v}</p>
                <p className="mt-1 text-xs text-slate-500">{e}</p>
              </div>
            ))}
          </div>
          {akcja.zrodla.length > 1 && (
            <p className="mt-4 text-sm text-slate-600">
              <span className="text-slate-400">{t("raport.skad")}</span>
              {akcja.zrodla.map((z) => `${z.nazwa} ${z.ile}`).join(" · ")}
            </p>
          )}
        </section>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 break-inside-avoid">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">
          {t("raport.porownanie")}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t("raport.porownanie.opis")}</p>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {BENCHMARK.map((b) => (
            <li key={b.zrodlo}>
              <p className="text-2xl font-semibold tracking-tight">
                {b.wartosc}
              </p>
              <p className="mt-1 text-sm text-slate-600">{t(`raport.bench.${b.n}`)}</p>
              <p className="mt-1 text-xs text-slate-400">({b.zrodlo})</p>
            </li>
          ))}
        </ul>
      </section>

      {wierszeKlubow.length > 1 && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 break-inside-avoid">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            {t("raport.wedlugKlubow")}
          </h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="py-2 pr-3 font-medium">{t("raport.kol.klub")}</th>
                <th className="py-2 pr-3 font-medium">{t("raport.kol.adresaci")}</th>
                <th className="py-2 pr-3 font-medium">{t("raport.kol.kliknieli")}</th>
                <th className="py-2 font-medium">{t("raport.kol.odpisali")}</th>
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
          {t("raport.ktoZareagowal")}
        </h2>
        {zaangazowani.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">{t("raport.niktNie")}</p>
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
                      <span className="font-medium text-emerald-700">{t("raport.odpisal")}</span>
                    ) : (
                      <span className="text-slate-600">{t("raport.kliknal")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-6 text-xs text-slate-400">{t("raport.stopka")}</p>
    </>
  );
}
