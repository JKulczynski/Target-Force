-- Oswiadczenie zleceniodawcy (punkt 1 Piotra, 07.10): kto zleca kampanie, z czego jest finansowana,
-- i podpisane checkboxy. Nigdy nie nadpisujemy: nowe oswiadczenie = nowy wiersz. RLS: zespol czyta i dopisuje,
-- nie ma update ani delete (slad na wypadek pytan).
create table public.oswiadczenia (
  id uuid primary key default gen_random_uuid(),
  kampania_id uuid not null references public.kampanie(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  tresc jsonb not null,
  wersja_tresci int not null,
  ip text,
  user_agent text,
  utworzone timestamptz not null default now()
);
create index oswiadczenia_kampania_idx on public.oswiadczenia (kampania_id, utworzone desc);
alter table public.oswiadczenia enable row level security;
create policy "zespol: oswiadczenia odczyt" on public.oswiadczenia for select to authenticated using ((select public.czy_w_zespole()));
create policy "zespol: oswiadczenia zapis" on public.oswiadczenia for insert to authenticated with check ((select public.czy_w_zespole()) and user_id = auth.uid());

-- Nasza decyzja po oswiadczeniu. NULL = brak oswiadczenia. Wysylka (reczna i automat) wymaga 'zaakceptowana'.
alter table public.kampanie add column zgoda_zespolu text check (zgoda_zespolu in ('czeka', 'zaakceptowana', 'odrzucona'));
alter table public.kampanie add column zgoda_powod text not null default '';
comment on column public.kampanie.zgoda_zespolu is 'Weryfikacja oswiadczenia zleceniodawcy przez zespol TF: czeka / zaakceptowana / odrzucona. NULL = oswiadczenie nie zlozone.';
