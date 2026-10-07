-- Stan kampanii w jednym zapytaniu zamiast szesciu z aplikacji. security invoker: RLS zespolu dalej obowiazuje.
create or replace function public.stan_kampanii(p_kampania uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'odbiorcy', (select count(*) from kontakty c where c.kampania_id = p_kampania and not c.wypisany and c.email is not null),
    'wyslane', (select count(*) from wiadomosci w where w.kampania_id = p_kampania and w.krok = 0 and w.status = 'wyslana'),
    'bledy', (select count(*) from wiadomosci w where w.kampania_id = p_kampania and w.krok = 0 and w.status = 'blad'),
    'kliknieci', (select count(distinct z.wiadomosc_id) from zdarzenia z join wiadomosci w on w.id = z.wiadomosc_id
                  where w.kampania_id = p_kampania and w.status = 'wyslana' and z.typ = 'klikniecie'),
    'wariantow', (select count(*) from warianty v where v.kampania_id = p_kampania and v.rola = 'nadawca' and v.status <> 'odrzucony'),
    'zatwierdzonePierwsze', (select count(*) from warianty v where v.kampania_id = p_kampania and v.rola = 'nadawca' and v.krok = 0 and v.status = 'zatwierdzony')
  );
$$;
revoke execute on function public.stan_kampanii(uuid) from anon;
