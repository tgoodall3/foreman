-- Shared rate-limit storage (per key/window)
create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  window_end timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists rate_limits_window_end_idx on public.rate_limits (window_end);

comment on table public.rate_limits is 'Shared store for API rate limiting across serverless instances.';
comment on column public.rate_limits.key is 'Arbitrary rate-limit bucket key (e.g., signup:ip).';
comment on column public.rate_limits.window_end is 'Window expiration timestamp.';
