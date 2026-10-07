-- Automatyczne wykrywanie odpowiedzi: IMAP skrzynki nadawcy, naglowek In-Reply-To do naszego Message-ID.
alter table public.skrzynki
  add column imap_host text,
  add column imap_port integer not null default 993,
  add column odpowiedzi_sprawdzone timestamptz;
comment on column public.skrzynki.imap_host is 'Serwer IMAP do sprawdzania odpowiedzi. Null = zgadujemy z serwera SMTP.';
