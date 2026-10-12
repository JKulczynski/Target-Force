"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/klient";

type Posiedzenie = { numer: number; tytul: string; od: string; do: string; trwa: boolean };
type PosiedzenieKomisji = { kod: string; data: string; godzina: string; agenda: string; zdalne: boolean };

/** Ile dni od dziś do daty (ujemne = w przeszłości). */
function zaDni(d: string) {
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000);
}

/**
 * Podpowiedź momentu wysyłki do posłów: najbliższe posiedzenia Sejmu z API.
 * Reguła: pierwsza wiadomość 5-7 dni przed posiedzeniem, żeby biuro zdążyło przygotować pytanie albo interpelację.
 */
export function MomentSejmu({
  start,
  onWybierz,
  komisje = [],
}: {
  start?: string | null;
  onWybierz?: (data: string) => void;
  /** Kody komisji z zawężenia odbiorców kampanii: pokazujemy ich najbliższe posiedzenia. */
  komisje?: string[];
}) {
  const { t } = useT();
  const [lista, setLista] = useState<Posiedzenie[] | null>(null);
  const [posKomisji, setPosKomisji] = useState<PosiedzenieKomisji[] | null>(null);
  const kodyKomisji = komisje.join(",");
  const data = (d: string) => new Date(d).toLocaleDateString(t.locale, { day: "numeric", month: "long" });

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

  useEffect(() => {
    if (!kodyKomisji) return;
    let aktualny = true;
    fetch(`/api/sejm/komisje-posiedzenia?kody=${encodeURIComponent(kodyKomisji)}`)
      .then((o) => (o.ok ? o.json() : []))
      .then((d) => aktualny && setPosKomisji(Array.isArray(d) ? d : []))
      .catch(() => aktualny && setPosKomisji([]));
    return () => {
      aktualny = false;
    };
  }, [kodyKomisji]);

  const blokKomisji = kodyKomisji && posKomisji && (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <p className="text-xs font-medium text-slate-500">{t("moment.komisje")}</p>
      {posKomisji.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">{t("moment.komisjeBrak")}</p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {posKomisji.map((p) => (
            <li key={`${p.kod}-${p.data}-${p.godzina}`} className="text-slate-800">
              <span className="font-medium">
                {p.kod} · {data(p.data)}
                {p.godzina && `, ${p.godzina}`}
              </span>
              {p.agenda && <span className="block text-xs text-slate-500">{p.agenda}</span>}
              {onWybierz && zaDni(p.data) > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(p.data);
                    d.setDate(d.getDate() - 2);
                    onWybierz(d.toISOString().slice(0, 10));
                  }}
                  className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
                >
                  {t("moment.ustawPrzedKomisja")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (!lista || lista.length === 0)
    return blokKomisji ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">{blokKomisji}</div> : null;
  const najblizsze = lista.find((p) => !p.trwa) ?? lista[0];
  const sugerowana = new Date(najblizsze.od);
  sugerowana.setDate(sugerowana.getDate() - 6);
  const sugerowanaIso = sugerowana.toISOString().slice(0, 10);
  const dni = zaDni(najblizsze.od);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
      <p className="text-xs font-medium text-slate-500">{t("moment.tytul")}</p>
      <p className="mt-1 text-slate-800">
        {najblizsze.trwa ? t("moment.trwa") : t("moment.najblizsze")}:{" "}
        <span className="font-medium">
          {data(najblizsze.od)}
          {najblizsze.do !== najblizsze.od && t("moment.doDnia", { data: data(najblizsze.do) })}
        </span>
        {!najblizsze.trwa && dni > 0 && (
          <span className="text-slate-500">{t("moment.zaDni", { n: dni })}</span>
        )}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {t("moment.opis")}
        {zaDni(sugerowanaIso) >= 0 && t("moment.czyliOkolo", { data: data(sugerowanaIso) })}.
        {lista.length > 1 && t("moment.kolejne", { lista: lista.slice(1).map((p) => data(p.od)).join(", ") })}
      </p>
      {onWybierz && zaDni(sugerowanaIso) >= 0 && start !== sugerowanaIso && (
        <button
          type="button"
          onClick={() => onWybierz(sugerowanaIso)}
          className="mt-2 text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
        >
          {t("moment.ustawStart", { data: data(sugerowanaIso) })}
        </button>
      )}
      {blokKomisji}
    </div>
  );
}
