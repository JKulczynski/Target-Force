import { ZRODLA, type ZrodloId } from "@/lib/types";
import { tlumacz, type Klucz } from "@/lib/i18n";
import { jezykZCookie } from "@/lib/i18n/serwer";

/** Stan źródła widziany przez użytkownika: czy można go użyć od razu. */
const STAN: Record<ZrodloId, { etykieta: Klucz; klasa: string }> = {
  sejm: {
    etykieta: "zrodla.stan.gotowe",
    klasa: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  parlament_ue: {
    etykieta: "zrodla.stan.gotowe",
    klasa: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  tweede_kamer: {
    etykieta: "zrodla.stan.gotowe",
    klasa: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  samorzady: {
    etykieta: "zrodla.stan.gotowe",
    klasa: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  ministerstwa: {
    etykieta: "zrodla.stan.gotowe",
    klasa: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  wlasna_lista: {
    etykieta: "zrodla.stan.import",
    klasa: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  apollo: {
    etykieta: "zrodla.stan.klucz",
    klasa: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  clay: {
    etykieta: "zrodla.stan.klucz",
    klasa: "bg-amber-50 text-amber-800 ring-amber-200",
  },
};

const GRUPY = ["politycy", "wlasne", "b2b"] as const;

export default async function Zrodla() {
  const t = tlumacz(await jezykZCookie());
  const lista = Object.keys(ZRODLA) as ZrodloId[];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("zrodla.tytul")}</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{t("zrodla.opis")}</p>

      <div className="mt-8 space-y-10">
        {GRUPY.map((typ) => {
          const zGrupy = lista.filter((id) => ZRODLA[id].typ === typ);
          if (!zGrupy.length) return null;
          return (
            <section key={typ}>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                {t(`zrodla.grupa.${typ}.tytul`)}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{t(`zrodla.grupa.${typ}.opis`)}</p>
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
                        <p className="font-medium text-slate-900">{t(`zrodlo.${id}.nazwa`)}</p>
                        <p className="mt-0.5 text-sm text-slate-600">{t(`zrodlo.${id}.opis`)}</p>
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
                        {t(stan.etykieta)}
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
