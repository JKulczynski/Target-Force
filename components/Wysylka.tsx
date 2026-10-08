"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { POLE } from "@/components/ui";
import type { FiltrOdbiorcow } from "@/lib/types";
import { useT } from "@/lib/i18n/klient";
import type { Klucz } from "@/lib/i18n";

const WOJEWODZTWA = [
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
];
/** Wartości filtra zgodne z bazą (lib/dane/jst.json); etykieta: t(`jst.${typ}`). */
const TYPY_JST = [
  "Gmina wiejska",
  "Gmina miejsko-wiejska",
  "Gmina miejska",
  "Miasto na prawach powiatu",
  "Powiat",
  "Województwo",
  "dzielnica",
] as const;
type Stan = {
  odbiorcy: number;
  wyslane: number;
  bledy: number;
  doWyslania: number;
  limit: number;
  dzis: number;
  zostaloDzis: number;
  kliknieci?: number;
  doPrzypomnienia?: number;
  rozgrzewka?: boolean;
  filtr?: FiltrOdbiorcow;
  auto?: boolean;
  start?: string | null;
};
type Komisja = { kod: string; nazwa: string; czlonkow: number };

/** Który krok ostatnio coś zrobił: tam pokazujemy wynik albo błąd. */
const KomunikatKroku = createContext<{
  gdzie: number | null;
  info: string | null;
  blad: string | null;
}>({ gdzie: null, info: null, blad: null });
const NR_KROKU = { odbiorcy: 1, test: 2, partia: 3, przypomnienia: 4 } as const;

const pole = POLE;

/**
 * Wysyłka partiami (Jan, 30.09: absolutny core do 02.10). Kolejność: odbiorcy -> test na własny adres -> partie.
 * Partia mieści się w dziennym limicie skrzynki; każdy odbiorca dostaje kolejny zatwierdzony wariant.
 */
