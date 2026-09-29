import Link from "next/link";
import { zaloguj, zalozKonto } from "./actions";

const KOMUNIKATY: Record<string, string> = {
  logowanie: "Zły e-mail albo hasło.",
  rejestracja: "Nie udało się założyć konta. Hasło musi mieć co najmniej 6 znaków.",
  potwierdz:
    "Sprawdź skrzynkę i kliknij link potwierdzający. Potem daj znać Janowi, żeby dodał cię do zespołu.",
};

const pole =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

export default async function Logowanie({
  searchParams,
}: {
  searchParams: Promise<{ blad?: string; info?: string; tryb?: string }>;
}) {
  const { blad, info, tryb } = await searchParams;
  const komunikat = KOMUNIKATY[blad ?? info ?? ""];
  const rejestracja = tryb === "rejestracja" || blad === "rejestracja";

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">
        {rejestracja ? "Załóż konto" : "Zaloguj się"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">Dostęp ma tylko zespół Target Force.</p>

      <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        <Link
          href="/login"
          className={`rounded-md px-3 py-2 text-center transition ${
            rejestracja ? "text-slate-500 hover:text-slate-900" : "bg-white text-slate-900 shadow-sm"
          }`}
        >
          Logowanie
        </Link>
        <Link
          href="/login?tryb=rejestracja"
          className={`rounded-md px-3 py-2 text-center transition ${
            rejestracja ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Nowe konto
        </Link>
      </div>

      {komunikat && (
        <p
          className={`mt-6 rounded-lg px-4 py-3 text-sm ring-1 ${
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
        className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">E-mail</span>
          <input name="email" type="email" required autoComplete="email" className={pole} />
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
            <span className="mt-1.5 block text-xs text-slate-400">Co najmniej 6 znaków.</span>
          )}
        </label>
        <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700">
          {rejestracja ? "Załóż konto" : "Zaloguj"}
        </button>
      </form>
    </div>
  );
}
