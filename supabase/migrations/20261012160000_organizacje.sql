-- Organizacje (blok A pelnej wersji, 12.10): kazdy klient widzi tylko swoje dane.
-- `zespol` = administratorzy WinOver (Jan, Piotr): widza wszystko i jako jedyni akceptuja oswiadczenia
-- wymagajace sprawdzenia. Klient = czlonek organizacji. Migracja tylko dodaje; wycofanie: 20261012160000_organizacje_wycofanie.sql.

create table public.organizacje (
  id uuid primary key default gen_random_uuid(),
  nazwa text not null,
  testowa boolean not null default false,
  utworzona timestamptz not null default now()
);

create table public.czlonkowie (
  organizacja_id uuid not null references public.organizacje(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  rola text not null default 'czlonek' check (rola in ('wlasciciel', 'czlonek')),
  dodany timestamptz not null default now(),
  primary key (organizacja_id, user_id)
);
create index czlonkowie_user_idx on public.czlonkowie (user_id);

-- Funkcje dostepu (security definer, zeby polityki nie wpadaly w rekurencje RLS).
create or replace function public.czy_admin() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.zespol where user_id = (select auth.uid()));
$$;

-- Dostep do aplikacji w ogole: administrator albo czlonek dowolnej organizacji (layout, propozycja AI).
create or replace function public.czy_w_zespole() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.zespol where user_id = (select auth.uid()))
      or exists (select 1 from public.czlonkowie where user_id = (select auth.uid()));
$$;

create or replace function public.czy_dostep_org(p_org uuid) returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.zespol where user_id = (select auth.uid()))
      or exists (select 1 from public.czlonkowie where organizacja_id = p_org and user_id = (select auth.uid()));
$$;

-- Organizacja uzytkownika (pierwsza po dacie dolaczenia). Domyslna wartosc organizacja_id przy nowej kampanii i skrzynce.
create or replace function public.moja_organizacja() returns uuid
language sql stable security definer set search_path to '' as $$
  select organizacja_id from public.czlonkowie where user_id = (select auth.uid()) order by dodany limit 1;
$$;

-- Dane startowe: organizacja wewnetrzna (wszystko, co jest dzis) i testowa (konto podgladowe jako zwykly klient).
insert into public.organizacje (id, nazwa) values ('00000000-0000-0000-0000-000000000001', 'WinOver (wewnetrzna)');
insert into public.organizacje (id, nazwa, testowa) values ('00000000-0000-0000-0000-000000000002', 'Organizacja testowa', true);
insert into public.czlonkowie (organizacja_id, user_id, email, rola)
select '00000000-0000-0000-0000-000000000001', z.user_id, z.email, 'wlasciciel'
from public.zespol z where z.email not like '%+tfpodglad@%';
insert into public.czlonkowie (organizacja_id, user_id, email, rola)
select '00000000-0000-0000-0000-000000000002', z.user_id, z.email, 'wlasciciel'
from public.zespol z where z.email like '%+tfpodglad@%';
-- Konto podgladowe przestaje byc administratorem: ma widziec aplikacje oczami klienta.
delete from public.zespol where email like '%+tfpodglad@%';

alter table public.kampanie add column organizacja_id uuid references public.organizacje(id);
alter table public.skrzynki add column organizacja_id uuid references public.organizacje(id);
update public.kampanie set organizacja_id = '00000000-0000-0000-0000-000000000001' where organizacja_id is null;
update public.skrzynki set organizacja_id = '00000000-0000-0000-0000-000000000001' where organizacja_id is null;
alter table public.kampanie alter column organizacja_id set default public.moja_organizacja();
alter table public.skrzynki alter column organizacja_id set default public.moja_organizacja();
alter table public.kampanie alter column organizacja_id set not null;
alter table public.skrzynki alter column organizacja_id set not null;
create index kampanie_org_idx on public.kampanie (organizacja_id);
create index skrzynki_org_idx on public.skrzynki (organizacja_id);

-- Dostep do kampanii (po dodaniu kolumny organizacja_id).
create or replace function public.czy_dostep_kampania(p_kampania uuid) returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.kampanie k where k.id = p_kampania and public.czy_dostep_org(k.organizacja_id));
$$;


-- RLS
alter table public.organizacje enable row level security;
alter table public.czlonkowie enable row level security;
create policy "organizacje: odczyt" on public.organizacje for select to authenticated using ((select public.czy_dostep_org(id)));
create policy "czlonkowie: odczyt" on public.czlonkowie for select to authenticated using ((select public.czy_dostep_org(organizacja_id)));
-- Zapis organizacji i czlonkow tylko przez API (klient serwisowy po sprawdzeniu uprawnien).

drop policy "zespol: kampanie" on public.kampanie;
create policy "org: kampanie" on public.kampanie for all to authenticated
  using ((select public.czy_dostep_org(organizacja_id))) with check ((select public.czy_dostep_org(organizacja_id)));

drop policy "zespol: skrzynki" on public.skrzynki;
create policy "org: skrzynki" on public.skrzynki for all to authenticated
  using ((select public.czy_dostep_org(organizacja_id))) with check ((select public.czy_dostep_org(organizacja_id)));

