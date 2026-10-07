-- Skad przychodza sympatycy: UTM i odsylacz ze strony akcji (do raportu i upsellu reklam).
alter table public.podpisy add column zrodlo jsonb not null default '{}'::jsonb;
comment on column public.podpisy.zrodlo is 'utm_source, utm_medium, utm_campaign, ref (domena odsylacza) z wejscia na strone akcji.';

-- Wypisanie odbiorcy z linku w mailu (/w/{kod}) i naglowka List-Unsubscribe. Publiczne, po kodzie wiadomosci.
create or replace function public.wypisz_kod(p_kod text) returns boolean
language plpgsql security definer set search_path = 'public' as $$
declare v_kontakt uuid; v_wiadomosc uuid;
begin
  if p_kod !~ '^[0-9a-f]{8}$' then return false; end if;
  select id, kontakt_id into v_wiadomosc, v_kontakt from wiadomosci where kod = p_kod;
  if v_kontakt is null then return false; end if;
  update kontakty set wypisany = true where id = v_kontakt and not wypisany;
  if found then
    insert into zdarzenia (wiadomosc_id, typ) values (v_wiadomosc, 'wypisanie');
  end if;
  return true;
end; $$;
