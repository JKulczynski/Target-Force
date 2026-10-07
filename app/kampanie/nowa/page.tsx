"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parsujListe, type WynikImportu } from "@/lib/csv";
import { dodajKampanie, dodajKontakty } from "@/lib/store";
import { ZRODLA, pustaKampania, type Kampania, type ZrodloId } from "@/lib/types";
import { MomentSejmu } from "@/components/MomentSejmu";
import { POLE } from "@/components/ui";

type Licznik = { razem: number; zEmailem: number } | "blad" | "laduje";

type Propozycja = {
  zrodla: ZrodloId[];
  komisje: { kod: string; nazwa: string; dlaczego: string }[];
  kogoSzukamy: string;
  uzasadnienie: string;
};

/**
 * Szablony kampanii (samoobsługa, 07.10): zamiast pustego formularza klient dostaje szkielet celu
 * i sensowne ustawienia wysyłki. Nawiasy kwadratowe to miejsca do uzupełnienia.
 */
const SZABLONY: {
  id: string;
  nazwa: string;
  opis: string;
  dane: Partial<Omit<Kampania, "id" | "utworzona">>;
}[] = [
  {
    id: "petycja",
    nazwa: "Petycja albo apel",
    opis: "Prośba o jeden konkretny krok w sprawie, z faktami.",
    dane: {
      cel: "Chcemy, żeby [kto: posłowie komisji X / urzędy gmin] [zrobił co: złożył interpelację, zapytał na komisji, zajął stanowisko], bo [najważniejszy fakt z materiałów]. Termin: [data albo moment w procedurze].",
      zrodla: ["sejm"],
      liczbaWariantow: 5,
      liczbaFollowupow: 2,
      odstepDni: 5,
    },
  },
  {
    id: "zaproszenie",
    nazwa: "Zaproszenie na wydarzenie",
    opis: "Pokaz filmu, debata, konferencja, spotkanie w okręgu.",
    dane: {
      cel: "Zapraszamy na [wydarzenie] [data, godzina, miejsce]. Chcemy, żeby [kto] przyszedł i [zabrał głos / spotkał się z bohaterami / zobaczył materiał]. Dla odbiorcy to okazja, żeby [co zyskuje].",
      zrodla: ["sejm"],
      liczbaWariantow: 4,
      liczbaFollowupow: 1,
      odstepDni: 4,
    },
  },
  {
    id: "stanowisko",
    nazwa: "Stanowisko w sprawie projektu",
    opis: "Przed głosowaniem, konsultacjami albo posiedzeniem komisji.",
    dane: {
      cel: "Przed [głosowanie / konsultacje / posiedzenie komisji, data] przekazujemy stanowisko w sprawie [projekt, numer druku]. Prosimy o [poprawkę / pytanie / głos przeciw lub za], bo [skutek dla mieszkańców, branży, budżetu].",
      zrodla: ["sejm"],
      liczbaWariantow: 5,
      liczbaFollowupow: 2,
      odstepDni: 3,
    },
  },
  {
    id: "interwencja",
    nazwa: "Interwencja lokalna",
    opis: "Sprawa w gminie albo powiecie: droga, szkoła, komunikacja.",
    dane: {
      cel: "W [miejsce] [co się dzieje i od kiedy]. Prosimy [urząd / posła z okręgu] o [interwencję, pytanie do instytucji, spotkanie], bo [skutek dla mieszkańców, liczby z materiałów].",
      zrodla: ["samorzady", "sejm"],
      liczbaWariantow: 4,
      liczbaFollowupow: 2,
      odstepDni: 5,
    },
  },
  {
    id: "akcja",
    nazwa: "Akcja mieszkańców ze stroną",
    opis: "Mieszkańcy piszą do swoich posłów ze strony akcji, z własnej poczty.",
    dane: {
      cel: "Chcemy, żeby mieszkańcy [skąd] napisali do swoich posłów w sprawie [sprawa], z prośbą o [jeden krok]. Najważniejszy fakt: [fakt z materiałów]. Po zapisaniu włącz stronę w sekcji „Strona akcji”.",
      zrodla: ["sejm"],
      liczbaWariantow: 3,
      liczbaFollowupow: 1,
      odstepDni: 7,
    },
  },
];

