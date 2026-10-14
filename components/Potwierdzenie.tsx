"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/klient";

/** Przyciski strony /p/{token}: potwierdzenie wysyłki i zgłoszenie odpowiedzi decydenta. */
export function Potwierdzenie({
  token,
  status: poczatkowy,
  wyslano,
  odpisal: poczatkowoOdpisal,
  rodzaj: poczatkowyRodzaj = null,
  odbiorca = "",
  linkAkcji,
  wypisz = false,
  zapisany = false,
}: {
  token: string;
  status: string;
  wyslano: string | null;
  odpisal: boolean;
  /** Rodzaj odpowiedzi zgłoszony przez mieszkańca (14.10): merytoryczna / szablonowa / brak. */
  rodzaj?: string | null;
  odbiorca?: string;
  linkAkcji: string | null;
  /** Wejście z linku "wypisz się" w mailu do sympatyków. */
  wypisz?: boolean;
  /** Czy osoba ma zgodę na kontakt od organizatora (jest na liście mailowej). */
  zapisany?: boolean;
}) {
  const { t } = useT();
  const [status, setStatus] = useState(poczatkowy);
  const [rodzaj, setRodzaj] = useState<string | null>(poczatkowyRodzaj ?? (poczatkowoOdpisal ? "merytoryczna" : null));
  const [naLiscie, setNaLiscie] = useState(zapisany);
  const [pracuje, setPracuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function wyslij(co: "wyslij" | "odpisal" | "wypisz" | "odpowiedz", rodzajOdp?: string) {
    setPracuje(true);
    setBlad(null);
    try {
      const odp = await fetch("/api/potwierdz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, co, rodzaj: rodzajOdp }),
      });
      const d = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(d.blad ?? t("potw.blad"));
      if (co === "odpisal" || co === "odpowiedz") {
        setRodzaj(d.rodzaj ?? rodzajOdp ?? null);
      }
      else if (co === "wypisz") setNaLiscie(false);
      else setStatus(d.status);
    } catch {
      setBlad(t("potw.blad"));
    } finally {
      setPracuje(false);
    }
  }

  const przycisk =
    "w-full rounded-lg bg-brand-600 px-5 py-3 text-[15px] font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300";

  if (wypisz)
    return (
      <div className="mt-6 space-y-3">
        {naLiscie ? (
          <button type="button" disabled={pracuje} onClick={() => wyslij("wypisz")} className={przycisk}>
            {t("potw.wypisz")}
          </button>
        ) : (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">{t("potw.wypisano")}</p>
        )}
        {blad && <p className="text-sm text-red-700">{blad}</p>}
      </div>
    );

  return (
    <div className="mt-6 space-y-4">
      {(status === "czeka_na_potwierdzenie" || status === "blad" || status === "") && (
        <>
          <button type="button" disabled={pracuje} onClick={() => wyslij("wyslij")} className={przycisk}>
            {pracuje ? t("potw.wysylam") : t("potw.potwierdzam")}
          </button>
          <p className="text-xs leading-relaxed text-slate-500">{t("potw.zgoda")}</p>
        </>
      )}
      {status === "w_kolejce" && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">{t("potw.kolejka")}</p>
      )}
      {status === "wyslany" && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-100">
          <p className="font-medium">{t("potw.wyslano")}</p>
          {wyslano && <p className="mt-0.5">{new Date(wyslano).toLocaleString(t.locale)}</p>}
          <p className="mt-1">{t("potw.odpowiedzTrafi")}</p>
        </div>
      )}
      {status === "wyslany" && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
          <p className="font-medium text-slate-900">{t("potw.pytanie", { odbiorca: odbiorca || t("potw.adresat") })}</p>
          {rodzaj && <p className="mt-1 text-slate-600">{t("potw.dziekiZaOdpowiedz")}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {(["merytoryczna", "szablonowa", "brak"] as const).map((r) => (
              <button
                key={r}
                type="button"
                disabled={pracuje}
                onClick={() => wyslij("odpowiedz", r)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors duration-150 ${
                  rodzaj === r ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {t(`potw.rodzaj.${r}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {blad && <p className="text-sm text-red-700">{blad}</p>}
      {linkAkcji && (status === "wyslany" || status === "w_kolejce") && (
        <a href={linkAkcji} className="block text-sm text-slate-500 underline-offset-4 hover:underline">
          {t("potw.wrocDoAkcji")}
        </a>
      )}
    </div>
  );
}
