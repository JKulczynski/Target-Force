-- Legal etap 1 (12.10): kto i kiedy podjal decyzje o oswiadczeniu zleceniodawcy (slad do pakietu zgodnosci).
-- Kolumny nullable, main sprzed tej migracji ich nie czyta.
alter table public.kampanie add column zgoda_kto uuid references auth.users(id);
alter table public.kampanie add column zgoda_kiedy timestamptz;
comment on column public.kampanie.zgoda_kto is 'Czlonek zespolu, ktory podjal decyzje zgoda_zespolu.';
comment on column public.kampanie.zgoda_kiedy is 'Kiedy podjeto decyzje zgoda_zespolu.';