drop policy "zespol: kontakty" on public.kontakty;
create policy "org: kontakty" on public.kontakty for all to authenticated
  using (public.czy_dostep_kampania(kampania_id)) with check (public.czy_dostep_kampania(kampania_id));

drop policy "zespol: warianty" on public.warianty;
create policy "org: warianty" on public.warianty for all to authenticated
  using (public.czy_dostep_kampania(kampania_id)) with check (public.czy_dostep_kampania(kampania_id));

drop policy "zespol: wiadomosci" on public.wiadomosci;
create policy "org: wiadomosci" on public.wiadomosci for all to authenticated
  using (public.czy_dostep_kampania(kampania_id)) with check (public.czy_dostep_kampania(kampania_id));

drop policy "zespol: wydarzenia_wplywu" on public.wydarzenia_wplywu;
create policy "org: wydarzenia_wplywu" on public.wydarzenia_wplywu for all to authenticated
  using (public.czy_dostep_kampania(kampania_id)) with check (public.czy_dostep_kampania(kampania_id));

drop policy "zespol: oswiadczenia odczyt" on public.oswiadczenia;
drop policy "zespol: oswiadczenia zapis" on public.oswiadczenia;
create policy "org: oswiadczenia odczyt" on public.oswiadczenia for select to authenticated
  using (public.czy_dostep_kampania(kampania_id));
create policy "org: oswiadczenia zapis" on public.oswiadczenia for insert to authenticated
  with check (public.czy_dostep_kampania(kampania_id) and user_id = (select auth.uid()));

drop policy "zespol: podpisy odczyt" on public.podpisy;
create policy "org: podpisy odczyt" on public.podpisy for select to authenticated
  using (public.czy_dostep_kampania(kampania_id));

drop policy "zespol: zdarzenia odczyt" on public.zdarzenia;
create policy "org: zdarzenia odczyt" on public.zdarzenia for select to authenticated
  using (exists (select 1 from public.wiadomosci w where w.id = wiadomosc_id and public.czy_dostep_kampania(w.kampania_id)));

drop policy "zespol widzi zespol" on public.zespol;
create policy "admini widza zespol" on public.zespol for select to authenticated using ((select public.czy_admin()));

-- Sekrety skrzynek: dostep po organizacji skrzynki, nie po "zespole".
create or replace function public.pobierz_sekret_skrzynki(p_skrzynka uuid) returns text
language plpgsql security definer set search_path to '' as $$
declare wynik text;
begin
  if not exists (select 1 from public.skrzynki s where s.id = p_skrzynka and public.czy_dostep_org(s.organizacja_id)) then
    raise exception 'brak dostepu';
  end if;
  select haslo_zaszyfrowane into wynik from public.skrzynki_sekrety where skrzynka_id = p_skrzynka;
  return wynik;
end; $$;

create or replace function public.zapisz_sekret_skrzynki(p_skrzynka uuid, p_haslo text) returns void
language plpgsql security definer set search_path to '' as $$
begin
  if not exists (select 1 from public.skrzynki s where s.id = p_skrzynka and public.czy_dostep_org(s.organizacja_id)) then
    raise exception 'brak dostepu';
  end if;
  insert into public.skrzynki_sekrety (skrzynka_id, haslo_zaszyfrowane, zmienione)
  values (p_skrzynka, p_haslo, now())
  on conflict (skrzynka_id) do update set haslo_zaszyfrowane = excluded.haslo_zaszyfrowane, zmienione = now();
end; $$;

-- Straznik decyzji (opcja 3 Jana, 12.10): klient moze tylko wyzerowac decyzje na "czeka" (nowe oswiadczenie)
-- i nie moze przeniesc kampanii do innej organizacji. Akceptacje i odrzucenia robi administrator
-- albo serwer (klient serwisowy, auth.uid() = null) przy automatycznej akceptacji "poza zakresem".
create or replace function public.straznik_kampanii() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if (select auth.uid()) is null or public.czy_admin() then
    return new;
  end if;
  if new.organizacja_id is distinct from old.organizacja_id then
    raise exception 'zmiana organizacji tylko przez administratora';
  end if;
  if (new.zgoda_zespolu, new.zgoda_powod, new.zgoda_kto, new.zgoda_kiedy)
     is distinct from (old.zgoda_zespolu, old.zgoda_powod, old.zgoda_kto, old.zgoda_kiedy)
     and not (new.zgoda_zespolu = 'czeka' and new.zgoda_kto is null and new.zgoda_kiedy is null) then
    raise exception 'decyzje o oswiadczeniu podejmuje administrator WinOver';
  end if;
  return new;
end; $$;
create trigger straznik_kampanii before update on public.kampanie
  for each row execute function public.straznik_kampanii();

-- Nowa kampania klienta nie moze wystartowac z gotowa akceptacja.
create or replace function public.straznik_nowej_kampanii() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if (select auth.uid()) is not null and not public.czy_admin() then
    new.zgoda_zespolu := null; new.zgoda_powod := ''; new.zgoda_kto := null; new.zgoda_kiedy := null;
  end if;
  return new;
end; $$;
create trigger straznik_nowej_kampanii before insert on public.kampanie
  for each row execute function public.straznik_nowej_kampanii();
