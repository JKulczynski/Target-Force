"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { POLE } from "@/components/ui";

const pole = `mt-2 ${POLE}`;

/**
 * Tu trafia link z zaproszenia do zespołu i link "zapomniałem hasła".
 * Zaproszenie z panelu admina nie obsługuje PKCE, więc sesja przychodzi w hashu adresu; link odzyskiwania
 * wraca z ?code= (PKCE). Oba przejmuje klient w przeglądarce (nie serwer), potem osoba ustawia hasło.
 */
export default function UstawHaslo() {
  const router = useRouter();
  const [gotowa, setGotowa] = useState<boolean | null>(null);
  const [haslo, setHaslo] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisuje, setZapisuje] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Sesja z hasha jest zapisywana chwilę po starcie klienta, dlatego nasłuch, nie jednorazowy odczyt.
    const { data } = supabase.auth.onAuthStateChange((_zdarzenie, sesja) => {
      setGotowa(!!sesja);
    });
    const kod = new URLSearchParams(window.location.search).get("code");
    const start = kod
      ? supabase.auth.exchangeCodeForSession(kod).catch(() => null)
      : Promise.resolve(null);
    start.then(() =>
      supabase.auth.getSession().then(({ data: d }) => {
        if (d.session) setGotowa(true);
      }),
    );
    const czas = setTimeout(() => setGotowa((g) => g ?? false), 4000);
    return () => {
      data.subscription.unsubscribe();
      clearTimeout(czas);
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
      setBlad("Nie udało się zapisać hasła. Hasło musi mieć co najmniej 6 znaków.");
      setZapisuje(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Ustaw hasło</h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Ustaw hasło do Target Force, którym będziesz się
        logować.
      </p>

      {gotowa === null && (
        <p className="mt-6 text-sm text-slate-400">Sprawdzam link...</p>
      )}
      {gotowa === false && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100"
        >
          Link wygasł albo został już użyty. Poproś o nowe zaproszenie albo
          wyślij sobie nowy link przez „Nie pamiętasz hasła?” na stronie logowania.
        </p>
      )}
      {gotowa && (
        <form onSubmit={zapisz} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Nowe hasło</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={haslo}
              onChange={(e) => setHaslo(e.target.value)}
              className={pole}
            />
            <span className="mt-1.5 block text-xs text-slate-500">
              Co najmniej 6 znaków.
            </span>
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
            {zapisuje ? "Zapisuję..." : "Zapisz hasło i wejdź"}
          </button>
        </form>
      )}
    </div>
  );
}
