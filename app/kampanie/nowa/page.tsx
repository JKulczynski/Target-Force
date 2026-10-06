"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parsujListe, type WynikImportu } from "@/lib/csv";
import { dodajKampanie, dodajKontakty } from "@/lib/store";
import { ZRODLA, pustaKampania, type ZrodloId } from "@/lib/types";

type Licznik = { razem: number; zEmailem: number } | "blad" | "laduje";

/** Źródła z otwartym API, dla których liczymy odbiorców na żywo. */
const Z_LICZNIKIEM: ZrodloId[] = [
  "sejm",
  "tweede_kamer",
  "parlament_ue",
  "samorzady",
];

/**
 * Kreator w 3 krokach (ustalenie z 26.09): jeden długi formularz pytał o wszystko naraz.
 * Każdy krok odpowiada na jedno pytanie: o co chodzi, do kogo, jak i kiedy.
 */

const KROKI = ["O co chodzi", "Do kogo", "Jak i kiedy"] as const;

const Etykieta = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-sm font-medium text-slate-700">{children}</span>
);

const Podpowiedz = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-1 block text-sm text-slate-500">{children}</span>
);

const pole =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15";

export default function NowaKampania() {
  const router = useRouter();
  const [krok, setKrok] = useState(0);
  const [dane, setDane] = useState(pustaKampania());
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisuje, setZapisuje] = useState(false);
  const [liczniki, setLiczniki] = useState<Partial<Record<ZrodloId, Licznik>>>(
    {},
  );
  const [lista, setLista] = useState<WynikImportu | null>(null);
  const [tekstListy, setTekstListy] = useState("");

  // Liczniki pobieramy raz, przy pierwszym wejściu w krok 2. Serwer trzyma je w cache przez dobę.
  useEffect(() => {
    if (krok !== 1) return;
    for (const id of Z_LICZNIKIEM) {
      if (liczniki[id]) continue;
      setLiczniki((l) => ({ ...l, [id]: "laduje" }));
      fetch(`/api/zrodla/${id}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { razem: number; zEmailem: number }) =>
          setLiczniki((l) => ({ ...l, [id]: d })),
        )
        .catch(() => setLiczniki((l) => ({ ...l, [id]: "blad" })));
    }
  }, [krok, liczniki]);

  function wczytajListe(tekst: string) {
    setTekstListy(tekst);
    const wynik = tekst.trim() ? parsujListe(tekst) : null;
    setLista(wynik);
    const maListe = !!wynik && wynik.wiersze.length > 0;
    setDane((d) => ({
      ...d,
      zrodla: maListe
        ? d.zrodla.includes("wlasna_lista")
          ? d.zrodla
          : [...d.zrodla, "wlasna_lista"]
        : d.zrodla.filter((z) => z !== "wlasna_lista"),
    }));
  }

  async function wczytajPlik(e: React.ChangeEvent<HTMLInputElement>) {
    const plik = e.target.files?.[0];
    if (!plik) return;
    if (/\.(xlsx|xls|ods)$/i.test(plik.name)) {
      // Excel/Arkusze: pierwszy arkusz zamieniamy na CSV i dalej jak zwykła lista.
      const XLSX = await import("xlsx");
      const skoroszyt = XLSX.read(await plik.arrayBuffer());
      const arkusz = skoroszyt.Sheets[skoroszyt.SheetNames[0]];
      wczytajListe(XLSX.utils.sheet_to_csv(arkusz, { FS: ";" }));
    } else {
      wczytajListe(await plik.text());
    }
  }

  const zasieg = dane.zrodla.reduce((suma, id) => {
    if (id === "wlasna_lista") return suma + (lista?.wiersze.length ?? 0);
    const l = liczniki[id];
    return typeof l === "object" ? suma + l.zEmailem : suma;
  }, 0);

  function przelaczZrodlo(id: ZrodloId) {
    setDane((d) => ({
      ...d,
      zrodla: d.zrodla.includes(id)
        ? d.zrodla.filter((z) => z !== id)
        : [...d.zrodla, id],
    }));
  }

  /** Zwraca komunikat błędu dla bieżącego kroku albo null, jeśli można iść dalej. */
  function sprawdz(k: number): string | null {
    if (k === 0) {
      if (!dane.nazwa.trim())
        return "Kampania potrzebuje nazwy, żeby dało się ją odróżnić.";
      if (!dane.cel.trim())
        return "Opisz w dwóch zdaniach, o co chodzi. Z tego powstaną wiadomości.";
    }
    if (k === 1 && dane.zrodla.length === 0)
      return "Wybierz co najmniej jedno źródło kontaktów.";
    return null;
  }

  function dalej() {
    const b = sprawdz(krok);
    if (b) return setBlad(b);
    setBlad(null);
    setKrok((k) => k + 1);
  }

  function wstecz() {
    setBlad(null);
    setKrok((k) => k - 1);
  }

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    if (krok < KROKI.length - 1) return dalej();
    for (let k = 0; k < KROKI.length; k++) {
      const b = sprawdz(k);
      if (b) {
        setKrok(k);
        return setBlad(b);
      }
    }
    setZapisuje(true);
    try {
      const nowa = await dodajKampanie({ ...dane, nazwa: dane.nazwa.trim() });
      if (lista && dane.zrodla.includes("wlasna_lista")) {
        await dodajKontakty(nowa.id, lista.wiersze);
      }
      router.push(`/kampanie/${nowa.id}`);
    } catch {
      setZapisuje(false);
      setBlad(
        "Nie udało się zapisać. Sprawdź, czy jesteś w zespole, albo spróbuj ponownie.",
      );
    }
  }

  const politycy = (Object.keys(ZRODLA) as ZrodloId[]).filter(
    (z) => ZRODLA[z].typ === "politycy",
  );
  const b2b = (Object.keys(ZRODLA) as ZrodloId[]).filter(
    (z) => ZRODLA[z].typ === "b2b",
  );
  const ostatni = krok === KROKI.length - 1;

  return (
    <>
      <Link
        href="/"
        className="text-sm text-slate-500 transition hover:text-slate-900"
      >
        &larr; Kampanie
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Nowa kampania
      </h1>

      <ol className="mt-6 flex gap-2">
        {KROKI.map((nazwa, i) => (
          <li key={nazwa} className="flex-1">
            <div
              className={`h-1 rounded-full ${i <= krok ? "bg-slate-900" : "bg-slate-200"}`}
            />
            <p
              className={`mt-2 text-xs ${i === krok ? "font-medium text-slate-900" : "text-slate-400"}`}
            >
              {i + 1}. {nazwa}
            </p>
          </li>
        ))}
      </ol>

      <form onSubmit={zapisz} className="mt-8 space-y-8">
        {krok === 0 && (
          <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            <label className="block">
              <Etykieta>Nazwa kampanii</Etykieta>
              <Podpowiedz>Dla ciebie, żeby odróżnić ją od innych.</Podpowiedz>
              <input
                className={pole}
                value={dane.nazwa}
                onChange={(e) => setDane({ ...dane, nazwa: e.target.value })}
                placeholder="np. Pokaz filmu, Holandia, październik"
              />
            </label>

            <label className="block">
              <Etykieta>O co chodzi, w dwóch zdaniach</Etykieta>
              <Podpowiedz>
                Co chcesz osiągnąć. Na tej podstawie powstaną wiadomości, więc
                im konkretniej, tym mniej generyczne będą.
              </Podpowiedz>
              <textarea
                className={`${pole} min-h-28 resize-y`}
                value={dane.cel}
                onChange={(e) => setDane({ ...dane, cel: e.target.value })}
                placeholder="np. zaprosić na pokaz filmu i rozmowę po seansie, 12 października w Hadze"
              />
            </label>

            <label className="block">
              <Etykieta>Link do filmu albo strony</Etykieta>
              <Podpowiedz>Opcjonalnie. Trafi do treści wiadomości.</Podpowiedz>
              <input
                type="url"
                className={pole}
                value={dane.linkFilm}
                onChange={(e) => setDane({ ...dane, linkFilm: e.target.value })}
                placeholder="https://"
              />
            </label>

            <label className="block">
              <Etykieta>Materiały</Etykieta>
              <Podpowiedz>
                Opcjonalnie. Linki do artykułów, opis, fakty, które warto
                wpleść. Czytamy je przed napisaniem wiadomości.
              </Podpowiedz>
              <textarea
                className={`${pole} min-h-24 resize-y`}
                value={dane.materialy}
                onChange={(e) =>
                  setDane({ ...dane, materialy: e.target.value })
                }
              />
            </label>

            <label className="block">
              <Etykieta>W czyim imieniu piszemy</Etykieta>
              <Podpowiedz>
                Kto jest nadawcą i dlaczego odbiorca miałby go słuchać.
              </Podpowiedz>
              <input
                className={pole}
                value={dane.nadawca}
                onChange={(e) => setDane({ ...dane, nadawca: e.target.value })}
                placeholder="np. reżyser filmu, fundacja X"
              />
            </label>
          </section>
        )}

        {krok === 1 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <Etykieta>Skąd bierzemy kontakty</Etykieta>
            <Podpowiedz>Możesz połączyć kilka źródeł.</Podpowiedz>

            <p className="mt-5 text-xs font-medium tracking-wide text-slate-400 uppercase">
              Decydenci publiczni
            </p>
            <div className="mt-2 space-y-2">
              {politycy.map((id) => (
                <ZrodloPole
                  key={id}
                  id={id}
                  zaznaczone={dane.zrodla.includes(id)}
                  onChange={() => przelaczZrodlo(id)}
                  licznik={liczniki[id]}
                />
              ))}
            </div>

            <p className="mt-6 text-xs font-medium tracking-wide text-slate-400 uppercase">
              Własna lista
            </p>
            <div className="mt-2 rounded-lg border border-slate-200 p-3.5">
              <p className="text-sm text-slate-500">
                Artyści, szefowie instytucji, dziennikarze: każdy, kogo nie ma w
                API. Wgraj plik (Excel, CSV) z kolumną{" "}
                <span className="font-medium text-slate-700">email</span>{" "}
                (opcjonalnie imię, nazwisko, organizacja, stanowisko) albo wklej
                listę, jedna osoba w linii. Możesz też skopiować komórki z
                Excela lub Arkuszy Google i wkleić.
              </p>
              <input
                type="file"
                accept=".csv,.txt,.xlsx,.xls,.ods,text/csv,text/plain"
                onChange={wczytajPlik}
                className="mt-3 block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
              />
              <textarea
                className={`${pole} min-h-24 resize-y font-mono text-xs`}
                value={tekstListy}
                onChange={(e) => wczytajListe(e.target.value)}
                placeholder={
                  "Jan Kowalski, jan.kowalski@teatr.pl\nanna.nowak@muzeum.pl"
                }
              />
              {lista && (
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">
                    {lista.wiersze.length}
                  </span>{" "}
                  {lista.wiersze.length === 1 ? "osoba" : "osób"} z poprawnym
                  e-mailem
                  {lista.pominiete > 0 &&
                    `, pominięto ${lista.pominiete} bez adresu`}
                  {lista.duplikaty > 0 && `, ${lista.duplikaty} powtórzeń`}.
                </p>
              )}
            </div>

            <p className="mt-6 text-xs font-medium tracking-wide text-slate-400 uppercase">
              B2B
            </p>
            <div className="mt-2 space-y-2">
              {b2b.map((id) => (
                <ZrodloPole
                  key={id}
                  id={id}
                  zaznaczone={dane.zrodla.includes(id)}
                  onChange={() => przelaczZrodlo(id)}
                />
              ))}
            </div>

            <label className="mt-6 block">
              <Etykieta>Kogo dokładnie szukamy</Etykieta>
              <Podpowiedz>
                Zawężenie wewnątrz wybranych źródeł, np. posłowie z komisji
                kultury, albo dyrektorzy zakupów w firmach produkcyjnych.
              </Podpowiedz>
              <input
                className={pole}
                value={dane.kogoSzukamy}
                onChange={(e) =>
                  setDane({ ...dane, kogoSzukamy: e.target.value })
                }
                placeholder="np. członkowie komisji spraw zagranicznych"
              />
            </label>

            <p className="mt-6 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white">
              Dotrzesz do{" "}
              <span className="font-semibold tabular-nums">{zasieg}</span>{" "}
              {zasieg === 1 ? "osoby" : "osób"} z adresem e-mail
              {dane.kogoSzukamy.trim() && ", przed zawężeniem grupy"}.
            </p>
          </section>
        )}

        {krok === 2 && (
          <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={dane.psychografia}
                onChange={(e) =>
                  setDane({ ...dane, psychografia: e.target.checked })
                }
              />
              <span>
                <Etykieta>Psychografia odbiorców</Etykieta>
                <Podpowiedz>
                  Przed napisaniem wiadomości zbieramy kontekst o każdym
                  odbiorcy: czym się zajmuje, co mówił publicznie, na czym mu
                  zależy.
                </Podpowiedz>
              </span>
            </label>

            <Suwak
              etykieta="Liczba wariantów wiadomości"
              podpowiedz="Różne tytuły i treści zamiast jednego szablonu do wszystkich. Mniejsze ryzyko oznaczenia jako spam."
              min={1}
              max={7}
              wartosc={dane.liczbaWariantow}
              onChange={(v) => setDane({ ...dane, liczbaWariantow: v })}
            />

            <Suwak
              etykieta="Przypomnienia bez odpowiedzi"
              podpowiedz="Ile kolejnych wiadomości wysyłamy osobom, które nie odpisały. Odpowiedź zatrzymuje kolejkę."
              min={0}
              max={5}
              wartosc={dane.liczbaFollowupow}
              onChange={(v) => setDane({ ...dane, liczbaFollowupow: v })}
            />

            {dane.liczbaFollowupow > 0 && (
              <Suwak
                etykieta="Odstęp między wiadomościami (dni)"
                min={1}
                max={14}
                wartosc={dane.odstepDni}
                onChange={(v) => setDane({ ...dane, odstepDni: v })}
              />
            )}

            <label className="block">
              <Etykieta>Start wysyłki</Etykieta>
              <Podpowiedz>Opcjonalnie. Możesz ustalić później.</Podpowiedz>
              <input
                type="date"
                className={`${pole} w-auto`}
                value={dane.start ?? ""}
                onChange={(e) =>
                  setDane({ ...dane, start: e.target.value || null })
                }
              />
            </label>

            <p className="text-sm text-slate-500">
              Każda osoba dostanie najwyżej {1 + dane.liczbaFollowupow}{" "}
              {1 + dane.liczbaFollowupow === 1 ? "wiadomość" : "wiadomości"}
              {dane.liczbaFollowupow > 0 && `, co ${dane.odstepDni} dni`}.
            </p>
          </section>
        )}

        {blad && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {blad}
          </p>
        )}

        <div className="flex items-center gap-4">
          {krok > 0 && (
            <button
              type="button"
              onClick={wstecz}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-50"
            >
              Wstecz
            </button>
          )}
          <button
            type="submit"
            disabled={zapisuje}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-400"
          >
            {ostatni ? (zapisuje ? "Zapisuję..." : "Zapisz kampanię") : "Dalej"}
          </button>
          <Link
            href="/"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            Anuluj
          </Link>
        </div>
      </form>
    </>
  );
}

function Suwak({
  etykieta,
  podpowiedz,
  min,
  max,
  wartosc,
  onChange,
}: {
  etykieta: string;
  podpowiedz?: string;
  min: number;
  max: number;
  wartosc: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <Etykieta>{etykieta}</Etykieta>
      {podpowiedz && <Podpowiedz>{podpowiedz}</Podpowiedz>}
      <div className="mt-3 flex items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          value={wartosc}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-56 accent-slate-900"
        />
        <span className="text-sm font-medium tabular-nums">{wartosc}</span>
      </div>
    </label>
  );
}

function ZrodloPole({
  id,
  zaznaczone,
  onChange,
  licznik,
}: {
  id: ZrodloId;
  zaznaczone: boolean;
  onChange: () => void;
  licznik?: Licznik;
}) {
  const z = ZRODLA[id];
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition ${
        zaznaczone
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300"
        checked={zaznaczone}
        onChange={onChange}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{z.nazwa}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{z.opis}</span>
        {licznik && (
          <span className="mt-1.5 block text-xs text-slate-600">
            {licznik === "laduje"
              ? "Liczę odbiorców..."
              : licznik === "blad"
                ? "Źródło chwilowo nie odpowiada"
                : `${licznik.razem} osób, ${licznik.zEmailem} z e-mailem`}
          </span>
        )}
      </span>
    </label>
  );
}
