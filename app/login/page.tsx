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
  searchParams: Promise<{ blad?: string; info?: string }>;
}) {
  const { blad, info } = await searchParams;
  const komunikat = KOMUNIKATY[blad ?? info ?? ""];

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Zaloguj się</h1>
      <p className="mt-1 text-sm text-slate-500">Dostęp ma tylko zespół Target Force.</p>

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

      <form className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
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
            autoComplete="current-password"
            className={pole}
          />
        </label>
        <button
          formAction={zaloguj}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Zaloguj
        </button>
        <button
          formAction={zalozKonto}
          className="w-full text-sm text-slate-500 transition hover:text-slate-900"
        >
          Nie mam konta, załóż
        </button>
      </form>
    </div>
  );
}
