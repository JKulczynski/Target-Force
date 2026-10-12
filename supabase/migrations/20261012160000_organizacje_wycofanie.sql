-- WYCOFANIE migracji 20261012160000_organizacje (NIE uruchamiac automatycznie; tylko recznie w razie awarii).
-- Przywraca dostep "caly zespol widzi wszystko". Dane organizacji zostaja w tabelach (nic nie kasujemy),
-- kolumny organizacja_id zostaja, ale przestaja byc uzywane w politykach.
begin;
drop trigger if exists straznik_kampanii on public.kampanie;
drop trigger if exists straznik_nowej_kampanii on public.kampanie;

drop policy if exists "org: kampanie" on public.kampanie;
create policy "zespol: kampanie" on public.kampanie for all to authenticated using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
drop policy if exists "org: skrzynki" on public.skrzynki;
create policy "zespol: skrzynki" on public.skrzynki for all to authenticated using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
drop policy if exists "org: kontakty" on public.kontakty;
create policy "zespol: kontakty" on public.kontakty for all to authenticated using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
drop policy if exists "org: warianty" on public.warianty;
create policy "zespol: warianty" on public.warianty for all using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
drop policy if exists "org: wiadomosci" on public.wiadomosci;
create policy "zespol: wiadomosci" on public.wiadomosci for all to authenticated using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
drop policy if exists "org: wydarzenia_wplywu" on public.wydarzenia_wplywu;
create policy "zespol: wydarzenia_wplywu" on public.wydarzenia_wplywu for all using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
drop policy if exists "org: oswiadczenia odczyt" on public.oswiadczenia;
drop policy if exists "org: oswiadczenia zapis" on public.oswiadczenia;
create policy "zespol: oswiadczenia odczyt" on public.oswiadczenia for select to authenticated using ((select public.czy_w_zespole()));
create policy "zespol: oswiadczenia zapis" on public.oswiadczenia for insert to authenticated with check ((select public.czy_w_zespole()) and user_id = auth.uid());
drop policy if exists "org: podpisy odczyt" on public.podpisy;
create policy "zespol: podpisy odczyt" on public.podpisy for select using ((select public.czy_w_zespole()));
drop policy if exists "org: zdarzenia odczyt" on public.zdarzenia;
create policy "zespol: zdarzenia odczyt" on public.zdarzenia for select to authenticated using ((select public.czy_w_zespole()));
drop policy if exists "admini widza zespol" on public.zespol;
create policy "zespol widzi zespol" on public.zespol for select to authenticated using ((select public.czy_w_zespole()));

-- czy_w_zespole wraca do wersji "tylko tabela zespol"; konto podgladowe trzeba recznie dopisac do zespol, jesli potrzebne.
create or replace function public.czy_w_zespole() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.zespol where user_id = (select auth.uid()));
$$;
create or replace function public.pobierz_sekret_skrzynki(p_skrzynka uuid) returns text
language plpgsql security definer set search_path to '' as $$
declare wynik text;
begin
  if not public.czy_w_zespole() then raise exception 'brak dostepu'; end if;
  select haslo_zaszyfrowane into wynik from public.skrzynki_sekrety where skrzynka_id = p_skrzynka;
  return wynik;
end; $$;
create or replace function public.zapisz_sekret_skrzynki(p_skrzynka uuid, p_haslo text) returns void
language plpgsql security definer set search_path to '' as $$
begin
  if not public.czy_w_zespole() then raise exception 'brak dostepu'; end if;
  insert into public.skrzynki_sekrety (skrzynka_id, haslo_zaszyfrowane, zmienione)
  values (p_skrzynka, p_haslo, now())
  on conflict (skrzynka_id) do update set haslo_zaszyfrowane = excluded.haslo_zaszyfrowane, zmienione = now();
end; $$;
commit;
