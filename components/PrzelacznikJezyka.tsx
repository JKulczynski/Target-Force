"use client";

import { JEZYKI, type Jezyk } from "@/lib/i18n";
import { useT } from "@/lib/i18n/klient";

const NAZWY: Record<Jezyk, string> = { pl: "PL", en: "EN" };

/** Przełącznik PL / EN: cookie na rok + odświeżenie. `ciemny` = wersja na ciemny pasek aplikacji. */
export function PrzelacznikJezyka({ ciemny = false }: { ciemny?: boolean }) {
  const { jezyk, ustawJezyk, t } = useT();
  return (
    <div
      role="group"
      aria-label={t("jezyk.etykieta")}
      className={`flex items-center rounded-md p-0.5 text-xs font-medium ${ciemny ? "bg-white/10" : "bg-slate-200/70"}`}
    >
      {JEZYKI.map((j) => (
        <button
          key={j}
          type="button"
          onClick={() => ustawJezyk(j)}
          aria-pressed={jezyk === j}
          className={`rounded px-2 py-1 transition-colors duration-150 ${
            jezyk === j
              ? ciemny
                ? "bg-white text-slate-900"
                : "bg-white text-slate-900 shadow-sm"
              : ciemny
                ? "text-slate-300 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {NAZWY[j]}
        </button>
      ))}
    </div>
  );
}
