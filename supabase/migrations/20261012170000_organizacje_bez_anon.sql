-- Po doradcy Supabase (12.10): nowe funkcje dostepu tylko dla zalogowanych; funkcje straznikow tylko jako triggery.
revoke execute on function public.czy_admin() from public, anon;
revoke execute on function public.czy_dostep_org(uuid) from public, anon;
revoke execute on function public.czy_dostep_kampania(uuid) from public, anon;
revoke execute on function public.moja_organizacja() from public, anon;
revoke execute on function public.straznik_kampanii() from public, anon, authenticated;
revoke execute on function public.straznik_nowej_kampanii() from public, anon, authenticated;
grant execute on function public.czy_admin() to authenticated;
grant execute on function public.czy_dostep_org(uuid) to authenticated;
grant execute on function public.czy_dostep_kampania(uuid) to authenticated;
grant execute on function public.moja_organizacja() to authenticated;
