"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  blad: string | null;
  kliknal: boolean;
  odpowiedzial: string | null;
  wypisany: boolean;
};

type Widok = "wszyscy" | "wyslane" | "kliknieci" | "odpisali";

/**
 * Lista odbiorców ze statusem. "Odpisał" zaznacza nadawca ręcznie, bo odpowiedzi trafiają do jego skrzynki.
 * To pierwsza część dowodu efektu z wizji (30.09): kto dostał, kto kliknął, kto odpowiedział.
 */
export function Odbiorcy({
  kampaniaId,
  odswiez,
}: {
  kampaniaId: string;
  odswiez: number;
}) {
  const { t } = useT();
  const [lista, setLista] = useState<Odbiorca[] | null>(null);
  const [widok, setWidok] = useState<Widok>("wszyscy");
  const [szukaj, setSzukaj] = useState("");
  const [sprawdza, setSprawdza] = useState(false);
  const [infoOdpowiedzi, setInfoOdpowiedzi] = useState<string | null>(null);

  /** IMAP skrzynki kampanii: kto odpisał na nasze maile (In-Reply-To), bez ręcznego klikania. */
  async function sprawdzOdpowiedzi() {
    setSprawdza(true);
    setInfoOdpowiedzi(null);
    try {
      const odp = await fetch(`/api/kampanie/${kampaniaId}/odpowiedzi`, { method: "POST" });
      const d = await odp.json().catch(() => ({}));
      if (!odp.ok) return setInfoOdpowiedzi(d.blad ?? t("odbiorcy.bladSkrzynki"));
      setInfoOdpowiedzi(
        d.nowe?.length
          ? t("odbiorcy.noweOdpowiedzi", { n: d.nowe.length, m: d.sprawdzono })
          : t("odbiorcy.bezNowych", { m: d.sprawdzono }),
      );
      const odsw = await fetch(`/api/kampanie/${kampaniaId}/odbiorcy`);
      if (odsw.ok) setLista((await odsw.json()).odbiorcy);
    } catch {
      setInfoOdpowiedzi(t("odbiorcy.bladSkrzynki"));
    } finally {
      setSprawdza(false);
    }
  }

  useEffect(() => {
    fetch(`/api/kampanie/${kampaniaId}/odbiorcy`)
      .then((odp) => (odp.ok ? odp.json() : null))
      .then((dane) => dane && setLista(dane.odbiorcy))
      .catch(() => {});
  }, [kampaniaId, odswiez]);

  async function przelaczOdpisal(o: Odbiorca) {
    const odpisal = !o.odpowiedzial;
    setLista(
      (l) =>
        l?.map((x) =>
          x.id === o.id
            ? { ...x, odpowiedzial: odpisal ? new Date().toISOString() : null }
            : x,
        ) ?? null,
    );
    await fetch(`/api/kampanie/${kampaniaId}/odbiorcy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kontaktId: o.id, odpisal }),
    }).catch(() => {});
  }

  if (!lista || lista.length === 0) return null;

  const licz = {
    wszyscy: lista.length,
    wyslane: lista.filter((o) => o.wyslanychKrokow > 0).length,
    kliknieci: lista.filter((o) => o.kliknal).length,
    odpisali: lista.filter((o) => o.odpowiedzial).length,
  };
  const fraza = szukaj.trim().toLowerCase();
  const widoczni = lista
    .filter((o) =>
      widok === "wyslane"
        ? o.wyslanychKrokow > 0
        : widok === "kliknieci"
          ? o.kliknal
          : widok === "odpisali"
            ? !!o.odpowiedzial
            : true,
    )
    .filter(
      (o) =>
        !fraza ||
        [o.imie, o.nazwisko, o.email, o.klub, o.okreg].some((v) =>
          v?.toLowerCase().includes(fraza),
        ),
    );

  const zakladki: Widok[] = ["wszyscy", "wyslane", "kliknieci", "odpisali"];

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">
          {t("odbiorcy.tytul")}
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={sprawdzOdpowiedzi}
            disabled={sprawdza}
            className="text-sm text-slate-500 underline-offset-2 transition hover:text-slate-900 hover:underline disabled:opacity-50"
          >
            {sprawdza ? t("odbiorcy.sprawdzam") : t("odbiorcy.sprawdzOdpowiedzi")}
          </button>
          <Link
            href={`/kampanie/${kampaniaId}/raport`}
            className="text-sm text-slate-500 underline-offset-2 transition hover:text-slate-900 hover:underline"
          >
            {t("odbiorcy.raportDlaKlienta")}
          </Link>
          <input
            className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-900"
            placeholder={t("odbiorcy.szukaj")}
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {zakladki.map((z) => (
          <button
            key={z}
            onClick={() => setWidok(z)}
            className={`rounded-full px-3 py-1 text-xs ring-1 transition ${widok === z ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300 hover:ring-slate-900"}`}
          >
            {t(`odbiorcy.zakladka.${z}`)} {licz[z]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">{t("odbiorcy.info")}</p>
      {infoOdpowiedzi && (
        <p className="mt-2 text-sm text-slate-700">{infoOdpowiedzi}</p>
      )}

      <div className="mt-4 max-h-[28rem] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white text-xs text-slate-400">
            <tr>
              <th className="py-2 pr-3 font-medium">{t("odbiorcy.kol.osoba")}</th>
              <th className="py-2 pr-3 font-medium">{t("odbiorcy.kol.klubOkreg")}</th>
              <th className="py-2 pr-3 font-medium">{t("odbiorcy.kol.wyslane")}</th>
              <th className="py-2 pr-3 font-medium">{t("odbiorcy.kol.kliknal")}</th>
              <th className="py-2 font-medium">{t("odbiorcy.kol.odpisal")}</th>
            </tr>
          </thead>
          <tbody>
            {widoczni.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="py-2 pr-3">
                  <p className="text-slate-800">
                    {[o.imie, o.nazwisko].filter(Boolean).join(" ") || o.email}
                  </p>
                  <p className="text-xs text-slate-400">{o.email}</p>
                </td>
                <td className="py-2 pr-3 text-xs text-slate-500">
                  {[o.klub, o.okreg].filter(Boolean).join(" · ")}
                </td>
                <td className="py-2 pr-3 text-xs">
                  {o.blad ? (
                    <span className="text-red-600" title={o.blad}>
                      {t("odbiorcy.blad")}
                    </span>
                  ) : o.wyslanychKrokow > 0 ? (
                    <span className="text-slate-700">
                      {t.n("odbiorcy.mail", o.wyslanychKrokow)}
                      {o.ostatniaWyslana && (
                        <span className="text-slate-400">
                          {" "}
                          ·{" "}
                          {new Date(o.ostatniaWyslana).toLocaleDateString(t.locale)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-300">{t("odbiorcy.nie")}</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs">
                  {o.kliknal ? (
                    <span className="font-medium text-emerald-700">{t("odbiorcy.tak")}</span>
                  ) : (
                    <span className="text-slate-300">{t("odbiorcy.nie")}</span>
                  )}
                </td>
                <td className="py-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={!!o.odpowiedzial}
                      onChange={() => przelaczOdpisal(o)}
                      disabled={o.wyslanychKrokow === 0}
                    />
                    {o.odpowiedzial ? t("odbiorcy.tak") : ""}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {widoczni.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">{t("odbiorcy.nikogo")}</p>
        )}
      </div>
    </section>
  );
}
