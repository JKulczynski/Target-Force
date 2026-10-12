/**
 * Wygląd strony akcji (kreator, 12.10). Jeden obiekt w kampanie.akcja_wyglad; walidacja wspólna
 * dla kreatora (przed zapisem) i strony publicznej (przed wyświetleniem), więc zły wpis w bazie nie psuje strony.
 */
export const UKLADY = ["klasyczny", "obraz"] as const;
export type Uklad = (typeof UKLADY)[number];

export type WygladAkcji = {
  /** Zdjęcie na górze (https). Przy układzie "obraz" na całą szerokość nad treścią. */
  obraz?: string;
  /** Logo organizacji (https), małe, obok nazwy. */
  logo?: string;
  /** Kolor organizacji (#rrggbb): przyciski i akcenty. */
  kolor?: string;
  /** Cel liczbowy: pasek "312 z 500". */
  cel?: number;
  /** Własny tekst przycisku w formularzu. */
  przycisk?: string;
  /** Własny tekst po wysłaniu (strona podziękowania). */
  dziekujemy?: string;
  uklad?: Uklad;
};

const KOLOR = /^#[0-9a-f]{6}$/i;

function bezpiecznyUrl(u: unknown): string | undefined {
  if (typeof u !== "string" || u.length > 600) return undefined;
  try {
    const url = new URL(u);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function tekst(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim().slice(0, max);
  return s || undefined;
}

export function oczyscWyglad(w: unknown): WygladAkcji {
  const o = (w && typeof w === "object" ? w : {}) as Record<string, unknown>;
  const cel = typeof o.cel === "number" ? o.cel : Number(o.cel);
  const wynik: WygladAkcji = {
    obraz: bezpiecznyUrl(o.obraz),
    logo: bezpiecznyUrl(o.logo),
    kolor: typeof o.kolor === "string" && KOLOR.test(o.kolor) ? o.kolor.toLowerCase() : undefined,
    cel: Number.isFinite(cel) && cel >= 1 && cel <= 1_000_000 ? Math.round(cel) : undefined,
    przycisk: tekst(o.przycisk, 60),
    dziekujemy: typeof o.dziekujemy === "string" ? o.dziekujemy.trim().slice(0, 600) || undefined : undefined,
    uklad: UKLADY.includes(o.uklad as Uklad) ? (o.uklad as Uklad) : undefined,
  };
  return Object.fromEntries(Object.entries(wynik).filter(([, v]) => v !== undefined)) as WygladAkcji;
}

/** Ciemniejszy odcień do hover: każdy kanał * 0.85. */
export function ciemniej(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const k = (x: number) => Math.round(x * 0.85).toString(16).padStart(2, "0");
  return `#${k((n >> 16) & 255)}${k((n >> 8) & 255)}${k(n & 255)}`;
}

/** Zmienne CSS, które przemalowują klasy brand-* (Tailwind v4 czyta kolory z --color-*) w obrębie strony akcji. */
export function stylKoloru(kolor?: string): Record<string, string> {
  if (!kolor) return {};
  return {
    "--color-brand-600": kolor,
    "--color-brand-700": ciemniej(kolor),
    "--color-brand-800": ciemniej(ciemniej(kolor)),
  };
}
