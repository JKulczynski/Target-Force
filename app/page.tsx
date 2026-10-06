"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { wszystkieKampanie } from "@/lib/store";
import { STATUSY, ZRODLA, type Kampania } from "@/lib/types";

export default function Kampanie() {
  const [kampanie, setKampanie] = useState<Kampania[] | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    wszystkieKampanie()
      .then(setKampanie)
      .catch(() => setBlad("Nie udało się wczytać kampanii. Odśwież stronę."));
  }, []);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kampanie</h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-600">
            Każda kampania trzyma wszystko w jednym miejscu: do kogo piszesz, po
            co, w jakiej formie i z jakim efektem.
          </p>
        </div>
        <Link
          href="/kampanie/nowa"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 active:bg-brand-800"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          Nowa kampania
        </Link>
      </div>

      {blad ? (
        <p
          role="alert"
          className="mt-10 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100"
        >
          {blad}
        </p>
      ) : kampanie === null ? (
        <div
          className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white"
          aria-busy="true"
          aria-label="Wczytuję kampanie"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-6 border-t border-slate-100 px-5 py-5 first:border-t-0"
            >
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      ) : kampanie.length === 0 ? (
        <div className="mt-8 grid gap-8 rounded-xl border border-slate-200 bg-white p-8 md:grid-cols-[1.2fr_1fr] md:p-10">
          <div>
            <p className="text-lg font-semibold tracking-tight">
              Pierwsza kampania w 4 krokach
            </p>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Zacznij od tego, do kogo chcesz dotrzeć i co chcesz osiągnąć.
              Wiadomości, listę odbiorców i wysyłkę zbudujemy z tych dwóch
              odpowiedzi.
            </p>
            <Link
              href="/kampanie/nowa"
              className="mt-6 inline-flex rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700"
            >
              Utwórz pierwszą kampanię
            </Link>
          </div>
          <ol className="space-y-3 text-sm text-slate-700">
            {[
              "Opisz cel i odbiorców",
              "Zatwierdź wygenerowane wiadomości",
              "Wyślij test na swój adres",
              "Wysyłaj partiami albo włącz automat",
            ].map((t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="hidden grid-cols-[minmax(0,1fr)_14rem_7rem_8.5rem] gap-6 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-medium text-slate-500 md:grid">
            <span>Kampania</span>
            <span>Odbiorcy</span>
            <span>Utworzona</span>
            <span>Status</span>
          </div>
          <ul>
            {kampanie.map((k) => {
              const status = STATUSY[k.status];
              return (
                <li
                  key={k.id}
                  className="border-t border-slate-100 first:border-t-0"
                >
                  <Link
                    href={`/kampanie/${k.id}`}
                    className="group grid gap-3 px-5 py-4 transition-colors duration-150 hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_14rem_7rem_8.5rem] md:items-center md:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 group-hover:text-brand-700">
                        {k.nazwa}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-slate-500">
                        {k.kogoSzukamy || "Odbiorca nieopisany"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {k.zrodla.length === 0 ? (
                        <span className="text-xs text-slate-500">
                          Bez źródeł
                        </span>
                      ) : (
                        k.zrodla.map((z) => (
                          <span
                            key={z}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                          >
                            {ZRODLA[z]?.nazwa ?? z}
                          </span>
                        ))
                      )}
                    </div>
                    <span className="tabular text-sm text-slate-500">
                      {new Date(k.utworzona).toLocaleDateString("pl-PL")}
                    </span>
                    <span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${status.klasa}`}
                      >
                        {k.status === "uruchomiona" && (
                          <span
                            className="relative flex h-1.5 w-1.5"
                            aria-hidden
                          >
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
                          </span>
                        )}
                        {status.etykieta}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