export function Wysylka({
  kampaniaId,
  kogoSzukamy,
  maSkrzynke,
  zSejmu,
  zSamorzadow = false,
  onZmiana,
}: {
  kampaniaId: string;
  kogoSzukamy: string;
  maSkrzynke: boolean;
  zSejmu: boolean;
  zSamorzadow?: boolean;
  onZmiana?: () => void;
}) {
  const { t } = useT();
  const [stan, setStan] = useState<Stan | null>(null);
  const [testDo, setTestDo] = useState("");
  const [ile, setIle] = useState(10);
  const [pracuje, setPracuje] = useState<
    null | "odbiorcy" | "test" | "partia" | "przypomnienia"
  >(null);
  const [info, setInfo] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [gdzie, setGdzie] = useState<number | null>(null);
  const [komisje, setKomisje] = useState<Komisja[]>([]);
  const [kluby, setKluby] = useState<string[]>([]);
  const [wybraneKomisje, setWybraneKomisje] = useState<string[]>([]);
  const [wybraneKluby, setWybraneKluby] = useState<string[]>([]);
  const [wybraneWoj, setWybraneWoj] = useState<string[]>([]);
  const [wybraneTypy, setWybraneTypy] = useState<string[]>([]);
  const [startAuto, setStartAuto] = useState("");
  const [zapisujeAuto, setZapisujeAuto] = useState(false);

  async function wczytaj() {
    const odp = await fetch(`/api/kampanie/${kampaniaId}/wysylka`);
    if (odp.ok) setStan(await odp.json());
  }

  useEffect(() => {
    fetch(`/api/kampanie/${kampaniaId}/wysylka`)
      .then((odp) => (odp.ok ? odp.json() : null))
      .then((dane) => {
        if (!dane) return;
        setStan(dane);
        setWybraneKomisje(dane.filtr?.komisje ?? []);
        setWybraneKluby(dane.filtr?.kluby ?? []);
        setWybraneWoj(dane.filtr?.wojewodztwa ?? []);
        setWybraneTypy(dane.filtr?.typy ?? []);
        setStartAuto(dane.start ?? "");
      })
      .catch(() => {});
  }, [kampaniaId]);

  useEffect(() => {
    if (!zSejmu) return;
    fetch("/api/komisje-sejmu")
      .then((odp) => (odp.ok ? odp.json() : null))
      .then((dane) => {
        if (!dane) return;
        setKomisje(dane.komisje);
        setKluby(dane.kluby);
      })
      .catch(() => {});
  }, [zSejmu]);

  const przelacz = (lista: string[], ustaw: (l: string[]) => void, x: string) =>
    ustaw(lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);

  async function wyslij(
    tryb: "odbiorcy" | "test" | "partia" | "przypomnienia",
  ) {
    setPracuje(tryb);
    setGdzie(NR_KROKU[tryb]);
    setBlad(null);
    setInfo(null);
    try {
      const odp = await fetch(`/api/kampanie/${kampaniaId}/wysylka`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tryb,
          do: testDo,
          ile,
          filtr: {
            komisje: wybraneKomisje,
            kluby: wybraneKluby,
            wojewodztwa: wybraneWoj,
            typy: wybraneTypy,
          },
        }),
      });
      const dane = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(dane.blad ?? t("wysylka.cosNieTak"));
      if (tryb === "odbiorcy")
        setInfo(t("wysylka.listaGotowa", { n: dane.odbiorcy, dodane: dane.dodane }));
      if (tryb === "test") {
        try {
          localStorage.setItem(`tf-test-${kampaniaId}`, "1");
        } catch {}
      }
      if (tryb === "test")
        setInfo(t.n("wysylka.testWyslany", dane.wyslane, { do: dane.do }));
      if (tryb === "partia" || tryb === "przypomnienia")
        setInfo(
          t("wysylka.wyslano", { n: dane.wyslanoTeraz }) +
            (dane.bledyTeraz?.length ? t("wysylka.bledy", { bledy: dane.bledyTeraz.join(" ") }) : ""),
        );
      await wczytaj();
      onZmiana?.();
    } catch {
      setBlad(t("wysylka.brakPolaczenia"));
    } finally {
      setPracuje(null);
    }
  }

  async function ustawAuto(wlacz: boolean) {
    setZapisujeAuto(true);
    setGdzie(5);
    setBlad(null);
    setInfo(null);
    try {
      const odp = await fetch(`/api/kampanie/${kampaniaId}/wysylka`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tryb: "auto", wlacz, start: startAuto || null }),
      });
      const dane = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(dane.blad ?? t("wysylka.cosNieTak"));
      setStan((st) =>
        st ? { ...st, auto: dane.auto, start: dane.start } : st,
      );
      setInfo(wlacz ? t("wysylka.autoWlaczony") : t("wysylka.autoWylaczony"));
    } catch {
      setBlad(t("wysylka.brakPolaczenia"));
    } finally {
      setZapisujeAuto(false);
    }
  }

  const maxPartia = stan ? Math.min(25, stan.zostaloDzis, stan.doWyslania) : 0;

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">
        {t("wysylka.tytul")}
      </h2>

      {!maSkrzynke && (
        <p className="mt-4 text-sm text-amber-700">{t("wysylka.najpierwSkrzynka")}</p>
      )}

      {stan && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <Liczba etykieta={t("wysylka.l.odbiorcy")} wartosc={stan.odbiorcy} />
          <Liczba etykieta={t("wysylka.l.wyslane")} wartosc={stan.wyslane} />
          <Liczba etykieta={t("wysylka.l.doWyslania")} wartosc={stan.doWyslania} />
          <Liczba
            etykieta={
              stan.rozgrzewka ? t("wysylka.l.dzisRozgrzewanie") : t("wysylka.l.dzisZeSkrzynki")
            }
            wartosc={`${stan.dzis} / ${stan.limit}`}
          />
          {stan.wyslane > 0 && (
            <Liczba
              etykieta={t("wysylka.l.klikneloWLink")}
              wartosc={`${stan.kliknieci ?? 0} (${Math.round(((stan.kliknieci ?? 0) / stan.wyslane) * 100)}%)`}
            />
          )}
        </div>
      )}
      {stan && stan.bledy > 0 && (
        <p className="mt-2 text-xs text-red-600">{t("wysylka.nieudane", { n: stan.bledy })}</p>
      )}

      <KomunikatKroku.Provider value={{ gdzie, info, blad }}>
        <div className="mt-6 space-y-6">
          <Krok nr={1} tytul={t("wysylka.k1.tytul")} opis={t("wysylka.k1.opis")}>
            {zSejmu && (
              <div className="mb-4 space-y-3">
                {kogoSzukamy && (
                  <p className="text-xs text-slate-500">
                    {t("wysylka.zawezenie", { kogo: kogoSzukamy })}
                  </p>
                )}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-600">
                    {t("wysylka.komisje")}{" "}
                    {wybraneKomisje.length === 0 && (
                      <span className="font-normal text-slate-400">
                        {t("wysylka.komisje.wszyscy")}
                      </span>
                    )}
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {komisje.length === 0 && (
                      <p className="p-1 text-xs text-slate-400">{t("wysylka.wczytujeKomisje")}</p>
                    )}
                    {komisje.map((k) => (
                      <label
                        key={k.kod}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={wybraneKomisje.includes(k.kod)}
                          onChange={() =>
                            przelacz(wybraneKomisje, setWybraneKomisje, k.kod)
                          }
                        />
                        <span className="flex-1">{k.nazwa}</span>
                        <span className="text-xs text-slate-400">
                          {k.czlonkow}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {kluby.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-slate-600">
                      {t("wysylka.kluby")}{" "}
                      {wybraneKluby.length === 0 && (
                        <span className="font-normal text-slate-400">
                          {t("wysylka.kluby.wszystkie")}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {kluby.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            przelacz(wybraneKluby, setWybraneKluby, c)
                          }
                          className={`rounded-full px-3 py-1 text-xs ring-1 transition ${wybraneKluby.includes(c) ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300 hover:ring-slate-900"}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {zSamorzadow && (
              <div className="mb-4 space-y-3">
                {[
                  {
                    tytul: t("wysylka.wojewodztwa"),
                    lista: WOJEWODZTWA as readonly string[],
                    etykieta: (x: string) => x,
                    wybrane: wybraneWoj,
                    ustaw: setWybraneWoj,
                  },
                  {
                    tytul: t("wysylka.rodzajSamorzadu"),
                    lista: TYPY_JST as readonly string[],
                    etykieta: (x: string) => t(`jst.${x}` as Klucz),
                    wybrane: wybraneTypy,
                    ustaw: setWybraneTypy,
                  },
                ].map((g) => (
                  <div key={g.tytul}>
                    <p className="mb-1.5 text-xs font-medium text-slate-600">
                      {g.tytul}{" "}
                      {g.wybrane.length === 0 && (
                        <span className="font-normal text-slate-400">
                          {t("wysylka.nicNieWybrane", { pusto: t("wysylka.wszystkie") })}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.lista.map((x) => (
                        <button
                          key={x}
                          type="button"
                          onClick={() => przelacz(g.wybrane, g.ustaw, x)}
                          className={`rounded-full px-3 py-1 text-xs ring-1 transition ${g.wybrane.includes(x) ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300 hover:ring-slate-900"}`}
                        >
                          {g.etykieta(x)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => wyslij("odbiorcy")}
              disabled={!!pracuje}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 disabled:opacity-50"
            >
              {pracuje === "odbiorcy" ? t("wysylka.pobieram") : t("wysylka.przygotujListe")}
            </button>
          </Krok>

          <Krok nr={2} tytul={t("wysylka.k2.tytul")} opis={t("wysylka.k2.opis")}>
            <div className="flex flex-wrap gap-3">
              <input
                className={`${pole} max-w-xs`}
                placeholder={t("wysylka.test.ph")}
                value={testDo}
                onChange={(e) => setTestDo(e.target.value)}
              />
              <button
                onClick={() => wyslij("test")}
                disabled={!!pracuje || !maSkrzynke}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 disabled:opacity-50"
              >
                {pracuje === "test" ? t("wysylka.wysylam") : t("wspolne.wyslijTest")}
              </button>
            </div>
          </Krok>

          <Krok nr={3} tytul={t("wysylka.k3.tytul")} opis={t("wysylka.k3.opis")}>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min={1}
                max={Math.max(maxPartia, 1)}
                className={`${pole} w-24`}
                value={ile}
                onChange={(e) => setIle(Number(e.target.value))}
              />
              <button
                onClick={() => {
                  const n = Math.min(ile, Math.max(maxPartia, 1));
                  if (window.confirm(t.n("wysylka.potwierdzPartie", n))) wyslij("partia");
                }}
                disabled={!!pracuje || !maSkrzynke || maxPartia < 1}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
              >
                {pracuje === "partia"
                  ? t("wysylka.wysylam")
                  : t("wysylka.wyslijN", { n: Math.min(ile, Math.max(maxPartia, 1)) })}
              </button>
            </div>
            {stan && stan.zostaloDzis === 0 && stan.limit > 0 && (
              <p className="mt-2 text-xs text-slate-500">{t("wysylka.limitWyczerpany")}</p>
            )}
          </Krok>

          <Krok nr={4} tytul={t("wysylka.k4.tytul")} opis={t("wysylka.k4.opis")}>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  const n = stan?.doPrzypomnienia ?? 0;
                  if (window.confirm(t("wysylka.potwierdzPrzypomnienia", { n })))
                    wyslij("przypomnienia");
                }}
                disabled={!!pracuje || !maSkrzynke || !stan?.doPrzypomnienia}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 disabled:opacity-50"
              >
                {pracuje === "przypomnienia"
                  ? t("wysylka.wysylam")
                  : t("wysylka.wyslijPrzypomnienia", { n: stan?.doPrzypomnienia ?? 0 })}
              </button>
              {stan && !stan.doPrzypomnienia && (
                <span className="text-xs text-slate-400">{t("wysylka.niktNieCzeka")}</span>
              )}
            </div>
          </Krok>

          <Krok nr={5} tytul={t("wysylka.k5.tytul")} opis={t("wysylka.k5.opis")}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs text-slate-600">
                {t("wysylka.startOd")}
                <input
                  type="date"
                  className={`${pole} ml-2 inline-block w-auto py-1.5`}
                  value={startAuto}
                  onChange={(e) => setStartAuto(e.target.value)}
                />
              </label>
              {stan?.auto ? (
                <button
                  onClick={() => ustawAuto(false)}
                  disabled={zapisujeAuto}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 disabled:opacity-50"
                >
                  {zapisujeAuto ? t("wysylka.zapisuje") : t("wysylka.wylaczAutomat")}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (window.confirm(t("wysylka.potwierdzAutomat", { n: stan?.doWyslania ?? 0 })))
                      ustawAuto(true);
                  }}
                  disabled={zapisujeAuto || !maSkrzynke}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
                >
                  {zapisujeAuto ? t("wysylka.zapisuje") : t("wysylka.wlaczAutomat")}
                </button>
              )}
              {stan?.auto && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  {t("wysylka.dziala")}
                  {stan.start
                    ? t("wysylka.dzialaOd", { data: new Date(stan.start).toLocaleDateString(t.locale) })
                    : ""}
                </span>
              )}
            </div>
          </Krok>
        </div>
      </KomunikatKroku.Provider>
    </section>
  );
}

function Liczba({
  etykieta,
  wartosc,
}: {
  etykieta: string;
  wartosc: number | string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-400">{etykieta}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{wartosc}</p>
    </div>
  );
}

function Krok({
  nr,
  tytul,
  opis,
  children,
}: {
  nr: number;
  tytul: string;
  opis: string;
  children: React.ReactNode;
}) {
  const k = useContext(KomunikatKroku);
  return (
    <div>
      <p className="text-sm font-medium text-slate-800">
        {nr}. {tytul}
      </p>
      <p className="mt-0.5 mb-3 text-xs text-slate-500">{opis}</p>
      {children}
      {/* Komunikat pod krokiem, który go wywołał (test 02.10: komunikat na dole sekcji był poza ekranem). */}
      {k.gdzie === nr && k.info && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
          {k.info}
        </p>
      )}
      {k.gdzie === nr && k.blad && (
        <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {k.blad}
        </p>
      )}
    </div>
  );
}
