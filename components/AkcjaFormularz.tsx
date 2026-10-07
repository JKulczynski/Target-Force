"use client";

import { useMemo, useRef, useState } from "react";
import { etykietaGminy, type Gmina } from "@/lib/akcja";
import { POLE } from "@/components/ui";

const pole = `mt-1.5 text-[15px] ${POLE}`;

type Wiadomosc = {
  podpisId: string;
  odbiorca: { nazwa: string; email: string; okreg: string | null };
  temat: string;
  tresc: string;
};

/** Skąd przyszedł sympatyk: UTM z adresu strony i domena odsyłacza. Do raportu „podpisy według źródła”. */
function zrodloWejscia(): Record<string, string> {
  const wynik: Record<string, string> = {};
  try {
    const p = new URLSearchParams(window.location.search);
    for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
      const v = p.get(k)?.trim().slice(0, 80);
      if (v) wynik[k] = v;
    }
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host && host !== window.location.hostname) wynik.ref = host;
    }
  } catch {
    /* brak dostępu do adresu, zostaje puste */
  }
  return wynik;
}

/** Bez polskich znaków i wielkości liter, żeby „lodz” znalazło „Łódź”. */
function prosto(s: string) {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Formularz strony akcji w trzech krokach: kto i skąd, gotowa wiadomość, podziękowanie z „udostępnij”.
 * Wiadomość wychodzi z poczty sympatyka (mailto albo Gmail w przeglądarce); my liczymy kliknięcia.
 */
export function AkcjaFormularz({
  slug,
  razem: razemStart,
  gotowa,
  administrator,
}: {
  slug: string;
  razem: number;
  gotowa: boolean;
  administrator: string;
}) {
  const [krok, setKrok] = useState<"dane" | "wiadomosc" | "dzieki">("dane");
  const [razem, setRazem] = useState(razemStart);
  const [imie, setImie] = useState("");
  const [nazwisko, setNazwisko] = useState("");
  const [email, setEmail] = useState("");
  const [dlaczego, setDlaczego] = useState("");
  const [zgodaInformacje, setZgodaInformacje] = useState(false);
  const [zgoda, setZgoda] = useState(false);
  const [www, setWww] = useState("");
  const [gminy, setGminy] = useState<Gmina[] | null>(null);
  const [szukaj, setSzukaj] = useState("");
  const [gmina, setGmina] = useState<Gmina | null>(null);
  const [listaOtwarta, setListaOtwarta] = useState(false);
  const [wysyla, setWysyla] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [w, setW] = useState<Wiadomosc | null>(null);
  const [temat, setTemat] = useState("");
  const [tresc, setTresc] = useState("");
  const [skopiowano, setSkopiowano] = useState(false);
  const [skopiowanoLink, setSkopiowanoLink] = useState(false);
  const ladowanie = useRef(false);

  function wczytajGminy() {
    if (gminy || ladowanie.current) return;
    ladowanie.current = true;
    fetch("/api/akcja/gminy")
      .then((o) => (o.ok ? o.json() : []))
      .then(setGminy)
      .catch(() => setGminy([]));
  }

  const podpowiedzi = useMemo(() => {
    if (!gminy || szukaj.trim().length < 2) return [];
    const q = prosto(szukaj.trim());
    return gminy
      .filter((g) => prosto(g.n).startsWith(q) || prosto(g.n).includes(` ${q}`))
      .sort((a, b) => a.n.localeCompare(b.n, "pl"))
      .slice(0, 8);
  }, [gminy, szukaj]);

  async function podpisz(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    if (!gmina) return setBlad("Wybierz gminę z listy.");
    if (!zgoda) return setBlad("Zaznacz zgodę na przetwarzanie danych.");
    setWysyla(true);
    try {
      const odp = await fetch(`/api/akcja/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imie,
          nazwisko,
          email,
          dlaczego,
          zrodlo: zrodloWejscia(),
          zgoda,
          zgodaInformacje,
          gminaTeryt: gmina.t,
          www,
        }),
      });
      const dane = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(dane.blad ?? "Nie udało się. Spróbuj ponownie.");
      if (!dane.podpisId) return setBlad("Nie udało się. Spróbuj ponownie.");
      setW(dane);
      setTemat(dane.temat);
      setTresc(dane.tresc);
      setRazem(dane.razem);
      setKrok("wiadomosc");
    } catch {
      setBlad("Nie udało się. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setWysyla(false);
    }
  }

  function zapiszZdarzenie(co: "otwarto" | "udostepnil") {
    if (!w) return;
    fetch(`/api/akcja/${slug}/otwarto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podpisId: w.podpisId, co }),
      keepalive: true,
    }).catch(() => {});
  }

  const mailto = w
    ? `mailto:${w.odbiorca.email}?subject=${encodeURIComponent(temat)}&body=${encodeURIComponent(tresc)}`
    : "#";
  const gmail = w
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(w.odbiorca.email)}&su=${encodeURIComponent(temat)}&body=${encodeURIComponent(tresc)}`
    : "#";

  async function kopiuj() {
    if (!w) return;
    try {
      await navigator.clipboard.writeText(
        `Do: ${w.odbiorca.email}\nTemat: ${temat}\n\n${tresc}`,
      );
      setSkopiowano(true);
      zapiszZdarzenie("otwarto");
    } catch {
      setSkopiowano(false);
    }
  }

  const linkStrony = typeof window !== "undefined" ? window.location.href : "";
  const tekstUdostepnienia = `Napisałem do swojego posła w tej sprawie. Zajmuje to dwie minuty: ${linkStrony}`;

  async function udostepnij() {
    zapiszZdarzenie("udostepnil");
    if (navigator.share) {
      try {
        await navigator.share({ url: linkStrony, text: tekstUdostepnienia });
        return;
      } catch {
        /* anulowane, pokazujemy przyciski niżej */
      }
    }
    try {
      await navigator.clipboard.writeText(linkStrony);
      setSkopiowanoLink(true);
    } catch {
      setSkopiowanoLink(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <p className="text-sm text-slate-600">
        <span className="text-2xl font-semibold tabular-nums text-slate-900">
          {razem}
        </span>{" "}
        {razem === 1 ? "osoba już napisała" : razem >= 2 && razem <= 4 ? "osoby już napisały" : "osób już napisało"}
      </p>

      {!gotowa && krok === "dane" && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
          Akcja jest jeszcze w przygotowaniu. Wróć za chwilę.
        </p>
      )}

      {krok === "dane" && (
        <form onSubmit={podpisz} className="mt-5 space-y-4" aria-busy={wysyla}>
          <h2 className="text-lg font-semibold tracking-tight">
            Napisz do swojego posła
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Imię</span>
              <input
                className={pole}
                required
                minLength={2}
                maxLength={60}
                autoComplete="given-name"
                value={imie}
                onChange={(e) => setImie(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Nazwisko
              </span>
              <input
                className={pole}
                maxLength={80}
                autoComplete="family-name"
                value={nazwisko}
                onChange={(e) => setNazwisko(e.target.value)}
              />
            </label>
          </div>

          <div className="relative">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Gmina, w której mieszkasz
              </span>
              <input
                className={pole}
                placeholder="zacznij pisać, np. Bolesławiec"
                value={gmina ? etykietaGminy(gmina) : szukaj}
                onFocus={() => {
                  wczytajGminy();
                  setListaOtwarta(true);
                }}
                onBlur={() => setTimeout(() => setListaOtwarta(false), 150)}
                onChange={(e) => {
                  setGmina(null);
                  setSzukaj(e.target.value);
                  setListaOtwarta(true);
                }}
                autoComplete="off"
                role="combobox"
                aria-expanded={listaOtwarta && podpowiedzi.length > 0}
                aria-controls="gminy-lista"
              />
            </label>
            {listaOtwarta && !gmina && szukaj.trim().length >= 2 && (
              <ul
                id="gminy-lista"
                role="listbox"
                className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                {gminy === null ? (
                  <li className="px-3.5 py-2 text-sm text-slate-400">
                    Wczytuję gminy...
                  </li>
                ) : podpowiedzi.length === 0 ? (
                  <li className="px-3.5 py-2 text-sm text-slate-400">
                    Nie znaleziono. Spróbuj innej pisowni.
                  </li>
                ) : (
                  podpowiedzi.map((g) => (
                    <li key={g.t} role="option" aria-selected={false}>
                      <button
                        type="button"
                        className="block w-full px-3.5 py-2 text-left text-sm hover:bg-slate-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setGmina(g);
                          setListaOtwarta(false);
                        }}
                      >
                        <span className="font-medium text-slate-900">{g.n}</span>{" "}
                        <span className="text-slate-500">
                          {etykietaGminy(g).replace(`${g.n} `, "")}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            <span className="mt-1.5 block text-xs text-slate-500">
              Po gminie dobieramy posła z Twojego okręgu wyborczego.
            </span>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Dlaczego to dla Ciebie ważne{" "}
              <span className="font-normal text-slate-500">(opcjonalnie, 1-2 zdania)</span>
            </span>
            <textarea
              className={`${pole} min-h-20 resize-y`}
              maxLength={400}
              value={dlaczego}
              onChange={(e) => setDlaczego(e.target.value)}
              placeholder="np. Codziennie przeprowadzam tędy dwójkę dzieci do szkoły."
            />
            <span className="mt-1.5 block text-xs text-slate-500">
              Własne zdanie trafi do wiadomości. Poseł czyta takie maile uważniej niż identyczne.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              E-mail <span className="font-normal text-slate-500">(opcjonalnie)</span>
            </span>
            <input
              className={pole}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {email.trim() && (
            <label className="flex items-start gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={zgodaInformacje}
                onChange={(e) => setZgodaInformacje(e.target.checked)}
              />
              <span>Chcę dostać wiadomość, co dała ta akcja.</span>
            </label>
          )}

          {/* Pole dla botów: ukryte dla ludzi i czytników ekranu. */}
          <div className="hidden" aria-hidden>
            <label>
              Strona www
              <input tabIndex={-1} autoComplete="off" value={www} onChange={(e) => setWww(e.target.value)} />
            </label>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              checked={zgoda}
              onChange={(e) => setZgoda(e.target.checked)}
              required
            />
            <span>
              Zgadzam się na przetwarzanie podanych danych, żeby dobrać adresata i
              przygotować dla mnie wiadomość.
            </span>
          </label>

          {blad && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
              {blad}
            </p>
          )}

          <button
            disabled={wysyla || !gotowa}
            className="w-full rounded-lg bg-brand-600 px-5 py-3 text-[15px] font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
          >
            {wysyla ? "Przygotowuję wiadomość..." : "Przygotuj moją wiadomość"}
          </button>

          <p className="text-xs leading-relaxed text-slate-500">
            Administrator danych: {administrator || "organizator akcji"}. Imię,
            nazwisko i gminę zapisujemy, żeby dobrać adresata i policzyć podpisy;
            e-mail tylko wtedy, gdy chcesz dostać informację o wynikach. Wiadomość
            wysyłasz sam ze swojej poczty. Nie wysyłamy nic w Twoim imieniu.
          </p>
        </form>
      )}

      {krok === "wiadomosc" && w && (
        <div className="mt-5 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Twoja wiadomość</h2>
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <p className="text-xs font-medium text-slate-500">Do</p>
            <p className="mt-0.5 font-medium text-slate-900">{w.odbiorca.nazwa}</p>
            <p className="text-slate-600">
              {w.odbiorca.email}
              {w.odbiorca.okreg && ` · okręg ${w.odbiorca.okreg}`}
            </p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Temat</span>
            <input className={pole} value={temat} onChange={(e) => setTemat(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Treść</span>
            <textarea
              className={`${pole} min-h-72 resize-y leading-relaxed`}
              value={tresc}
              onChange={(e) => setTresc(e.target.value)}
            />
            <span className="mt-1.5 block text-xs text-slate-500">
              Możesz zmienić, co chcesz. Własne słowa działają najlepiej.
            </span>
          </label>
          <a
            href={mailto}
            onClick={() => {
              zapiszZdarzenie("otwarto");
              setTimeout(() => setKrok("dzieki"), 800);
            }}
            className="block w-full rounded-lg bg-brand-600 px-5 py-3 text-center text-[15px] font-medium text-white transition-colors duration-150 hover:bg-brand-700"
          >
            Otwórz w poczcie i wyślij
          </a>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <a
              href={gmail}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                zapiszZdarzenie("otwarto");
                setTimeout(() => setKrok("dzieki"), 800);
              }}
              className="font-medium text-brand-700 underline-offset-4 hover:underline"
            >
              Otwórz w Gmailu
            </a>
            <button type="button" onClick={kopiuj} className="font-medium text-slate-600 underline-offset-4 hover:underline">
              {skopiowano ? "Skopiowano" : "Skopiuj treść i adres"}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Wiadomość wyjdzie z Twojej skrzynki, od Ciebie. Odpowiedź posła
            przyjdzie na Twój adres.
          </p>
        </div>
      )}

      {krok === "dzieki" && (
        <div className="mt-5 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Dziękujemy!</h2>
          <p className="text-sm text-slate-700">
            Jeśli poczta się nie otworzyła, wróć wyżej i skopiuj treść. Jeden
            mail od mieszkańca znaczy więcej niż sto od organizacji. Dwa znaczą
            jeszcze więcej.
          </p>
          <button
            type="button"
            onClick={udostepnij}
            className="w-full rounded-lg bg-slate-900 px-5 py-3 text-[15px] font-medium text-white transition-colors duration-150 hover:bg-slate-800"
          >
            {skopiowanoLink ? "Link skopiowany" : "Udostępnij znajomym"}
          </button>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a
              className="font-medium text-slate-600 underline-offset-4 hover:underline"
              href={`https://wa.me/?text=${encodeURIComponent(tekstUdostepnienia)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => zapiszZdarzenie("udostepnil")}
            >
              WhatsApp
            </a>
            <a
              className="font-medium text-slate-600 underline-offset-4 hover:underline"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(linkStrony)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => zapiszZdarzenie("udostepnil")}
            >
              Facebook
            </a>
            <a
              className="font-medium text-slate-600 underline-offset-4 hover:underline"
              href={`mailto:?subject=${encodeURIComponent("Dwie minuty dla tej sprawy")}&body=${encodeURIComponent(tekstUdostepnienia)}`}
              onClick={() => zapiszZdarzenie("udostepnil")}
            >
              E-mail
            </a>
          </div>
          <button
            type="button"
            onClick={() => setKrok("wiadomosc")}
            className="text-sm text-slate-500 underline-offset-4 hover:underline"
          >
            Wróć do wiadomości
          </button>
        </div>
      )}
    </section>
  );
}
