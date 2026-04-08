-- ── Stripe Events (webhook idempotency) ──────────────────────────
-- Stores processed Stripe event IDs so duplicate webhook deliveries
-- are safely ignored. Stripe can deliver the same event more than
-- once (retries on non-2xx, network issues, etc.).

create table if not exists stripe_events (
  id text primary key,                        -- Stripe event ID e.g. evt_xxx
  processed_at timestamptz default now()
);

-- Clean up old events after 30 days (optional, keeps the table small)
-- Run this periodically or set up a pg_cron job:
-- delete from stripe_events where processed_at < now() - interval '30 days';
