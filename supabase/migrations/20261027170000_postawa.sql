-- Postawa odbiorcy wobec sprawy kampanii (27.10, makiety Piotra "Słońce z rastra"): za / waha się / przeciw.
-- Zaznacza ręcznie zespół kampanii na podstawie publicznych wypowiedzi i głosowań. null = nie wiadomo.
-- Celowo bez wyliczanych "szans" przy nazwisku (decyzja Jana 27.10: odpada).
alter table public.kontakty add column if not exists postawa text
  check (postawa in ('za', 'waha_sie', 'przeciw'));
alter table public.kontakty add column if not exists postawa_zmieniona timestamptz;
