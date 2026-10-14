"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/klient";

type Wiersz = { odbiorca_nazwa: string | null; odpowiedz_rodzaj: string | null; zglosil_odpowiedz: string | null };

/**
 * Raport (14.10): odpowiedzi adresatów według mieszkańców. Liczy wiadomości mieszkańców, które wyszły,
 * i to, co mieszkańcy zgłosili (pytanie po 14 dniach albo przycisk na stronie potwierdzenia), także per adresat.
 */
export function OdpowiedziMieszkancow({ kampaniaId }: { kampaniaId: string }) {
  const { t } = useT();
  const [wiersze, setWiersze] = useState<Wiersz[] | null>(null);

  useEffect(() => {
    createClient()
      .from("podpisy")
      .select("odbiorca_nazwa, odpowiedz_rodzaj, zglosil_odpowiedz")
      .eq("kampania_id", kampaniaId)
      .eq("status_wysylki", "wyslany")
      .limit(5000)
      .then(({ data }) => setWiersze((data as Wiersz[]) ?? []));
  }, [kampaniaId]);

  if (!wiersze?.length) return null;
  const rodzaj = (w: Wiersz) => w.odpowiedz_rodzaj ?? (w.zglosil_odpowiedz ? "merytoryczna" : null);
  const licz = (r: string | null) => wiersze.filter((w) => rodzaj(w) === r).length;
  const naAdresata = new Map<string, { wyslane: number; merytoryczne: number }>();
  for (const w of wiersze) {
    const klucz = w.odbiorca_nazwa ?? "?";
    const v = naAdresata.get(klucz) ?? { wyslane: 0, merytoryczne: 0 };
    v.wyslane++;
    if (rodzaj(w) === "merytoryczna") v.merytoryczne++;
    naAdresata.set(klucz, v);
  }
  const adresaci = [...naAdresata.entries()].sort((a, b) => b[1].wyslane - a[1].wyslane).slice(0, 15);

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 break-inside-avoid">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">{t("raport.odp.tytul")}</h2>
      <p className="mt-1 text-sm text-slate-500">{t("raport.odp.opis")}</p>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(
          [
            [t("raport.odp.merytoryczna"), licz("merytoryczna")],
            [t("raport.odp.szablonowa"), licz("szablonowa")],
            [t("raport.odp.brak"), licz("brak")],
            [t("raport.odp.nieznane"), licz(null)],
          ] as const
        ).map(([e, v]) => (
          <div key={e}>
            <p className="text-3xl font-semibold tracking-tight">{v}</p>
            <p className="mt-1 text-xs text-slate-500">{e}</p>
          </div>
        ))}
      </div>
      <table className="mt-5 w-full text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-2 font-medium">{t("raport.odp.kolAdresat")}</th>
            <th className="py-2 font-medium">{t("raport.odp.kolWyslane")}</th>
            <th className="py-2 font-medium">{t("raport.odp.kolOdpowiedzi")}</th>
          </tr>
        </thead>
        <tbody>
          {adresaci.map(([nazwa, v]) => (
            <tr key={nazwa} className="border-t border-slate-100">
              <td className="py-2 text-slate-800">{nazwa}</td>
              <td className="py-2 text-slate-600">{v.wyslane}</td>
              <td className="py-2 text-slate-600">{v.merytoryczne}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
