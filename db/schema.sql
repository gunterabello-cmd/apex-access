create table public.apex_orders (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 items jsonb not null,
 total_pence integer not null check(total_pence>0),
 invoice_id text unique,
 invoice_url text,
 payment_id text,
 status text not null default 'awaiting_payment'
   check(status in ('awaiting_payment','paid','partially_paid','expired','failed','refunded')),
 delivery_note text,
 created_at timestamptz not null default now()
);
create index apex_customer_orders on public.apex_orders(user_id,created_at desc);
alter table public.apex_orders enable row level security;
revoke all on public.apex_orders from public,anon,authenticated;
grant select,insert,update on public.apex_orders to service_role;
