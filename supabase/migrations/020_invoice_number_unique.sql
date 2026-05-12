-- Enforce unique invoice numbers per tenant (prevents duplicates under race conditions)
create unique index if not exists invoices_tenant_invoice_number_idx
  on invoices(tenant_id, invoice_number);
