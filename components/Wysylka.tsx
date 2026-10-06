"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Filtr = { komisje?: string[]; kluby?: string[] };
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
  filtr?: Filtr;
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

const pole =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

/**
 * Wysyłka partiami (Jan, 30.09: absolutny core do 02.10). Kolejność: odbiorcy -> test na własny adres -> partie.
 * Partia mieści się w dziennym limicie skrzynki; każdy odbiorca dostaje kolejny zatwierdzony wariant.
 */
export function Wysylka({
  kampaniaId,
  kogoSzukamy,
  maSkrzynke,
  zSejmu,
  onZmiana,
}: {
  kampaniaId: string;
  kogoSzukamy: string;
  maSkrzynke: boolean;
  zSejmu: boolean;
  onZmiana?: () => void;
}) {
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
          filtr: { komisje: wybraneKomisje, kluby: wybraneKluby },
        }),
      });
      const dane = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(dane.blad ?? "Coś poszło nie tak.");
      if (tryb === "odbiorcy")
        setInfo(
          `Lista odbiorców gotowa: ${dane.odbiorcy} osób z e-mailem (nowych: ${dane.dodane}).`,
        );
      if (tryb === "test") {
        try {
          localStorage.setItem(`tf-test-${kampaniaId}`, "1");
        } catch {}
      }
      if (tryb === "test")
        setInfo(
          `Wysłano ${dane.wyslane} ${dane.wyslane === 1 ? "wiadomość testową" : "wiadomości testowe"} na ${dane.do}. Sprawdź, czy są w odebranych, a nie w spamie.`,
        );
      if (tryb === "partia" || tryb === "przypomnienia")
        setInfo(
          `Wysłano ${dane.wyslanoTeraz}.${dane.bledyTeraz?.length ? ` Błędy: ${dane.bledyTeraz.join(" ")}` : ""}`,
        );
      await wczytaj();
      onZmiana?.();
    } catch {
      setBlad("Brak połączenia z serwerem.");
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
      if (!odp.ok) return setBlad(dane.blad ?? "Coś poszło nie tak.");
      setStan((st) =>
        st ? { ...st, auto: dane.auto, start: dane.start } : st,
      );
      setInfo(
        wlacz
          ? "Automat włączony. Pierwsza partia w najbliższy dzień roboczy rano (od dnia startu)."
          : "Automat wyłączony. Wysyłasz ręcznie.",
      );
    } catch {
      setBlad("Brak połączenia z serwerem.");
    } finally {
      setZapisujeAuto(false);
    }
  }

  const maxPartia = stan ? Math.min(25, stan.zostaloDzis, stan.doWyslania) : 0;

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xs font-medium tracking-wide text-slate-400 uppercase">
        Wysyłka
      </h2>

      {!maSkrzynke && (
        <p className="mt-4 text-sm text-amber-700">
          Najpierw wybierz skrzynkę nadawcy (sekcja niżej).
        </p>
      )}

      {stan && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <Liczba etykieta="Odbiorcy z e-mailem" wartosc={stan.odbiorcy} />
          <Liczba etykieta="Wysłane" wartosc={stan.wyslane} />
          <Liczba etykieta="Do wysłania" wartosc={stan.doWyslania} />
          <Liczba
            etykieta={
              stan.rozgrzewka ? "Dziś (rozgrzewanie)" : "Dziś ze skrzynki"
            }
            wartosc={`${stan.dzis} / ${stan.limit}`}
          />
          {stan.wyslane > 0 && (
            <Liczba
              etykieta="Kliknęło w link"
              wartosc={`${stan.kliknieci ?? 0} (${Math.round(((stan.kliknieci ?? 0) / stan.wyslane) * 100)}%)`}
            />
          )}
        </div>
      )}
      {stan && stan.bledy > 0 && (
        <p className="mt-2 text-xs text-red-600">
          Nieudane wysyłki: {stan.bledy}.
        </p>
      )}

      <KomunikatKroku.Provider value={{ gdzie, info, blad }}>
        <div className="mt-6 space-y-6">
          <Krok
            nr={1}
            tytul="Lista odbiorców"
            opis="Pobiera osoby z e-mailem ze źródeł kampanii (Sejm, Tweede Kamer). Własna lista jest już w bazie. Zmiana zawężenia i ponowne kliknięcie odświeża listę (osób, które już dostały maila, nie usuwamy)."
          >
            {zSejmu && (
              <div className="mb-4 space-y-3">
                {kogoSzukamy && (
                  <p className="text-xs text-slate-500">
                    Zawężenie z kreatora: „{kogoSzukamy}”. Wybierz niżej komisje
                    albo kluby, które mu odpowiadają.
                  </p>
                )}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-600">
                    Komisje Sejmu{" "}
                    {wybraneKomisje.length === 0 && (
                      <span className="font-normal text-slate-400">
                        (nic nie wybrane = wszyscy posłowie)
                      </span>
                    )}
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {komisje.length === 0 && (
                      <p className="p-1 text-xs text-slate-400">
                        Wczytuję komisje...
                      </p>
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
                      Kluby{" "}
                      {wybraneKluby.length === 0 && (
                        <span className="font-normal text-slate-400">
                          (nic nie wybrane = wszystkie)
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
            <button
              onClick={() => wyslij("odbiorcy")}
              disabled={!!pracuje}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 disabled:opacity-50"
            >
              {pracuje === "odbiorcy"
                ? "Pobieram..."
                : "Przygotuj listę odbiorców"}
            </button>
          </Krok>

          <Krok
            nr={2}
            tytul="Test na własny adres"
            opis="Wysyła każdy zatwierdzony tekst (wiadomości i przypomnienia) z dopiskiem [TEST], z przykładowymi danymi posła w polach {nazwisko} i {okreg}. Puste pole = na adres skrzynki nadawcy."
          >
            <div className="flex flex-wrap gap-3">
              <input
                className={`${pole} max-w-xs`}
                placeholder="twoj@adres.pl"
                value={testDo}
                onChange={(e) => setTestDo(e.target.value)}
              />
              <button
                onClick={() => wyslij("test")}
                disabled={!!pracuje || !maSkrzynke}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 disabled:opacity-50"
              >
                {pracuje === "test" ? "Wysyłam..." : "Wyślij test"}
              </button>
            </div>
          </Krok>

          <Krok
            nr={3}
            tytul="Wyślij partię"
            opis="Do kolejnych odbiorców, w granicach dziennego limitu skrzynki. Między mailami kilka sekund przerwy, więc 10 maili to ok. pół minuty."
          >
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
                  if (
                    window.confirm(
                      `Wyślesz ${n} ${n === 1 ? "prawdziwy mail" : "prawdziwych maili"} do odbiorców kampanii (nie test). Na pewno?`,
                    )
                  )
                    wyslij("partia");
                }}
                disabled={!!pracuje || !maSkrzynke || maxPartia < 1}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:bg-slate-300"
              >
                {pracuje === "partia"
                  ? "Wysyłam..."
                  : `Wyślij ${Math.min(ile, Math.max(maxPartia, 1))} maili`}
              </button>
            </div>
            {stan && stan.zostaloDzis === 0 && stan.limit > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Dzienny limit skrzynki wyczerpany. Kolejna partia jutro.
              </p>
            )}
          </Krok>

          <Krok
            nr={4}
            tytul="Przypomnienia"
            opis="Do osób, które nie odpisały po ustawionej w kampanii liczbie dni. Idzie w tym samym wątku (Re: temat). Zaznacz w liście odbiorców, kto odpisał."
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  const n = stan?.doPrzypomnienia ?? 0;
                  if (
                    window.confirm(
                      `Wyślesz przypomnienie do ${n} prawdziwych odbiorców. Na pewno?`,
                    )
                  )
                    wyslij("przypomnienia");
                }}
                disabled={!!pracuje || !maSkrzynke || !stan?.doPrzypomnienia}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 disabled:opacity-50"
              >
                {pracuje === "przypomnienia"
                  ? "Wysyłam..."
                  : `Wyślij przypomnienia (${stan?.doPrzypomnienia ?? 0})`}
              </button>
              {stan && !stan.doPrzypomnienia && (
                <span className="text-xs text-slate-400">
                  Na razie nikt nie czeka na przypomnienie.
                </span>
              )}
            </div>
          </Krok>

          <Krok
            nr={5}
            tytul="Wysyłka automatyczna"
            opis="Zamiast klikać: w dni robocze rano (ok. 8:30-9:30) system sam wysyła kolejną partię w dziennym limicie skrzynki i przypomnienia tym, którzy nie odpisali. Włącz dopiero po udanym teście."
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs text-slate-600">
                Start od
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
                  {zapisujeAuto ? "Zapisuję..." : "Wyłącz automat"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Automat będzie codziennie rano sam wysyłał prawdziwe maile (do ${stan?.doWyslania ?? 0} osób w kolejce, w limicie skrzynki) i przypomnienia. Włączyć?`,
                      )
                    )
                      ustawAuto(true);
                  }}
                  disabled={zapisujeAuto || !maSkrzynke}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:bg-slate-300"
                >
                  {zapisujeAuto ? "Zapisuję..." : "Włącz automat"}
                </button>
              )}
              {stan?.auto && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  Działa
                  {stan.start
                    ? ` od ${new Date(stan.start).toLocaleDateString("pl-PL")}`
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
