export type UserRole = "owner" | "worker" | "property_manager";

export type JobStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "invoiced"
  | "cancelled";

export type WorkOrderPriority = "low" | "normal" | "high" | "urgent" | "emergency";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

// ── Tenant (GC Business) ──────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  email: string;
  phone?: string;
  address?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  plan: "trial" | "pro";
  trial_ends_at?: string;
  created_at: string;
}

// ── User ──────────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  plan: "trial" | "pro";
  is_active: boolean;
  hourly_rate?: number | null;
  created_at: string;
}

// ── Property Manager ──────────────────────────────────────────────────────────
export interface PropertyManager {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string;
  phone?: string;
  company?: string;
  properties: Property[];
  created_at: string;
}

export interface Property {
  id: string;
  tenant_id: string;
  property_manager_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
  created_at: string;
}

// ── Work Order ────────────────────────────────────────────────────────────────
export interface WorkOrder {
  id: string;
  tenant_id: string;
  property_id: string;
  property_manager_id: string;
  title: string;
  description: string;
  priority: WorkOrderPriority;
  photos: string[]; // URLs
  status: "pending" | "accepted" | "declined";
  job_id?: string;
  created_at: string;
  property?: Property;
  property_manager?: PropertyManager;
}

export interface OwnerWorkOrderSummary {
  id: string;
  tenant_id: string;
  title: string;
  priority: WorkOrderPriority;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  properties?: { name: string } | null;
  property_managers?: { full_name?: string; company?: string } | null;
}

// ── Job ───────────────────────────────────────────────────────────────────────
export interface Job {
  id: string;
  tenant_id: string;
  work_order_id?: string;
  property_id?: string;
  title: string;
  description?: string;
  status: JobStatus;
  priority: WorkOrderPriority;
  scheduled_date?: string;
  scheduled_time?: string;
  estimated_hours?: number;
  actual_hours?: number;
  assigned_workers: string[]; // profile IDs
  photos: JobPhoto[];
  notes: JobNote[];
  line_items: LineItem[];
  invoice_id?: string;
  created_at: string;
  updated_at: string;
  property?: Property;
  work_order?: WorkOrder;
  workers?: Profile[];
}

export interface OwnerJobListItem {
  id: string;
  tenant_id: string;
  title: string;
  status: JobStatus;
  priority: WorkOrderPriority;
  scheduled_date?: string;
  created_at: string;
  properties?: { name: string } | null;
}

export interface Invoice {
  id: string;
  job_id: string;
  url: string;
  caption?: string;
  uploaded_by: string;
  type: "before" | "during" | "after" | "general";
  created_at: string;
}

export interface JobNote {
  id: string;
  job_id: string;
  text: string;
  created_by: string;
  created_at: string;
  author?: Profile;
}

export interface JobPhoto {
  id: string;
  job_id: string;
  url: string;
  caption?: string;
  created_at: string;
}

// ── Invoice ───────────────────────────────────────────────────────────────────
export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  job_id: string;
  property_manager_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  line_items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  due_date: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
  job?: Job;
  property_manager?: PropertyManager;
}

export interface OwnerInvoiceListItem {
  id: string;
  tenant_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total: number;
  due_date: string;
  job_id?: string;
  property_manager_id?: string;
  jobs?: { title: string } | null;
  property_managers?: { full_name: string; company?: string } | null;
}
