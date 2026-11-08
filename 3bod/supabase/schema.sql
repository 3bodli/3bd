-- شغّل هذا الملف كاملاً في Supabase: SQL Editor > New query > Run

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text, name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

create table orders (
  code text primary key check (code ~ '^3BD-[A-Z2-9]{6}$'),
  user_id uuid not null references auth.users on delete cascade,
  recipient_name text not null check (char_length(recipient_name) <= 100),
  recipient_phone text not null check (recipient_phone ~ '^[0-9]{8,15}$'),
  sham_account text not null check (sham_account ~ '^[0-9]{1,30}$'),
  amount_usd numeric not null check (amount_usd >= 1),
  receive_cur text not null check (receive_cur in ('USD','SYP')),
  payout numeric not null,
  usdt_amount numeric not null,
  stage int not null default 0 check (stage between 0 and 4),
  paid boolean not null default false,
  txid text,
  shot_path text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table orders enable row level security;

create policy "read own profile" on profiles for select using (id = auth.uid() or is_admin());
create policy "read own orders" on orders for select using (user_id = auth.uid() or is_admin());
create policy "create own orders" on orders for insert with check (user_id = auth.uid() and stage = 0 and paid = false);
create policy "admin updates orders" on orders for update using (is_admin()) with check (is_admin());

-- تتبّع عام بالرمز (بدون كشف الهاتف ولا حساب شام كاش)
create or replace function track_order(p_code text)
returns table (code text, recipient_name text, amount_usd numeric, receive_cur text, payout numeric,
               usdt_amount numeric, stage int, paid boolean, is_mine boolean)
language sql security definer set search_path = public as $$
  select o.code, o.recipient_name, o.amount_usd, o.receive_cur, o.payout, o.usdt_amount, o.stage, o.paid, (o.user_id = auth.uid())
  from orders o where o.code = upper(p_code)
$$;

-- المستخدم يرسل إثبات الدفع فقط (ما بيقدر يغيّر الحالة)
create or replace function submit_payment(p_code text, p_txid text, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update orders set paid = true, txid = left(p_txid, 200), shot_path = p_path
  where code = upper(p_code) and user_id = auth.uid() and stage = 0 and paid = false;
  if not found then raise exception 'not allowed'; end if;
end $$;

grant execute on function track_order(text) to anon, authenticated;
grant execute on function submit_payment(text, text, text) to authenticated;

-- مخزن لقطات الدفع (خاص)
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false) on conflict do nothing;
create policy "upload own proof" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read proofs" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- بعد ما تسجّل حساب الأدمن من الموقع، شغّل هذا السطر ببريدك:
-- update profiles set is_admin = true where email = 'YOUR_ADMIN_EMAIL';
