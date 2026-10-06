import { ZRODLA, type ZrodloId } from "@/lib/types";

/** Stan źródła widziany przez użytkownika: czy można go użyć od razu. */
const STAN: Record<ZrodloId, { etykieta: string; klasa: string }> = {
  sejm: {
    etykieta: "Gotowe",
    klasa: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  parlament_ue: {
    etykieta: "Gotowe",
    klasa: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  tweede_kamer: {
    etykieta: "Gotowe",
    klasa: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  samorzady: {
    etykieta: "Gotowe",
    klasa: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  wlasna_lista: {
    etykieta: "Import CSV",
    klasa: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  apollo: {
    etykieta: "Wymaga klucza",
    klasa: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  clay: {
    etykieta: "Wymaga klucza",
    klasa: "bg-amber-50 text-amber-800 ring-amber-200",
  },
};

const GRUPY: { tytul: string; opis: string; typ: string }[] = [
  {
    tytul: "Decydenci publiczni",
    opis: "Oficjalne źródła z adresami e-mail. Lista odbiorców powstaje jednym kliknięciem w kampanii.",
    typ: "politycy",
  },
  {
    tytul: "Własne listy",
    opis: "Odbiorcy spoza rejestrów: media, darczyńcy, firmy, partnerzy.",
    typ: "wlasne",
  },
  {
    tytul: "Bazy B2B",
    opis: "Kontakty biznesowe z płatnych baz. Potrzebny klucz API klienta.",
    typ: "b2b",
  },
];

export default function Zrodla() {
  const lista = Object.keys(ZRODLA) as ZrodloId[];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Źródła kontaktów
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
        Skąd biorą się odbiorcy kampanii. Źródła publiczne sprawdzamy na
        bieżąco, więc w kampanii zawsze trafiasz na aktualny skład.
      </p>

      <div className="mt-8 space-y-10">
        {GRUPY.map((g) => {
          const zGrupy = lista.filter((id) => ZRODLA[id].typ === g.typ);
          if (!zGrupy.length) return null;
          return (
            <section key={g.typ}>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                {g.tytul}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{g.opis}</p>
              <ul className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {zGrupy.map((id) => {
                  const z = ZRODLA[id];
                  const stan = STAN[id];
                  return (
                    <li
                      key={id}
                      className="flex items-start justify-between gap-6 border-t border-slate-100 px-5 py-4 first:border-t-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{z.nazwa}</p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {z.opis}
                        </p>
                        {z.api && (
                          <a
                            href={z.api}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1.5 inline-block max-w-full truncate font-mono text-xs text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
                          >
                            {z.api.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${stan.klasa}`}
                      >
                        {stan.etykieta}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
