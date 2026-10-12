"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Kampania } from "@/lib/types";
import { czyCosWyslano } from "@/lib/store";
import { useT } from "@/lib/i18n/klient";

const KLUCZ_UKRYCIA = "wo_start_ukryty";

/**
 * "Zacznij tutaj" (blok B, 12.10): cztery kroki dla nowego klienta, liczone z danych, nie z kliknięć.
 * Znika, gdy wszystko zrobione albo gdy użytkownik go schowa (pamięć przeglądarki, tylko wygoda).
 */
export function ZacznijTutaj({ kampanie }: { kampanie: Kampania[] }) {
  const { t } = useT();
  const [ukryty, setUkryty] = useState(true);
  const [wyslano, setWyslano] = useState<boolean | null>(null);

  useEffect(() => {
    let schowany = false;
    try {
      schowany = window.localStorage.getItem(KLUCZ_UKRYCIA) === "1";
    } catch {
      /* brak dostępu do pamięci przeglądarki: pokazujemy */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- odczyt pamięci przeglądarki dopiero po hydratacji
    setUkryty(schowany);
    czyCosWyslano()
      .then(setWyslano)
      .catch(() => setWyslano(false));
  }, []);

  const pierwsza = kampanie[0];
  const kroki = [
    { nazwa: t("start.k1"), opis: t("start.k1.opis"), gotowe: kampanie.length > 0, href: "/kampanie/nowa" },
    {
      nazwa: t("start.k2"),
      opis: t("start.k2.opis"),
      gotowe: kampanie.some((k) => k.zgodaZespolu !== null),
      href: pierwsza ? `/kampanie/${pierwsza.id}#zleca` : "/kampanie/nowa",
    },
    {
      nazwa: t("start.k3"),
      opis: t("start.k3.opis"),
      gotowe: kampanie.some((k) => k.skrzynkaId),
      href: pierwsza ? `/kampanie/${pierwsza.id}#skrzynka` : "/kampanie/nowa",
    },
    {
      nazwa: t("start.k4"),
      opis: t("start.k4.opis"),
      gotowe: wyslano === true,
      href: pierwsza ? `/kampanie/${pierwsza.id}#wysylka` : "/kampanie/nowa",
    },
  ];
  const gotowych = kroki.filter((k) => k.gotowe).length;
  if (ukryty || wyslano === null || gotowych === kroki.length) return null;
  const nastepny = kroki.findIndex((k) => !k.gotowe);

  return (
    <section className="mt-6 rounded-xl border border-brand-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{t("start.tytul")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("start.postep", { z: gotowych, wszystkich: kroki.length })}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setUkryty(true);
            try {
              window.localStorage.setItem(KLUCZ_UKRYCIA, "1");
            } catch {
              /* trudno, schowane tylko do odświeżenia */
            }
          }}
          className="text-sm text-slate-400 hover:text-slate-700"
        >
          {t("start.schowaj")}
        </button>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-4">
        {kroki.map((k, i) => (
          <li key={k.nazwa}>
            <Link
              href={k.href}
              className={`block h-full rounded-lg p-4 ring-1 transition-colors duration-150 ${
                i === nastepny ? "bg-brand-50 ring-brand-200 hover:bg-brand-100" : "ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                  k.gotowe ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
                aria-hidden
              >
                {k.gotowe ? "✓" : i + 1}
              </span>
              <p className="mt-2 text-sm font-medium text-slate-900">{k.nazwa}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{k.opis}</p>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
