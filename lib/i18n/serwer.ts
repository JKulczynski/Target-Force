import { cookies } from "next/headers";
import { COOKIE_JEZYKA, jezykZWartosci, tlumacz, type Jezyk, type Tlumacz } from "./index";

/** Język z cookie `tf_lang` (domyślnie pl). Do route handlerów, stron i layoutów serwerowych. */
export async function jezykZCookie(): Promise<Jezyk> {
  const sklep = await cookies();
  return jezykZWartosci(sklep.get(COOKIE_JEZYKA)?.value);
}

/** t() dla bieżącego żądania: `const t = await tSerwer();` -> `{ blad: t("api.brakDostepu") }`. */
export async function tSerwer(): Promise<Tlumacz> {
  return tlumacz(await jezykZCookie());
}
