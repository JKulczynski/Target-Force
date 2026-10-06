import Link from "next/link";
import { zaloguj, zalozKonto } from "./actions";

const KOMUNIKATY: Record<string, string> = {
  logowanie: "Zły e-mail albo hasło.",
  rejestracja:
    "Nie udało się założyć konta. Hasło musi mieć co najmniej 6 znaków.",
  potwierdz:
    "Sprawdź skrzynkę i kliknij link potwierdzający. Potem daj znać Janowi, żeby dodał cię do zespołu.",
};

const pole =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15";

export default async function Logowanie({
  searchParams,
}: {
  searchParams: Promise<{ blad?: string; info?: string; tryb?: string }>;
}) {
  const { blad, info, tryb } = await searchParams;
  const komunikat = KOMUNIKATY[blad ?? info ?? ""];
  const rejestracja = tryb === "rejestracja" || blad === "rejestracja";

  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-[1fr_1.05fr]">
      <div className="p-8 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {rejestracja ? "Załóż konto" : "Zaloguj się"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Dostęp ma tylko zespół Target Force.
        </p>

        <div className="mt-7 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <Link
            href="/login"
            className={`rounded-md px-3 py-2 text-center transition-colors duration-150 ${
              rejestracja
                ? "text-slate-600 hover:text-slate-900"
                : "bg-white text-slate-900 shadow-sm"
            }`}
          >
            Logowanie
          </Link>
          <Link
            href="/login?tryb=rejestracja"
            className={`rounded-md px-3 py-2 text-center transition-colors duration-150 ${
              rejestracja
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Nowe konto
          </Link>
        </div>

        {komunikat && (
          <p
            role={blad ? "alert" : "status"}
            className={`mt-5 rounded-lg px-4 py-3 text-sm ring-1 ${
              blad
                ? "bg-red-50 text-red-700 ring-red-100"
                : "bg-emerald-50 text-emerald-800 ring-emerald-100"
            }`}
          >
            {komunikat}
          </p>
        )}

        <form
          action={rejestracja ? zalozKonto : zaloguj}
          className="mt-6 space-y-4"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">E-mail</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={pole}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Hasło</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={rejestracja ? "new-password" : "current-password"}
              className={pole}
            />
            {rejestracja && (
              <span className="mt-1.5 block text-xs text-slate-500">
                Co najmniej 6 znaków.
              </span>
            )}
          </label>
          <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 active:bg-brand-800">
            {rejestracja ? "Załóż konto" : "Zaloguj"}
          </button>
        </form>
      </div>

      <aside className="relative hidden bg-slate-950 p-10 text-white md:block">
        <p className="text-sm font-medium text-brand-200">
          Kampanie do decydentów
        </p>
        <p className="mt-3 max-w-sm text-2xl leading-snug font-semibold tracking-tight">
          Od celu do raportu wpływu. Każda wiadomość osobista, każda reakcja
          policzona.
        </p>
        <ol className="mt-10 space-y-4 text-sm">
          {[
            ["Opisujesz cel", "System pisze wiadomości, ty je zatwierdzasz."],
            [
              "Wybierasz odbiorców",
              "Sejm, Parlament Europejski, samorządy albo własna lista.",
            ],
            [
              "Wysyłasz partiami",
              "Z lokalnym argumentem i przypomnieniami w tym samym wątku.",
            ],
            [
              "Pokazujesz efekt",
              "Kliknięcia, odpowiedzi i raport dla klienta w PDF.",
            ],
          ].map(([t, o], i) => (
            <li key={t} className="flex gap-4">
              <span className="tabular mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/20 text-xs text-slate-300">
                {i + 1}
              </span>
              <span>
                <span className="block font-medium text-white">{t}</span>
                <span className="text-slate-400">{o}</span>
              </span>
            </li>
          ))}
        </ol>
        <span
          aria-hidden
          className="absolute right-0 bottom-0 h-1 w-full bg-brand-600"
        />
      </aside>
    </div>
  );
}
