"use client";

import { useState } from "react";
import { POLE } from "@/components/ui";
import { useT } from "@/lib/i18n/klient";

/**
 * Pole hasła z przyciskiem „pokaż” (27.10, uwaga Jana przy ustawianiu nowego hasła). Wspólne dla
 * logowania (formularz z akcją serwera: tylko `name`) i strony nowego hasła (sterowane `value`).
 */
export function PoleHasla({
  name,
  autoComplete,
  value,
  onChange,
}: {
  name?: string;
  autoComplete: "current-password" | "new-password";
  value?: string;
  onChange?: (v: string) => void;
}) {
  const { t } = useT();
  const [widoczne, setWidoczne] = useState(false);
  return (
    <span className="relative mt-2 block">
      <input
        name={name}
        type={widoczne ? "text" : "password"}
        required
        minLength={6}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`${POLE} pr-20`}
      />
      <button
        type="button"
        onClick={() => setWidoczne((w) => !w)}
        aria-pressed={widoczne}
        className="absolute inset-y-0 right-3 text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        {widoczne ? t("haslo.ukryj") : t("haslo.pokaz")}
      </button>
    </span>
  );
}
