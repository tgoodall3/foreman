import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { JobStatus, WorkOrderPriority, InvoiceStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | Date) {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function generateInvoiceNumber(tenantSlug: string, count: number) {
  return `${tenantSlug.toUpperCase()}-${String(count).padStart(4, "0")}`;
}

export function generateEstimateNumber(tenantSlug: string, count: number) {
  return `EST-${tenantSlug.toUpperCase()}-${String(count).padStart(4, "0")}`;
}

export function generateChangeOrderNumber(tenantSlug: string, count: number) {
  return `CO-${tenantSlug.toUpperCase()}-${String(count).padStart(4, "0")}`;
}

export const CHANGE_ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: "Draft",    color: "text-gray-600",  bg: "bg-gray-100" },
  sent:     { label: "Sent",     color: "text-blue-600",  bg: "bg-blue-100" },
  approved: { label: "Approved", color: "text-green-600", bg: "bg-green-100" },
  declined: { label: "Declined", color: "text-red-600",   bg: "bg-red-100" },
};

export const ESTIMATE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "text-gray-600",   bg: "bg-gray-100" },
  sent:      { label: "Sent",      color: "text-blue-600",   bg: "bg-blue-100" },
  approved:  { label: "Approved",  color: "text-green-600",  bg: "bg-green-100" },
  declined:  { label: "Declined",  color: "text-red-600",    bg: "bg-red-100" },
  converted: { label: "Converted", color: "text-purple-600", bg: "bg-purple-100" },
};

export const JOB_STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: "Pending",     color: "text-yellow-700", bg: "bg-yellow-100" },
  scheduled:   { label: "Scheduled",  color: "text-blue-700",   bg: "bg-blue-100" },
  in_progress: { label: "In Progress",color: "text-orange-700", bg: "bg-orange-100" },
  completed:   { label: "Completed",  color: "text-green-700",  bg: "bg-green-100" },
  invoiced:    { label: "Invoiced",   color: "text-purple-700", bg: "bg-purple-100" },
  cancelled:   { label: "Cancelled",  color: "text-gray-500",   bg: "bg-gray-100" },
};

export const PRIORITY_CONFIG: Record<WorkOrderPriority, { label: string; color: string; bg: string }> = {
  low:       { label: "Low",       color: "text-gray-600",   bg: "bg-gray-100" },
  normal:    { label: "Normal",    color: "text-blue-600",   bg: "bg-blue-100" },
  high:      { label: "High",      color: "text-yellow-700", bg: "bg-yellow-100" },
  urgent:    { label: "Urgent",    color: "text-orange-600", bg: "bg-orange-100" },
  emergency: { label: "Emergency", color: "text-red-600",    bg: "bg-red-100" },
};

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  draft:   { label: "Draft",   color: "text-gray-600",  bg: "bg-gray-100" },
  sent:    { label: "Sent",    color: "text-blue-600",  bg: "bg-blue-100" },
  paid:    { label: "Paid",    color: "text-green-600", bg: "bg-green-100" },
  overdue: { label: "Overdue", color: "text-red-600",   bg: "bg-red-100" },
};
