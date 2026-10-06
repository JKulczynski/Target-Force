"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  kampania,
  liczbaKontaktow,
  usunKampanie,
  zmienKampanie,
} from "@/lib/store";
import { STATUSY, ZRODLA, type Kampania } from "@/lib/types";
import { SkrzynkaKampanii } from "@/components/SkrzynkaKampanii";
import { Wiadomosci } from "@/components/Wiadomosci";
import { Wysylka } from "@/components/Wysylka";
import { Odbiorcy } from "@/components/Odbiorcy";

export default function SzczegolyKampanii() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [k, setK] = useState<Kampania | null | undefined>(undefined);
  const [zListy, setZListy] = useState<number | null>(null);
  const [odswiezOdbiorcow, setOdswiezOdbiorcow] = useState(0);
  const [postep, setPostep] = useState<{
    wariantow: number;
    zatwierdzonePierwsze: number;
    odbiorcy: number;
    wyslane: number;
  } | null>(null);
  const [testWyslany, setTestWyslany] = useState(false);

  function odswiezPostep() {
    fetch(`/api/kampanie/${id}/wysylka`)
      .then((o) => (o.ok ? o.json() : null))
      .then((d) => d && setPostep(d))
      .catch(() => {});
    Promise.resolve()
      .then(() => setTestWyslany(localStorage.getItem(`tf-test-${id}`) === "1"))
      .catch(() => {});
  }

  useEffect(() => {
    odswiezPostep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    kampania(id)
      .then((wynik) => setK(wynik ?? null))
      .catch(() => setK(null));
    liczbaKontaktow(id)
      .then(setZListy)
      .catch(() => setZListy(null));
  }, [id]);

  if (k === undefined)
    return <p className="text-sm text-slate-400">Wczytuję...</p>;
  if (k === null) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="font-medium text-slate-700">Nie ma takiej kampanii</p>
        <p className="mt-2 text-sm text-slate-500">
          Mogła zostać usunięta albo nie masz jeszcze dostępu do zespołu.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          Wróć do kampanii
        </Link>
      </div>
    );
  }

  const status = STATUSY[k.status];

  // Przewodnik "co dalej" (test Jana 02.10: gubił się na stronie kampanii). Kolejność = kolejność pracy.
  const kroki = [
    {
      nazwa: "Wiadomości wygenerowane",
      gotowe: (postep?.wariantow ?? 0) > 0,
      href: "#wiadomosci",
      podpowiedz: "wygeneruj wiadomości",
    },
    {
      nazwa: "Pierwsza wiadomość zatwierdzona",
      gotowe: (postep?.zatwierdzonePierwsze ?? 0) > 0,
      href: "#wiadomosci",
      podpowiedz: "zatwierdź co najmniej jeden wariant pierwszej wiadomości",
    },
    {
      nazwa: "Skrzynka nadawcy wybrana",
      gotowe: !!k.skrzynkaId,
      href: "#skrzynka",
      podpowiedz: "wybierz skrzynkę nadawcy",
    },
    {
      nazwa: "Lista odbiorców gotowa",
      gotowe: (postep?.odbiorcy ?? 0) > 0,
      href: "#wysylka",
      podpowiedz: "przygotuj listę odbiorców (Wysyłka, krok 1)",
    },
    {
      nazwa: "Test na własny adres",
      gotowe: testWyslany || (postep?.wyslane ?? 0) > 0,
      href: "#wysylka",
      podpowiedz: "wyślij test na swój adres (Wysyłka, krok 2)",
    },
    {
      nazwa: "Wysyłka ruszyła",
      gotowe: (postep?.wyslane ?? 0) > 0,
      href: "#wysylka",
      podpowiedz: "wyślij pierwszą partię albo włącz automat",
    },
  ];
  const nastepny = kroki.findIndex((x) => !x.gotowe);

  async function uruchom() {
    const zmieniona = await zmienKampanie(k!.id, { status: "uruchomiona" });
    if (zmieniona) setK(zmieniona);
  }

  async function usun() {
    await usunKampanie(k!.id);
    router.push("/");
  }

  return (
    <>
      <Link
        href="/"
        className="text-sm text-slate-500 transition hover:text-slate-900"
      >
        &larr; Kampanie
      </Link>

      <div className="mt-4 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{k.nazwa}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Utworzona {new Date(k.utworzona).toLocaleDateString("pl-PL")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${status.klasa}`}
        >
          {status.etykieta}
        </span>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Karta tytul="Do kogo piszemy">
          <div className="flex flex-wrap gap-1.5">
            {k.zrodla.map((z) => (
              <span
                key={z}
                className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {ZRODLA[z].nazwa}
              </span>
            ))}
          </div>
          {k.zrodla.includes("wlasna_lista") && (
            <Wiersz
              etykieta="Własna lista"
              wartosc={
                zListy === null
                  ? "..."
                  : `${zListy} ${zListy === 1 ? "osoba" : "osób"} zapisanych`
              }
            />
          )}
          <Wiersz etykieta="Zawężenie" wartosc={k.kogoSzukamy} />
        </Karta>

        <Karta tytul="O co chodzi">
          <Wiersz etykieta="Cel" wartosc={k.cel} />
          <Wiersz etykieta="Nadawca" wartosc={k.nadawca} />
          <Wiersz etykieta="Film albo strona" wartosc={k.linkFilm} />
          <Wiersz etykieta="Materiały" wartosc={k.materialy} />
        </Karta>

        <Karta tytul="Jak piszemy">
          <Wiersz
            etykieta="Psychografia"
            wartosc={
              k.psychografia ? "Tak, przed napisaniem wiadomości" : "Nie"
            }
          />
          <Wiersz
            etykieta="Wariantów wiadomości"
            wartosc={String(k.liczbaWariantow)}
          />
          <Wiersz
            etykieta="Przypomnienia bez odpowiedzi"
            wartosc={
              k.liczbaFollowupow === 0
                ? "Brak, tylko pierwsza wiadomość"
                : `${k.liczbaFollowupow}, co ${k.odstepDni} dni`
            }
          />
          <Wiersz
            etykieta="Start wysyłki"
            wartosc={
              k.start ? new Date(k.start).toLocaleDateString("pl-PL") : ""
            }
          />
        </Karta>

        <Karta tytul="Co dalej">
          {kroki.map((x, i) => (
            <Krok
              key={x.nazwa}
              nazwa={x.nazwa}
              gotowe={x.gotowe}
              nastepny={i === nastepny}
              href={x.href}
            />
          ))}
          {nastepny >= 0 ? (
            <p className="pt-1 text-xs text-slate-500">
              Następny krok:{" "}
              <a
                href={kroki[nastepny].href}
                className="font-medium text-slate-900 underline-offset-2 hover:underline"
              >
                {kroki[nastepny].podpowiedz}
              </a>
            </p>
          ) : (
            <p className="pt-1 text-xs text-emerald-700">
              Kampania ruszyła. Zaglądaj do listy odbiorców i raportu.
            </p>
          )}
        </Karta>
      </div>

      <div id="wiadomosci" className="scroll-mt-6">
        <Wiadomosci kampaniaId={k.id} onZmiana={odswiezPostep} />
      </div>

      <div id="skrzynka" className="scroll-mt-6" />
      <SkrzynkaKampanii
        skrzynkaId={k.skrzynkaId}
        onZmiana={async (skrzynkaId) => {
          const zmieniona = await zmienKampanie(k.id, { skrzynkaId });
          if (zmieniona) setK(zmieniona);
        }}
      />

      <div id="wysylka" className="scroll-mt-6" />
      <Wysylka
        kampaniaId={k.id}
        kogoSzukamy={k.kogoSzukamy}
        maSkrzynke={!!k.skrzynkaId}
        zSejmu={k.zrodla.includes("sejm")}
        zSamorzadow={k.zrodla.includes("samorzady")}
        onZmiana={() => {
          setOdswiezOdbiorcow((n) => n + 1);
          odswiezPostep();
        }}
      />

      <Odbiorcy kampaniaId={k.id} odswiez={odswiezOdbiorcow} />

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          onClick={uruchom}
          disabled={k.status === "uruchomiona"}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {k.status === "uruchomiona"
            ? "Kampania uruchomiona"
            : "Uruchom kampanię"}
        </button>
        <button
          onClick={usun}
          className="text-sm text-slate-400 transition hover:text-red-600"
        >
          Usuń kampanię
        </button>
      </div>
    </>
  );
}

function Karta({
  tytul,
  children,
}: {
  tytul: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xs font-medium tracking-wide text-slate-400 uppercase">
        {tytul}
      </h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Wiersz({ etykieta, wartosc }: { etykieta: string; wartosc: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{etykieta}</p>
      <p className="mt-0.5 text-sm text-slate-700">
        {wartosc || <span className="text-slate-300">nie podano</span>}
      </p>
    </div>
  );
}

function Krok({
  nazwa,
  gotowe = false,
  nastepny = false,
  href,
}: {
  nazwa: string;
  gotowe?: boolean;
  nastepny?: boolean;
  href?: string;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 rounded-md text-sm ${nastepny ? "font-medium" : ""}`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
          gotowe
            ? "bg-emerald-100 text-emerald-700"
            : nastepny
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-300"
        }`}
      >
        {gotowe ? "✓" : nastepny ? "→" : ""}
      </span>
      <span
        className={
          gotowe
            ? "text-slate-700"
            : nastepny
              ? "text-slate-900"
              : "text-slate-400"
        }
      >
        {nazwa}
      </span>
    </a>
  );
}
