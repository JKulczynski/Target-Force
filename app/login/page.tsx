import Link from "next/link";
import { przypomnijHaslo, zaloguj, zalozKonto } from "./actions";
import { POLE } from "@/components/ui";
import { tlumacz, type Klucz } from "@/lib/i18n";
import { jezykZCookie } from "@/lib/i18n/serwer";

const KOMUNIKATY: Record<string, Klucz> = {
  logowanie: "login.komunikat.logowanie",
  rejestracja: "login.komunikat.rejestracja",
  potwierdz: "login.komunikat.potwierdz",
  link: "login.komunikat.link",
  haslo: "login.komunikat.haslo",
};

const pole = `mt-2 ${POLE}`;

export default async function Logowanie({
  searchParams,
}: {
  searchParams: Promise<{ blad?: string; info?: string; tryb?: string }>;
}) {
  const t = tlumacz(await jezykZCookie());
  const { blad, info, tryb } = await searchParams;
  const kluczKomunikatu = KOMUNIKATY[blad ?? info ?? ""];
  const komunikat = kluczKomunikatu ? t(kluczKomunikatu) : null;
  const rejestracja = tryb === "rejestracja" || blad === "rejestracja";
  const odzyskiwanie = tryb === "haslo";

  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-[1fr_1.05fr]">
      <div className="p-8 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {odzyskiwanie
            ? t("login.noweHaslo")
            : rejestracja
              ? t("login.zalozKonto")
              : t("login.zalogujSie")}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          {odzyskiwanie ? t("login.wyslemyLink") : t("login.tylkoZespol")}
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
            {t("login.logowanie")}
          </Link>
          <Link
            href="/login?tryb=rejestracja"
            className={`rounded-md px-3 py-2 text-center transition-colors duration-150 ${
              rejestracja
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("login.noweKonto")}
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

        {odzyskiwanie ? (
          <form action={przypomnijHaslo} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t("login.email")}</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className={pole}
              />
            </label>
            <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 active:bg-brand-800">
              {t("login.wyslijLink")}
            </button>
            <Link
              href="/login"
              className="block text-center text-sm text-slate-500 transition hover:text-slate-900"
            >
              {t("login.wrocDoLogowania")}
            </Link>
          </form>
        ) : (
        <form
          action={rejestracja ? zalozKonto : zaloguj}
          className="mt-6 space-y-4"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("login.email")}</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={pole}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("login.haslo")}</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={rejestracja ? "new-password" : "current-password"}
              className={pole}
            />
            {rejestracja && (
              <span className="mt-1.5 block text-xs text-slate-500">{t("login.min6")}</span>
            )}
          </label>
          <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 active:bg-brand-800">
            {rejestracja ? t("login.zalozKonto") : t("login.zaloguj")}
          </button>
          {!rejestracja && (
            <Link
              href="/login?tryb=haslo"
              className="block text-center text-sm text-slate-500 transition hover:text-slate-900"
            >
              {t("login.niePamietasz")}
            </Link>
          )}
        </form>
        )}
      </div>

      <aside className="relative hidden bg-slate-950 p-10 text-white md:block">
        <p className="text-sm font-medium text-brand-200">{t("login.aside.naglowek")}</p>
        <p className="mt-3 max-w-sm text-2xl leading-snug font-semibold tracking-tight">
          {t("login.aside.haslo")}
        </p>
        <ol className="mt-10 space-y-4 text-sm">
          {([1, 2, 3, 4] as const).map((i) => (
            <li key={i} className="flex gap-4">
              <span className="tabular mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/20 text-xs text-slate-300">
                {i}
              </span>
              <span>
                <span className="block font-medium text-white">{t(`login.aside.k${i}`)}</span>
                <span className="text-slate-400">{t(`login.aside.o${i}`)}</span>
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
