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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kampanie</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kampania trzyma wszystko: do kogo piszesz, po co i w jakiej formie.
          </p>
        </div>
        <Link
          href="/kampanie/nowa"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          <span className="text-base leading-none">+</span>
          Dodaj kampanię
        </Link>
      </div>

      {blad ? (
        <p className="mt-10 text-sm text-red-600">{blad}</p>
      ) : kampanie === null ? (
        <p className="mt-10 text-sm text-slate-400">Wczytuję...</p>
      ) : kampanie.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="font-medium text-slate-700">Nie ma jeszcze żadnej kampanii</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Zacznij od tego, do kogo chcesz dotrzeć i co chcesz osiągnąć. Listę kontaktów
            i treść wiadomości zbudujemy z tych dwóch odpowiedzi.
          </p>
          <Link
            href="/kampanie/nowa"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Dodaj pierwszą kampanię
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {kampanie.map((k) => {
            const status = STATUSY[k.status];
            return (
              <li key={k.id}>
                <Link
                  href={`/kampanie/${k.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium">{k.nazwa}</h2>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {k.kogoSzukamy || "Odbiorca nieopisany"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${status.klasa}`}
                    >
                      {status.etykieta}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {k.zrodla.length === 0 ? (
                      <span className="text-xs text-slate-400">Bez źródeł</span>
                    ) : (
                      k.zrodla.map((z) => (
                        <span
                          key={z}
                          className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {ZRODLA[z].nazwa}
                        </span>
                      ))
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
