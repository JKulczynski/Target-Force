"use client";

import { useState } from "react";
import { POLE, PRZYCISK_GLOWNY } from "@/components/ui";
import type { Kampania, Pismo } from "@/lib/types";
import { zmienKampanie } from "@/lib/store";
import { useT } from "@/lib/i18n/klient";

/** Data + 3 miesiące (ustawa o petycjach, art. 10 ust. 1: rozpatrzenie najpóźniej w 3 miesiące od złożenia). */
function plus3Miesiace(iso: string): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

/**
 * Formalne pismo do samorządów (blok C, 12.10). Petycja z ustawy z 11 lipca 2014 r. o petycjach:
 * wolno ją złożyć e-mailem (art. 4 ust. 1), musi oznaczać wnoszącego, adres, adresata i przedmiot (art. 4 ust. 2),
 * urząd publikuje ją na swojej stronie (art. 8) i rozpatruje do 3 miesięcy (art. 10 ust. 1).
 * Wniosku z KPA nie oferujemy: e-mail na ogólny adres urzędu zostaje bez rozpatrzenia (art. 63 § 1).
 */
export function PismoFormalne({ k, onZmiana }: { k: Kampania; onZmiana: (k: Kampania) => void }) {
  const { t } = useT();
  const [p, setP] = useState<Pismo>(k.pismo);
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisano, setZapisano] = useState(false);
  const petycja = p.rodzaj === "petycja";

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    if (petycja && (!p.wnoszacy?.trim() || !p.adres?.trim())) return setBlad(t("pismo.brakDanych"));
    setBlad(null);
    setZapisuje(true);
    try {
      const pismo: Pismo = petycja ? { rodzaj: "petycja", wnoszacy: p.wnoszacy?.trim(), adres: p.adres?.trim(), email: p.email?.trim() } : {};
      // Petycja: przypomnienia nie mają sensu przed upływem 3 miesięcy na odpowiedź.
      const zmiany: Partial<Kampania> = petycja ? { pismo, liczbaFollowupow: 0 } : { pismo };
      const nowa = await zmienKampanie(k.id, zmiany);
      if (nowa) onZmiana(nowa);
      setZapisano(true);
    } catch {
      setBlad(t("wspolne.nieZapisano"));
    } finally {
      setZapisuje(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">{t("pismo.tytul")}</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("pismo.opis")}</p>

      <form onSubmit={zapisz} className="mt-4 space-y-4">
        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="radio" className="mt-1" checked={!petycja} onChange={() => { setP({}); setZapisano(false); }} />
            <span>{t("pismo.zwykla")}</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" className="mt-1" checked={petycja} onChange={() => { setP({ ...p, rodzaj: "petycja" }); setZapisano(false); }} />
            <span>
              {t("pismo.petycja")}
              <span className="block text-xs text-slate-500">{t("pismo.petycja.opis")}</span>
            </span>
          </label>
        </div>

        {petycja && (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("pismo.wnoszacy")}</span>
              <input className={`mt-1.5 ${POLE}`} value={p.wnoszacy ?? ""} onChange={(e) => setP({ ...p, wnoszacy: e.target.value })} placeholder={k.nadawca} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("pismo.adres")}</span>
              <input className={`mt-1.5 ${POLE}`} value={p.adres ?? ""} onChange={(e) => setP({ ...p, adres: e.target.value })} placeholder="ul. Przykładowa 1, 00-001 Warszawa" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t("pismo.email")}</span>
              <input className={`mt-1.5 ${POLE}`} type="email" value={p.email ?? ""} onChange={(e) => setP({ ...p, email: e.target.value })} />
            </label>
          </div>
        )}

        {petycja && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>{t("pismo.info.jawna")}</li>
            <li>
              {k.start
                ? t("pismo.info.terminData", { data: new Date(plus3Miesiace(k.start)).toLocaleDateString(t.locale) })
                : t("pismo.info.termin")}
            </li>
            <li>{t("pismo.info.przypomnienia")}</li>
            <li>{t("pismo.info.generuj")}</li>
          </ul>
        )}
        <p className="text-xs text-slate-500">{t("pismo.info.kpa")}</p>

        <div className="flex items-center gap-3">
          <button disabled={zapisuje} className={PRZYCISK_GLOWNY}>
            {zapisuje ? t("osw.zapisuje") : t("pismo.zapisz")}
          </button>
          {zapisano && <span className="text-sm text-emerald-700">{t("pismo.zapisano")}</span>}
        </div>
        {blad && <p className="text-sm text-red-700">{blad}</p>}
      </form>
    </section>
  );
}
