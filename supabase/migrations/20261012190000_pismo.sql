-- Tryb formalnego pisma do samorzadow (blok C, 12.10): {rodzaj: "petycja", wnoszacy, adres, email}.
-- Pusty obiekt = zwykla wiadomosc. Wniosek z KPA celowo nie (art. 63 par. 1: e-mail na ogolny adres urzedu zostaje bez rozpatrzenia).
alter table public.kampanie add column pismo jsonb not null default '{}'::jsonb;
comment on column public.kampanie.pismo is 'Formalne pismo do samorzadow: {rodzaj: petycja, wnoszacy, adres, email}. {} = zwykla wiadomosc.';