/** Źródła z otwartym API, dla których liczymy odbiorców na żywo. */
const Z_LICZNIKIEM: ZrodloId[] = [
  "sejm",
  "tweede_kamer",
  "parlament_ue",
  "samorzady",
  "ministerstwa",
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

const pole = `mt-2 ${POLE}`;

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
  const [szablon, setSzablon] = useState<string | null>(null);
  const [propozycja, setPropozycja] = useState<Propozycja | null>(null);
  const [proponuje, setProponuje] = useState(false);

  function uzyjSzablonu(id: string) {
    const s = SZABLONY.find((x) => x.id === id);
    if (!s) return;
    if (
      dane.cel.trim() &&
      szablon !== id &&
      !window.confirm("Szablon podmieni opis celu i ustawienia wysyłki. Kontynuować?")
    )
      return;
    setSzablon(id);
    setDane((d) => ({ ...d, ...s.dane }));
  }

  async function zaproponuj() {
    setProponuje(true);
    setBlad(null);
    try {
      const odp = await fetch("/api/kampanie/propozycja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cel: dane.cel, materialy: dane.materialy, nazwa: dane.nazwa }),
      });
      const d = await odp.json().catch(() => ({}));
      if (!odp.ok) return setBlad(d.blad ?? "Nie udało się przygotować propozycji.");
      const p = d as Propozycja;
      setPropozycja(p);
      setDane((x) => ({
        ...x,
        zrodla: [...new Set([...p.zrodla, ...x.zrodla.filter((z) => z === "wlasna_lista")])],
        kogoSzukamy: p.kogoSzukamy,
        filtrOdbiorcow: { ...x.filtrOdbiorcow, komisje: p.komisje.map((k) => k.kod) },
      }));
    } catch {
      setBlad("Nie udało się przygotować propozycji.");
    } finally {
      setProponuje(false);
    }
  }

  // Liczniki pobieramy raz, przy pierwszym wejściu w krok 2. Serwer trzyma je w cache przez dobę.
  useEffect(() => {
    if (krok !== 1) return;
    const brakujace = Z_LICZNIKIEM.filter((id) => !liczniki[id]);
    if (brakujace.length === 0) return;
    Promise.resolve().then(() =>
      setLiczniki((l) => ({
        ...l,
        ...Object.fromEntries(brakujace.map((id) => [id, "laduje"])),
      })),
    );
    for (const id of brakujace) {
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
    <div className="mx-auto max-w-3xl">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors duration-150 hover:text-slate-900"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path
            d="M10 3 5 8l5 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Kampanie
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Nowa kampania
      </h1>

      <ol className="mt-6 flex gap-2">
        {KROKI.map((nazwa, i) => (
          <li key={nazwa} className="flex-1">
            <div
              className={`h-1 rounded-full transition-colors duration-300 ${i < krok ? "bg-brand-200" : i === krok ? "bg-brand-600" : "bg-slate-200"}`}
            />
            <p
              className={`mt-2 text-xs ${i === krok ? "font-medium text-slate-900" : "text-slate-500"}`}
            >
              {i + 1}. {nazwa}
            </p>
          </li>
        ))}
      </ol>

      <form onSubmit={zapisz} className="mt-8 space-y-8">
        {krok === 0 && (
          <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            <div>
              <Etykieta>Zacznij od szablonu</Etykieta>
              <Podpowiedz>
                Opcjonalnie. Szablon wstawia szkielet celu i ustawienia wysyłki,
                wszystko możesz zmienić.
              </Podpowiedz>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SZABLONY.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => uzyjSzablonu(s.id)}
                    className={`rounded-lg border p-3 text-left transition ${szablon === s.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <span className="block text-sm font-medium text-slate-900">
                      {s.nazwa}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {s.opis}
                    </span>
                  </button>
                ))}
              </div>
            </div>

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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Etykieta>Skąd bierzemy kontakty</Etykieta>
                <Podpowiedz>Możesz połączyć kilka źródeł.</Podpowiedz>
              </div>
              <button
                type="button"
                onClick={zaproponuj}
                disabled={proponuje}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-900 disabled:opacity-50"
              >
                {proponuje ? "Sprawdzam, kto decyduje..." : "Zaproponuj na podstawie celu"}
              </button>
            </div>
            {propozycja && (
              <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-100">
                <p className="font-medium">Propozycja: {propozycja.kogoSzukamy}</p>
                <p className="mt-1 text-brand-800">{propozycja.uzasadnienie}</p>
                {propozycja.komisje.length > 0 && (
                  <ul className="mt-2 space-y-1 text-brand-800">
                    {propozycja.komisje.map((k) => (
                      <li key={k.kod}>
                        <span className="font-medium">{k.nazwa}</span>: {k.dlaczego}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-brand-700">
                  Źródła i komisje zaznaczone poniżej. Komisje trafią do zawężenia
                  listy odbiorców w kampanii. Możesz wszystko zmienić.
                </p>
              </div>
            )}

            <p className="mt-5 text-base font-semibold tracking-tight text-slate-900">
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

            <p className="mt-6 text-base font-semibold tracking-tight text-slate-900">
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

            <p className="mt-6 text-base font-semibold tracking-tight text-slate-900">
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
            {dane.zrodla.includes("sejm") && (
              <MomentSejmu
                start={dane.start}
                onWybierz={(start) => setDane({ ...dane, start })}
              />
            )}

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
    </div>
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
