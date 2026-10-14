-- Odpowiedzi decydentów wg mieszkańców (14.10, wzorzec WriteToThem + abgeordnetenwatch):
-- po 14 dniach pytamy mieszkańca, czy adresat odpowiedział, i rozróżniamy odpowiedź merytoryczną,
-- szablonową i brak odpowiedzi. Pytanie idzie najwyżej raz.
alter table public.podpisy add column if not exists odpowiedz_rodzaj text
  check (odpowiedz_rodzaj in ('merytoryczna', 'szablonowa', 'brak'));
alter table public.podpisy_wysylka add column if not exists pytanie_wyslane timestamptz;
