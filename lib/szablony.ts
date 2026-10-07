import type { Kampania } from "@/lib/types";

/**
 * Szablony kampanii (samoobsługa, 07.10): zamiast pustego formularza klient dostaje szkielet celu
 * i sensowne ustawienia wysyłki. Nawiasy kwadratowe to miejsca do uzupełnienia.
 */
export const SZABLONY: {
  id: string;
  nazwa: string;
  opis: string;
  dane: Partial<Omit<Kampania, "id" | "utworzona">>;
}[] = [
  {
    id: "petycja",
    nazwa: "Petycja albo apel",
    opis: "Prośba o jeden konkretny krok w sprawie, z faktami.",
    dane: {
      cel: "Chcemy, żeby [kto: posłowie komisji X / urzędy gmin] [zrobił co: złożył interpelację, zapytał na komisji, zajął stanowisko], bo [najważniejszy fakt z materiałów]. Termin: [data albo moment w procedurze].",
      zrodla: ["sejm"],
      liczbaWariantow: 5,
      liczbaFollowupow: 2,
      odstepDni: 5,
    },
  },
  {
    id: "zaproszenie",
    nazwa: "Zaproszenie na wydarzenie",
    opis: "Pokaz filmu, debata, konferencja, spotkanie w okręgu.",
    dane: {
      cel: "Zapraszamy na [wydarzenie] [data, godzina, miejsce]. Chcemy, żeby [kto] przyszedł i [zabrał głos / spotkał się z bohaterami / zobaczył materiał]. Dla odbiorcy to okazja, żeby [co zyskuje].",
      zrodla: ["sejm"],
      liczbaWariantow: 4,
      liczbaFollowupow: 1,
      odstepDni: 4,
    },
  },
  {
    id: "stanowisko",
    nazwa: "Stanowisko w sprawie projektu",
    opis: "Przed głosowaniem, konsultacjami albo posiedzeniem komisji.",
    dane: {
      cel: "Przed [głosowanie / konsultacje / posiedzenie komisji, data] przekazujemy stanowisko w sprawie [projekt, numer druku]. Prosimy o [poprawkę / pytanie / głos przeciw lub za], bo [skutek dla mieszkańców, branży, budżetu].",
      zrodla: ["sejm"],
      liczbaWariantow: 5,
      liczbaFollowupow: 2,
      odstepDni: 3,
    },
  },
  {
    id: "interwencja",
    nazwa: "Interwencja lokalna",
    opis: "Sprawa w gminie albo powiecie: droga, szkoła, komunikacja.",
    dane: {
      cel: "W [miejsce] [co się dzieje i od kiedy]. Prosimy [urząd / posła z okręgu] o [interwencję, pytanie do instytucji, spotkanie], bo [skutek dla mieszkańców, liczby z materiałów].",
      zrodla: ["samorzady", "sejm"],
      liczbaWariantow: 4,
      liczbaFollowupow: 2,
      odstepDni: 5,
    },
  },
  {
    id: "akcja",
    nazwa: "Akcja mieszkańców ze stroną",
    opis: "Mieszkańcy piszą do swoich posłów ze strony akcji, z własnej poczty.",
    dane: {
      cel: "Chcemy, żeby mieszkańcy [skąd] napisali do swoich posłów w sprawie [sprawa], z prośbą o [jeden krok]. Najważniejszy fakt: [fakt z materiałów]. Po zapisaniu włącz stronę w sekcji „Strona akcji”.",
      zrodla: ["sejm"],
      liczbaWariantow: 3,
      liczbaFollowupow: 1,
      odstepDni: 7,
    },
  },
];
