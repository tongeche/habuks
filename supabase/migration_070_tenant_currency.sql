begin;

alter table public.tenants
  add column if not exists currency_code text;

update public.tenants
set currency_code = coalesce(nullif(upper(btrim(currency_code)), ''), 'KES')
where currency_code is null
   or btrim(currency_code) = ''
   or currency_code <> upper(btrim(currency_code));

alter table public.tenants
  alter column currency_code set default 'KES';

alter table public.tenants
  alter column currency_code set not null;

alter table public.tenants
  drop constraint if exists tenants_currency_code_chk;

alter table public.tenants
  add constraint tenants_currency_code_chk
  check (currency_code ~ '^[A-Z]{3}$');

commit;
