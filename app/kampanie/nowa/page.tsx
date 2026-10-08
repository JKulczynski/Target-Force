"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parsujListe, type WynikImportu } from "@/lib/csv";
import { dodajKampanie, dodajKontakty } from "@/lib/store";
import { ZRODLA, pustaKampania, type ZrodloId } from "@/lib/types";
import { SZABLONY, daneSzablonu, type SzablonId } from "@/lib/szablony";
import { MomentSejmu } from "@/components/MomentSejmu";
import { POLE } from "@/components/ui";
import { useT } from "@/lib/i18n/klient";
import type { Klucz } from "@/lib/i18n";

type Licznik = { razem: number; zEmailem: number } | "blad" | "laduje";

type Propozycja = {
  zrodla: ZrodloId[];
  komisje: { kod: string; nazwa: string; dlaczego: string }[];
  kogoSzukamy: string;
  uzasadnienie: string;
};


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

const KROKI: Klucz[] = ["kreator.krok.1", "kreator.krok.2", "kreator.krok.3"];

const Etykieta = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-sm font-medium text-slate-700">{children}</span>
);

const Podpowiedz = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-1 block text-sm text-slate-500">{children}</span>
);

const pole = `mt-2 ${POLE}`;

export default function NowaKampania() {
  const { t } = useT();
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
  const [przedSzablonem, setPrzedSzablonem] = useState<typeof dane | null>(null);
  const [propozycja, setPropozycja] = useState<Propozycja | null>(null);
  const [proponuje, setProponuje] = useState(false);

  function uzyjSzablonu(id: SzablonId) {
    const s = daneSzablonu(id, t);
    if (!s) return;
    // Bez okna potwierdzenia (Jan 07.10: "powiadomienie z Vercela" frustruje); zamiast tego "Cofnij".
    if (!przedSzablonem) setPrzedSzablonem(dane);
    setSzablon(id);
    setDane((d) => ({ ...d, ...s }));
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
      if (!odp.ok) return setBlad(d.blad ?? t("kreator.bladPropozycji"));
      const p = d as Propozycja;
      setPropozycja(p);
      setDane((x) => ({
        ...x,
        zrodla: [...new Set([...p.zrodla, ...x.zrodla.filter((z) => z === "wlasna_lista")])],
        kogoSzukamy: p.kogoSzukamy,
        filtrOdbiorcow: { ...x.filtrOdbiorcow, komisje: p.komisje.map((k) => k.kod) },
      }));
    } catch {
      setBlad(t("kreator.bladPropozycji"));
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
      if (!dane.nazwa.trim()) return t("kreator.blad.nazwa");
      if (!dane.cel.trim()) return t("kreator.blad.cel");
    }
    if (k === 1 && dane.zrodla.length === 0) return t("kreator.blad.zrodla");
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
      setBlad(t("kreator.blad.zapis"));
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
        {t("nav.kampanie")}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{t("kreator.tytul")}</h1>

      <ol className="mt-6 flex gap-2">
        {KROKI.map((klucz, i) => (
          <li key={klucz} className="flex-1">
            <div
              className={`h-1 rounded-full transition-colors duration-300 ${i < krok ? "bg-brand-200" : i === krok ? "bg-brand-600" : "bg-slate-200"}`}
            />
            <p
              className={`mt-2 text-xs ${i === krok ? "font-medium text-slate-900" : "text-slate-500"}`}
            >
              {i + 1}. {t(klucz)}
            </p>
          </li>
        ))}
      </ol>

      <form onSubmit={zapisz} className="mt-8 space-y-8">
        {krok === 0 && (
          <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            <div>
              <Etykieta>{t("kreator.szablon.etykieta")}</Etykieta>
              <Podpowiedz>
                {t("kreator.szablon.opis")}
                {przedSzablonem && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => {
                        setDane(przedSzablonem);
                        setPrzedSzablonem(null);
                        setSzablon(null);
                      }}
                      className="font-medium text-brand-700 underline-offset-2 hover:underline"
                    >
                      {t("kreator.szablon.cofnij")}
                    </button>
                  </>
                )}
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
                      {t(`szablon.${s.id}.nazwa`)}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {t(`szablon.${s.id}.opis`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <Etykieta>{t("kreator.nazwa.etykieta")}</Etykieta>
              <Podpowiedz>{t("kreator.nazwa.opis")}</Podpowiedz>
              <input
                className={pole}
                value={dane.nazwa}
                onChange={(e) => setDane({ ...dane, nazwa: e.target.value })}
                placeholder={t("kreator.nazwa.ph")}
              />
            </label>

            <label className="block">
              <Etykieta>{t("kreator.cel.etykieta")}</Etykieta>
              <Podpowiedz>{t("kreator.cel.opis")}</Podpowiedz>
              <textarea
                className={`${pole} min-h-28 resize-y`}
                value={dane.cel}
                onChange={(e) => setDane({ ...dane, cel: e.target.value })}
                placeholder={t("kreator.cel.ph")}
              />
            </label>

            <label className="block">
              <Etykieta>{t("kreator.link.etykieta")}</Etykieta>
              <Podpowiedz>{t("kreator.link.opis")}</Podpowiedz>
              <input
                type="url"
                className={pole}
                value={dane.linkFilm}
                onChange={(e) => setDane({ ...dane, linkFilm: e.target.value })}
                placeholder="https://"
              />
            </label>

            <label className="block">
              <Etykieta>{t("kreator.materialy.etykieta")}</Etykieta>
              <Podpowiedz>{t("kreator.materialy.opis")}</Podpowiedz>
              <textarea
                className={`${pole} min-h-24 resize-y`}
                value={dane.materialy}
                onChange={(e) =>
                  setDane({ ...dane, materialy: e.target.value })
                }
              />
            </label>

            <label className="block">
              <Etykieta>{t("kreator.nadawca.etykieta")}</Etykieta>
              <Podpowiedz>{t("kreator.nadawca.opis")}</Podpowiedz>
              <input
                className={pole}
                value={dane.nadawca}
                onChange={(e) => setDane({ ...dane, nadawca: e.target.value })}
                placeholder={t("kreator.nadawca.ph")}
              />
            </label>
          </section>
        )}

        {krok === 1 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Etykieta>{t("kreator.zrodla.etykieta")}</Etykieta>
                <Podpowiedz>{t("kreator.zrodla.opis")}</Podpowiedz>
              </div>
              <button
                type="button"
                onClick={zaproponuj}
                disabled={proponuje}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-900 disabled:opacity-50"
              >
                {proponuje ? t("kreator.sprawdzam") : t("kreator.zaproponuj")}
              </button>
            </div>
            {propozycja && (
              <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-100">
                <p className="font-medium">{t("kreator.propozycja", { kogo: propozycja.kogoSzukamy })}</p>
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
                <p className="mt-2 text-xs text-brand-700">{t("kreator.propozycjaUwaga")}</p>
              </div>
            )}

            <p className="mt-5 text-base font-semibold tracking-tight text-slate-900">
              {t("kreator.decydenci")}
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
              {t("kreator.wlasnaLista")}
            </p>
            <div className="mt-2 rounded-lg border border-slate-200 p-3.5">
              <p className="text-sm text-slate-500">
                {t("kreator.wlasnaLista.opis1")}{" "}
                <span className="font-medium text-slate-700">email</span>{" "}
                {t("kreator.wlasnaLista.opis2")}
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
                placeholder={t("kreator.lista.ph")}
              />
              {lista && (
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">
                    {lista.wiersze.length}
                  </span>{" "}
                  {t.n("kreator.lista.osoba", lista.wiersze.length)}
                  {lista.pominiete > 0 && t("kreator.lista.pominieto", { n: lista.pominiete })}
                  {lista.duplikaty > 0 && t("kreator.lista.powtorzen", { n: lista.duplikaty })}.
                </p>
              )}
            </div>

            <p className="mt-6 text-base font-semibold tracking-tight text-slate-900">
              {t("kreator.b2b")}
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
              <Etykieta>{t("kreator.kogo.etykieta")}</Etykieta>
              <Podpowiedz>{t("kreator.kogo.opis")}</Podpowiedz>
              <input
                className={pole}
                value={dane.kogoSzukamy}
                onChange={(e) =>
                  setDane({ ...dane, kogoSzukamy: e.target.value })
                }
                placeholder={t("kreator.kogo.ph")}
              />
            </label>

            <p className="mt-6 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white">
              {t.n("kreator.zasieg", zasieg)}
              {dane.kogoSzukamy.trim() && t("kreator.zasieg.zawezenie")}.
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
                <Etykieta>{t("kreator.psychografia.etykieta")}</Etykieta>
                <Podpowiedz>{t("kreator.psychografia.opis")}</Podpowiedz>
              </span>
            </label>

            <Suwak
              etykieta={t("kreator.warianty.etykieta")}
              podpowiedz={t("kreator.warianty.opis")}
              min={1}
              max={7}
              wartosc={dane.liczbaWariantow}
              onChange={(v) => setDane({ ...dane, liczbaWariantow: v })}
            />

            <Suwak
              etykieta={t("kreator.przypomnienia.etykieta")}
              podpowiedz={t("kreator.przypomnienia.opis")}
              min={0}
              max={5}
              wartosc={dane.liczbaFollowupow}
              onChange={(v) => setDane({ ...dane, liczbaFollowupow: v })}
            />

            {dane.liczbaFollowupow > 0 && (
              <Suwak
                etykieta={t("kreator.odstep.etykieta")}
                min={1}
                max={14}
                wartosc={dane.odstepDni}
                onChange={(v) => setDane({ ...dane, odstepDni: v })}
              />
            )}

            <label className="block">
              <Etykieta>{t("kreator.start.etykieta")}</Etykieta>
              <Podpowiedz>{t("kreator.start.opis")}</Podpowiedz>
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
              {t.n("kreator.najwyzej", 1 + dane.liczbaFollowupow)}
              {dane.liczbaFollowupow > 0 && t("kreator.coDni", { n: dane.odstepDni })}.
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
              {t("kreator.wstecz")}
            </button>
          )}
          <button
            type="submit"
            disabled={zapisuje}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-400"
          >
            {ostatni ? (zapisuje ? t("kreator.zapisuje") : t("kreator.zapisz")) : t("kreator.dalej")}
          </button>
          <Link
            href="/"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            {t("wspolne.anuluj")}
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
  const { t } = useT();
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
        <span className="block text-sm font-medium">{t(`zrodlo.${id}.nazwa`)}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{t(`zrodlo.${id}.opis`)}</span>
        {licznik && (
          <span className="mt-1.5 block text-xs text-slate-600">
            {licznik === "laduje"
              ? t("kreator.licze")
              : licznik === "blad"
                ? t("kreator.zrodloNieOdpowiada")
                : t("kreator.licznik", { razem: licznik.razem, zEmailem: licznik.zEmailem })}
          </span>
        )}
      </span>
    </label>
  );
}
