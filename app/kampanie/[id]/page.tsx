"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { kampania, liczbaKontaktow, usunKampanie, zmienKampanie } from "@/lib/store";
import { STATUSY, ZRODLA, type Kampania } from "@/lib/types";
import { SkrzynkaKampanii } from "@/components/SkrzynkaKampanii";

export default function SzczegolyKampanii() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [k, setK] = useState<Kampania | null | undefined>(undefined);
  const [zListy, setZListy] = useState<number | null>(null);

  useEffect(() => {
    kampania(id)
      .then((wynik) => setK(wynik ?? null))
      .catch(() => setK(null));
    liczbaKontaktow(id)
      .then(setZListy)
      .catch(() => setZListy(null));
  }, [id]);

  if (k === undefined) return <p className="text-sm text-slate-400">Wczytuję...</p>;
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
      <Link href="/" className="text-sm text-slate-500 transition hover:text-slate-900">
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
              <span key={z} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {ZRODLA[z].nazwa}
              </span>
            ))}
          </div>
          {k.zrodla.includes("wlasna_lista") && (
            <Wiersz etykieta="Własna lista" wartosc={zListy === null ? "..." : `${zListy} ${zListy === 1 ? "osoba" : "osób"} zapisanych`} />
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
            wartosc={k.psychografia ? "Tak, przed napisaniem wiadomości" : "Nie"}
          />
          <Wiersz etykieta="Wariantów wiadomości" wartosc={String(k.liczbaWariantow)} />
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
            wartosc={k.start ? new Date(k.start).toLocaleDateString("pl-PL") : ""}
          />
        </Karta>

        <Karta tytul="Postęp">
          <Krok nazwa="Parametry kampanii" gotowe />
          <Krok nazwa="Pobranie kontaktów ze źródeł" />
          <Krok nazwa="Psychografia odbiorców" />
          <Krok nazwa="Wygenerowanie wiadomości" />
          <Krok nazwa="Wysyłka i follow-upy" />
        </Karta>
      </div>

      <SkrzynkaKampanii
        skrzynkaId={k.skrzynkaId}
        onZmiana={async (skrzynkaId) => {
          const zmieniona = await zmienKampanie(k.id, { skrzynkaId });
          if (zmieniona) setK(zmieniona);
        }}
      />

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          onClick={uruchom}
          disabled={k.status === "uruchomiona"}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {k.status === "uruchomiona" ? "Kampania uruchomiona" : "Uruchom kampanię"}
        </button>
        <button
          onClick={usun}
          className="text-sm text-slate-400 transition hover:text-red-600"
        >
          Usuń kampanię
        </button>
      </div>

      <p className="mt-8 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">
        Na tym etapie „Uruchom" tylko zmienia status. Pobieranie kontaktów, psychografia
        i wysyłka dochodzą kolejno, w tej kolejności.
      </p>
    </>
  );
}

function Karta({ tytul, children }: { tytul: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xs font-medium tracking-wide text-slate-400 uppercase">{tytul}</h2>
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

function Krok({ nazwa, gotowe = false }: { nazwa: string; gotowe?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
          gotowe ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-300"
        }`}
      >
        {gotowe ? "✓" : ""}
      </span>
      <span className={gotowe ? "text-slate-700" : "text-slate-400"}>{nazwa}</span>
    </div>
  );
}
