"use client";

import { useEffect, useState } from "react";

type Stan = { odbiorcy: number; wyslane: number; bledy: number; doWyslania: number; limit: number; dzis: number; zostaloDzis: number };

const pole =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

/**
 * Wysyłka partiami (Jan, 30.09: absolutny core do 02.10). Kolejność: odbiorcy -> test na własny adres -> partie.
 * Partia mieści się w dziennym limicie skrzynki; każdy odbiorca dostaje kolejny zatwierdzony wariant.
 */
export function Wysylka({ kampaniaId, kogoSzukamy, maSkrzynke }: { kampaniaId: string; kogoSzukamy: string; maSkrzynke: boolean }) {
  const [stan, setStan] = useState<Stan | null>(null);
  const [testDo, setTestDo] = useState("");
  const [ile, setIle] = useState(10);
  const [pracuje, setPracuje] = useState<null | "odbiorcy" | "test" | "partia">(null);
  const [info, setInfo] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  async function wczytaj() {
    const odp = await fetch(`/api/kampanie/${kampaniaId}/wysylka`);
    if (odp.ok) setStan(await odp.json());
  }

  useEffect(() => {
    fetch(`/api/kampanie/${kampaniaId}/wysylka`)
      .then((odp) => (odp.ok ? odp.json() : null))
      .then((dane) => dane && setStan(dane))
      .catch(() => {});
  }, [kampaniaId]);

  async function wyslij(tryb: "odbiorcy" | "test" | "partia") {
    setPracuje(tryb);
    setBlad(null);
    setInfo(null);
    try {
      const odp = await fetch(`/api/kampanie/${kampaniaId}/wysylka`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tryb, do: testDo, ile }),
      });
      const dane = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(dane.blad ?? "Coś poszło nie tak.");
      if (tryb === "odbiorcy") setInfo(`Lista odbiorców gotowa. Nowych osób: ${dane.dodane}.`);
      if (tryb === "test") setInfo(`Wysłano ${dane.wyslane} ${dane.wyslane === 1 ? "wiadomość testową" : "wiadomości testowe"} na ${dane.do}. Sprawdź, czy są w odebranych, a nie w spamie.`);
      if (tryb === "partia")
        setInfo(`Wysłano ${dane.wyslanoTeraz}.${dane.bledyTeraz?.length ? ` Błędy: ${dane.bledyTeraz.join(" ")}` : ""}`);
      await wczytaj();
    } catch {
      setBlad("Brak połączenia z serwerem.");
    } finally {
      setPracuje(null);
    }
  }

  const maxPartia = stan ? Math.min(25, stan.zostaloDzis, stan.doWyslania) : 0;

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xs font-medium tracking-wide text-slate-400 uppercase">Wysyłka</h2>

      {!maSkrzynke && <p className="mt-4 text-sm text-amber-700">Najpierw wybierz skrzynkę nadawcy (sekcja niżej).</p>}

      {stan && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Liczba etykieta="Odbiorcy z e-mailem" wartosc={stan.odbiorcy} />
          <Liczba etykieta="Wysłane" wartosc={stan.wyslane} />
          <Liczba etykieta="Do wysłania" wartosc={stan.doWyslania} />
          <Liczba etykieta="Dziś ze skrzynki" wartosc={`${stan.dzis} / ${stan.limit}`} />
        </div>
      )}
      {stan && stan.bledy > 0 && <p className="mt-2 text-xs text-red-600">Nieudane wysyłki: {stan.bledy}.</p>}

      <div className="mt-6 space-y-6">
        <Krok nr={1} tytul="Lista odbiorców" opis="Pobiera osoby z e-mailem ze źródeł kampanii (Sejm, Tweede Kamer). Własna lista jest już w bazie.">
          {kogoSzukamy && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
              Zawężenie „{kogoSzukamy}” nie jest jeszcze stosowane przy wysyłce: wiadomość pójdzie do wszystkich osób ze źródła. Jeśli to za szeroko, użyj własnej listy.
            </p>
          )}
          <button onClick={() => wyslij("odbiorcy")} disabled={!!pracuje} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 disabled:opacity-50">
            {pracuje === "odbiorcy" ? "Pobieram..." : "Przygotuj listę odbiorców"}
          </button>
        </Krok>

        <Krok nr={2} tytul="Test na własny adres" opis="Wysyła każdy zatwierdzony wariant z dopiskiem [TEST]. Puste pole = na adres skrzynki nadawcy.">
          <div className="flex flex-wrap gap-3">
            <input className={`${pole} max-w-xs`} placeholder="twoj@adres.pl" value={testDo} onChange={(e) => setTestDo(e.target.value)} />
            <button onClick={() => wyslij("test")} disabled={!!pracuje || !maSkrzynke} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 disabled:opacity-50">
              {pracuje === "test" ? "Wysyłam..." : "Wyślij test"}
            </button>
          </div>
        </Krok>

        <Krok nr={3} tytul="Wyślij partię" opis="Do kolejnych odbiorców, w granicach dziennego limitu skrzynki. Między mailami kilka sekund przerwy, więc 10 maili to ok. pół minuty.">
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
              onClick={() => wyslij("partia")}
              disabled={!!pracuje || !maSkrzynke || maxPartia < 1}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:bg-slate-300"
            >
              {pracuje === "partia" ? "Wysyłam..." : `Wyślij ${Math.min(ile, Math.max(maxPartia, 1))} maili`}
            </button>
          </div>
          {stan && stan.zostaloDzis === 0 && stan.limit > 0 && <p className="mt-2 text-xs text-slate-500">Dzienny limit skrzynki wyczerpany. Kolejna partia jutro.</p>}
        </Krok>
      </div>

      {info && <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">{info}</p>}
      {blad && <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{blad}</p>}
    </section>
  );
}

function Liczba({ etykieta, wartosc }: { etykieta: string; wartosc: number | string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-400">{etykieta}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{wartosc}</p>
    </div>
  );
}

function Krok({ nr, tytul, opis, children }: { nr: number; tytul: string; opis: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-800">
        {nr}. {tytul}
      </p>
      <p className="mt-0.5 mb-3 text-xs text-slate-500">{opis}</p>
      {children}
    </div>
  );
}
