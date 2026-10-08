"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  COOKIE_JEZYKA,
  COOKIE_WAZNOSC,
  DOMYSLNY_JEZYK,
  tlumacz,
  type Jezyk,
  type Tlumacz,
} from "./index";

type Kontekst = { t: Tlumacz; jezyk: Jezyk; ustawJezyk: (j: Jezyk) => void };

const JezykContext = createContext<Kontekst>({
  t: tlumacz(DOMYSLNY_JEZYK),
  jezyk: DOMYSLNY_JEZYK,
  ustawJezyk: () => {},
});

/**
 * Język startowy przychodzi z layoutu (cookie odczytane na serwerze), więc SSR i klient zgadzają się
 * od pierwszego renderu. Zmiana: cookie na rok + stan (rerender klienta) + router.refresh() (komponenty serwerowe).
 */
export function JezykProvider({ jezyk: start, children }: { jezyk: Jezyk; children: React.ReactNode }) {
  const router = useRouter();
  const [jezyk, setJezyk] = useState<Jezyk>(start);
  const ustawJezyk = useCallback(
    (j: Jezyk) => {
      document.cookie = `${COOKIE_JEZYKA}=${j}; path=/; max-age=${COOKIE_WAZNOSC}; samesite=lax`;
      setJezyk(j);
      router.refresh();
    },
    [router],
  );
  const wartosc = useMemo(() => ({ t: tlumacz(jezyk), jezyk, ustawJezyk }), [jezyk, ustawJezyk]);
  return <JezykContext.Provider value={wartosc}>{children}</JezykContext.Provider>;
}

/** Hook po stronie klienta: t(klucz, params?), t.n(klucz, liczba), t.locale do dat, jezyk, ustawJezyk. */
export function useT(): Kontekst {
  return useContext(JezykContext);
}
