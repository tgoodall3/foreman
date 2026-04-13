import { createServiceClient } from "@/lib/supabase";

interface AuditEvent {
  tenant_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  entity_type: string;
  entity_id: string;
  entity_label?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append an audit log entry. Fire-and-forget — never throws.
 * Call after the main DB mutation has already succeeded.
 */
export function audit(event: AuditEvent): void {
  const supabase = createServiceClient();
  supabase
    .from("audit_log")
    .insert(event)
    .then(({ error }) => {
      if (error) console.error("[audit]", error.message, event);
    });
}
