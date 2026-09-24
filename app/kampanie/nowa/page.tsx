"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dodajKampanie } from "@/lib/store";
import { ZRODLA, pustaKampania, type ZrodloId } from "@/lib/types";

const Etykieta = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-sm font-medium text-slate-700">{children}</span>
);

const Podpowiedz = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-1 block text-sm text-slate-500">{children}</span>
);

const pole =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

export default function NowaKampania() {
  const router = useRouter();
  const [dane, setDane] = useState(pustaKampania());
  const [blad, setBlad] = useState<string | null>(null);

  function przelaczZrodlo(id: ZrodloId) {
    setDane((d) => ({
      ...d,
      zrodla: d.zrodla.includes(id) ? d.zrodla.filter((z) => z !== id) : [...d.zrodla, id],
    }));
  }

  function zapisz(e: React.FormEvent) {
    e.preventDefault();
    if (!dane.nazwa.trim()) return setBlad("Kampania potrzebuje nazwy, żeby dało się ją odróżnić.");
    if (dane.zrodla.length === 0) return setBlad("Wybierz co najmniej jedno źródło kontaktów.");
    const nowa = dodajKampanie({ ...dane, nazwa: dane.nazwa.trim() });
    router.push(`/kampanie/${nowa.id}`);
  }

  const politycy = (Object.keys(ZRODLA) as ZrodloId[]).filter((z) => ZRODLA[z].typ === "politycy");
  const b2b = (Object.keys(ZRODLA) as ZrodloId[]).filter((z) => ZRODLA[z].typ === "b2b");

  return (
    <>
      <Link href="/" className="text-sm text-slate-500 transition hover:text-slate-900">
        &larr; Kampanie
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Nowa kampania</h1>

      <form onSubmit={zapisz} className="mt-8 space-y-8">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <label>
            <Etykieta>Nazwa kampanii</Etykieta>
            <Podpowiedz>Dla ciebie, żeby odróżnić ją od innych.</Podpowiedz>
            <input
              className={pole}
              value={dane.nazwa}
              onChange={(e) => setDane({ ...dane, nazwa: e.target.value })}
              placeholder="np. Ustawa o zamówieniach, wrzesień"
            />
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <Etykieta>Do kogo piszemy</Etykieta>
          <Podpowiedz>Skąd bierzemy kontakty. Możesz połączyć kilka źródeł.</Podpowiedz>

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
              />
            ))}
          </div>

          <p className="mt-6 text-xs font-medium tracking-wide text-slate-400 uppercase">B2B</p>
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
              Zawężenie wewnątrz wybranych źródeł, np. posłowie z komisji obrony, albo dyrektorzy
              zakupów w firmach produkcyjnych.
            </Podpowiedz>
            <input
              className={pole}
              value={dane.kogoSzukamy}
              onChange={(e) => setDane({ ...dane, kogoSzukamy: e.target.value })}
              placeholder="np. posłowie zasiadający w komisji obrony narodowej"
            />
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <label className="block">
            <Etykieta>Co chcesz osiągnąć</Etykieta>
            <Podpowiedz>
              Na tej podstawie powstaną wiadomości. Im konkretniej, tym mniej generyczne będą.
            </Podpowiedz>
            <textarea
              className={`${pole} min-h-28 resize-y`}
              value={dane.cel}
              onChange={(e) => setDane({ ...dane, cel: e.target.value })}
              placeholder="np. zwrócić uwagę na skutki art. 12 projektu ustawy dla małych producentów i poprosić o spotkanie"
            />
          </label>

          <label className="block">
            <Etykieta>W czyim imieniu piszemy</Etykieta>
            <Podpowiedz>Kto jest nadawcą i dlaczego odbiorca miałby go słuchać.</Podpowiedz>
            <input
              className={pole}
              value={dane.nadawca}
              onChange={(e) => setDane({ ...dane, nadawca: e.target.value })}
              placeholder="np. Związek Pracodawców Branży X"
            />
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              checked={dane.psychografia}
              onChange={(e) => setDane({ ...dane, psychografia: e.target.checked })}
            />
            <span>
              <Etykieta>Psychografia odbiorców</Etykieta>
              <Podpowiedz>
                Przed napisaniem wiadomości zbieramy kontekst o każdym odbiorcy: ostatnie
                głosowania, wypowiedzi, obszary zainteresowania.
              </Podpowiedz>
            </span>
          </label>

          <label className="block">
            <Etykieta>Liczba wariantów wiadomości</Etykieta>
            <Podpowiedz>
              Różne tytuły i treści zamiast jednego szablonu do wszystkich. Mniejsze ryzyko
              oznaczenia jako spam.
            </Podpowiedz>
            <div className="mt-3 flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={7}
                value={dane.liczbaWariantow}
                onChange={(e) => setDane({ ...dane, liczbaWariantow: Number(e.target.value) })}
                className="w-56 accent-slate-900"
              />
              <span className="text-sm font-medium tabular-nums">{dane.liczbaWariantow}</span>
            </div>
          </label>
        </section>

        {blad && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {blad}
          </p>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Zapisz kampanię
          </button>
          <Link href="/" className="text-sm text-slate-500 transition hover:text-slate-900">
            Anuluj
          </Link>
        </div>
      </form>
    </>
  );
}

function ZrodloPole({
  id,
  zaznaczone,
  onChange,
}: {
  id: ZrodloId;
  zaznaczone: boolean;
  onChange: () => void;
}) {
  const z = ZRODLA[id];
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition ${
        zaznaczone ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
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
      </span>
    </label>
  );
}
