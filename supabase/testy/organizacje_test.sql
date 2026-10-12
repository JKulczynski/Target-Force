-- Test zabezpieczen organizacji (12.10). Uruchamiac PO migracji w tej samej transakcji, ktora konczy sie wyjatkiem
-- (wtedy nic nie zostaje w bazie). Wynik: komunikat bledu "WYNIKI: ..." z lista OK/BLAD.
do $$
declare
  jan uuid := '3fb0f608-447d-456a-9f0c-a9113a171ec2';
  podglad uuid := 'b2a65ade-3df1-43d9-8b57-e47d33280cf9';
  skrzynka_jana uuid := 'b40f6cea-152d-41cc-ad43-34299c1a8a61';
  w text := '';
  n int;
  k_klienta uuid;
  k_jana uuid;
  ok boolean;
  zgoda text;
begin
  select id into k_jana from public.kampanie where organizacja_id = '00000000-0000-0000-0000-000000000001' limit 1;

  -- KLIENT (konto podgladowe, organizacja testowa)
  perform set_config('request.jwt.claims', json_build_object('sub', podglad, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.kampanie;
  w := w || format('1 klient widzi kampanie wewnetrzne: %s (oczekiwane 0) %s; ', n, case when n = 0 then 'OK' else 'BLAD' end);
  w := w || format('2 czy_admin=%s czy_w_zespole=%s %s; ', public.czy_admin(), public.czy_w_zespole(),
    case when not public.czy_admin() and public.czy_w_zespole() then 'OK' else 'BLAD' end);

  insert into public.kampanie (nazwa, zgoda_zespolu) values ('test klienta', 'zaakceptowana') returning id, zgoda_zespolu into k_klienta, zgoda;
  w := w || format('3 nowa kampania klienta bez gotowej akceptacji: %s %s; ', coalesce(zgoda, 'null'), case when zgoda is null then 'OK' else 'BLAD' end);
  select count(*) into n from public.kampanie where id = k_klienta and organizacja_id = '00000000-0000-0000-0000-000000000002';
  w := w || format('4 kampania w organizacji testowej: %s', case when n = 1 then 'OK; ' else 'BLAD; ' end);

  begin
    update public.kampanie set zgoda_zespolu = 'zaakceptowana' where id = k_klienta;
    w := w || '5 klient sam zaakceptowal: BLAD; ';
  exception when others then w := w || '5 klient nie moze sam zaakceptowac: OK; ';
  end;

  ok := true;
  begin
    update public.kampanie set zgoda_zespolu = 'czeka', zgoda_powod = '' where id = k_klienta;
  exception when others then ok := false;
  end;
  w := w || format('6 klient moze wyzerowac na czeka: %s; ', case when ok then 'OK' else 'BLAD' end);

  begin
    update public.kampanie set organizacja_id = '00000000-0000-0000-0000-000000000001' where id = k_klienta;
    w := w || '7 klient przeniosl kampanie do cudzej organizacji: BLAD; ';
  exception when others then w := w || '7 przeniesienie zablokowane: OK; ';
  end;

  update public.kampanie set nazwa = 'przejeta' where id = k_jana;
  get diagnostics n = row_count;
  w := w || format('8 klient zmienil cudza kampanie: %s wierszy %s; ', n, case when n = 0 then 'OK' else 'BLAD' end);

  select count(*) into n from public.kontakty where kampania_id = k_jana;
  w := w || format('9 klient widzi cudze kontakty: %s %s; ', n, case when n = 0 then 'OK' else 'BLAD' end);
  select count(*) into n from public.skrzynki;
  w := w || format('10 klient widzi cudze skrzynki: %s %s; ', n, case when n = 0 then 'OK' else 'BLAD' end);
  begin
    perform public.pobierz_sekret_skrzynki(skrzynka_jana);
    w := w || '11 klient pobral cudzy sekret skrzynki: BLAD; ';
  exception when others then w := w || '11 cudzy sekret zablokowany: OK; ';
  end;
  select count(*) into n from public.zespol;
  w := w || format('12 klient widzi liste adminow: %s %s; ', n, case when n = 0 then 'OK' else 'BLAD' end);
  select count(*) into n from public.organizacje;
  w := w || format('13 klient widzi organizacje: %s (oczekiwane 1) %s; ', n, case when n = 1 then 'OK' else 'BLAD' end);
  begin
    insert into public.kampanie (nazwa, organizacja_id) values ('wstrzyknieta', '00000000-0000-0000-0000-000000000001');
    w := w || '14 klient dodal kampanie do cudzej organizacji: BLAD; ';
  exception when others then w := w || '14 dodanie do cudzej organizacji zablokowane: OK; ';
  end;

  execute 'reset role';

  -- ADMIN (Jan)
  perform set_config('request.jwt.claims', json_build_object('sub', jan, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.kampanie;
  w := w || format('15 admin widzi wszystkie kampanie (5 + 1 testowa): %s %s; ', n, case when n = 6 then 'OK' else 'BLAD' end);
  ok := true;
  begin
    update public.kampanie set zgoda_zespolu = 'zaakceptowana', zgoda_kto = jan, zgoda_kiedy = now() where id = k_klienta;
  exception when others then ok := false;
  end;
  w := w || format('16 admin akceptuje kampanie klienta: %s; ', case when ok then 'OK' else 'BLAD' end);
  insert into public.kampanie (nazwa) values ('test admina') returning id into k_jana;
  select count(*) into n from public.kampanie where id = k_jana and organizacja_id = '00000000-0000-0000-0000-000000000001';
  w := w || format('17 kampania admina w organizacji wewnetrznej: %s', case when n = 1 then 'OK; ' else 'BLAD; ' end);
  execute 'reset role';

  raise exception 'WYNIKI: %', w;
end $$;
