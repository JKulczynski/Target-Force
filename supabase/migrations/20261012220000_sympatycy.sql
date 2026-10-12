-- Praca z sympatykami (plan strony akcji, czesc 4, 12.10): polecenia ("zapros znajomych"), mail do sympatykow.
alter table public.podpisy
  add column kod_polecenia text unique default substr(md5(gen_random_uuid()::text), 1, 8),
  add column polecil_id uuid references public.podpisy(id) on delete set null;
update public.podpisy set kod_polecenia = substr(md5(gen_random_uuid()::text), 1, 8) where kod_polecenia is null;
create index podpisy_polecil_idx on public.podpisy (polecil_id);

-- Historia maili do sympatykow (kto, kiedy, ile osob). Odczyt dla organizacji, zapis tylko serwer.
create table public.maile_sympatykow (
  id uuid primary key default gen_random_uuid(),
  kampania_id uuid not null references public.kampanie(id) on delete cascade,
  user_id uuid references auth.users(id),
  temat text not null,
  tresc text not null,
  odbiorcow int not null default 0,
  proba boolean not null default false,
  wyslano timestamptz not null default now()
);
create index maile_sympatykow_kampania_idx on public.maile_sympatykow (kampania_id, wyslano desc);
alter table public.maile_sympatykow enable row level security;
create policy "org: maile_sympatykow odczyt" on public.maile_sympatykow for select to authenticated
  using (public.czy_dostep_kampania(kampania_id));
