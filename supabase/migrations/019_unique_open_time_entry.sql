-- Prevent race-condition double clock-in: at most one open entry per worker
create unique index if not exists time_entries_open_entry_idx
  on time_entries(worker_id)
  where clocked_out_at is null;
