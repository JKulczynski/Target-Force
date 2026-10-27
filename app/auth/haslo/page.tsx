"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import { PoleHasla } from "@/components/PoleHasla";
import { useT } from "@/lib/i18n/klient";


/**
 * Tu trafia link z zaproszenia do zespołu i link "zapomniałem hasła".
 * Zaproszenie z panelu admina nie obsługuje PKCE, więc sesja przychodzi w hashu adresu; link odzyskiwania
 * wraca z ?code= (PKCE). Oba przejmuje klient w przeglądarce (nie serwer), potem osoba ustawia hasło.
 */
export default function UstawHaslo() {
  const { t } = useT();
  const router = useRouter();
  const [gotowa, setGotowa] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [haslo, setHaslo] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisuje, setZapisuje] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // 27.10: osoba zalogowana na inne konto (np. podgląd) klikała link z zaproszenia i ustawiała hasło
    // NIE zaproszonemu, tylko sobie, bo stara sesja z cookie wygrywała z sesją z linku. Dlatego sesja
    // z linku (hash z zaproszenia albo ?code= z resetu) jest ustawiana jawnie i zastępuje poprzednią.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const kod = new URLSearchParams(window.location.search).get("code");
    const zLinku = accessToken && refreshToken
      ? supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data }) => data.session)
      : kod
        ? supabase.auth.exchangeCodeForSession(kod).then(({ data }) => data.session)
        : supabase.auth.getSession().then(({ data }) => data.session);
    let aktualny = true;
    zLinku
      .catch(() => null)
      .then((sesja) => {
        if (!aktualny) return;
        if (accessToken || kod) window.history.replaceState(null, "", window.location.pathname);
        setEmail(sesja?.user.email ?? null);
        setGotowa(!!sesja);
      });
    return () => {
      aktualny = false;
    };
  }, []);

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    setZapisuje(true);
    setBlad(null);
    const { error } = await createClient().auth.updateUser({
      password: haslo,
      data: { zaproszenie: false },
    });
    if (error) {
      setBlad(t("haslo.bladZapisu"));
      setZapisuje(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("haslo.tytul")}</h1>
      <p className="mt-1.5 text-sm text-slate-600">{t("haslo.opis")}</p>

      {gotowa === null && (
        <p className="mt-6 text-sm text-slate-400">{t("haslo.sprawdzamLink")}</p>
      )}
      {gotowa === false && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100"
        >
          {t("haslo.linkWygasl")}
        </p>
      )}
      {gotowa && email && (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">{t("haslo.dla", { email })}</p>
      )}
      {gotowa && (
        <form onSubmit={zapisz} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("haslo.nowe")}</span>
            <PoleHasla autoComplete="new-password" value={haslo} onChange={setHaslo} />
            <span className="mt-1.5 block text-xs text-slate-500">{t("login.min6")}</span>
          </label>
          {blad && (
            <p role="alert" className="text-sm text-red-600">
              {blad}
            </p>
          )}
          <button
            disabled={zapisuje}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700 disabled:bg-slate-300"
          >
            {zapisuje ? t("haslo.zapisuje") : t("haslo.zapisz")}
          </button>
        </form>
      )}
    </div>
  );
}
