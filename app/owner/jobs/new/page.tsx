"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";

const inputCls = [
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-forge placeholder:text-gray-400",
  "transition-all duration-150 focus:outline-none",
  "hover:border-gray-400 focus:border-amber focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)]",
  "disabled:opacity-50 disabled:bg-gray-50",
].join(" ");

const labelCls = "block text-sm font-600 text-forge mb-1.5";
const hintCls  = "text-xs text-mist mt-1";

function SectionCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forge text-white text-xs font-700 shrink-0">
          {step}
        </span>
        <h2 className="font-display font-700 text-lg text-forge tracking-wide">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export default function NewJobPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [title, setTitle]                   = useState("");
  const [description, setDescription]       = useState("");
  const [priority, setPriority]             = useState("normal");
  const [scheduledDate, setScheduledDate]   = useState(searchParams.get("date") ?? "");
  const [scheduledTime, setScheduledTime]   = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [propertyId, setPropertyId]         = useState("");
  const [recurrence, setRecurrence]         = useState("none");
  const [assignedWorkers, setAssignedWorkers] = useState<string[]>([]);
  const [properties, setProperties]         = useState<any[]>([]);
  const [workers, setWorkers]               = useState<any[]>([]);
  const [tenantId, setTenantId]             = useState("");
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
      if (!profile) return;
      setTenantId(profile.tenant_id);
      const [{ data: props }, { data: wrks }] = await Promise.all([
        supabase.from("properties").select("id, name, address, city, state").eq("tenant_id", profile.tenant_id).order("name"),
        supabase.from("profiles").select("id, full_name").eq("tenant_id", profile.tenant_id).eq("role", "worker").eq("is_active", true).order("full_name"),
      ]);
      setProperties(props || []);
      setWorkers(wrks || []);
    };
    load();
  }, [supabase]);

  const toggleWorker = (id: string) =>
    setAssignedWorkers((prev) => prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Job title is required"); return; }
    setLoading(true);
    setError("");

    const { data: job, error: jobError } = await supabase.from("jobs").insert({
      tenant_id:       tenantId,
      title:           title.trim(),
      description:     description.trim() || null,
      priority,
      status:          scheduledDate ? "scheduled" : "pending",
      scheduled_date:  scheduledDate || null,
      scheduled_time:  scheduledTime || null,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      property_id:     propertyId || null,
      assigned_workers: assignedWorkers,
      recurrence,
    }).select().single();

    if (jobError) { setError(jobError.message); setLoading(false); return; }

    if (assignedWorkers.length > 0 && job) {
      fetch("/api/jobs/notify-assigned", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ jobId: job.id, workerIds: assignedWorkers }),
      });
    }

    router.push(`/owner/jobs/${job.id}`);
  };

  return (
    <div className="page-shell max-w-2xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm mb-6" aria-label="Breadcrumb">
        <Link href="/owner/jobs" className="text-mist hover:text-forge transition-colors font-500">Jobs</Link>
        <ChevronRight className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />
        <span className="text-forge font-600">New Job</span>
      </nav>

      <div className="mb-6">
        <h1 className="page-title">New Job</h1>
        <p className="page-subtitle">Fill in the details below to schedule a new job.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        {/* Job Details */}
        <SectionCard step={1} title="Job Details">
          <div>
            <label htmlFor="title" className={labelCls}>
              Title <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputCls}
              placeholder="e.g. Repair fence at Building A"
            />
          </div>

          <div>
            <label htmlFor="description" className={labelCls}>Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Details, materials needed, special instructions…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="priority" className={labelCls}>Priority</label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputCls}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label htmlFor="est-hours" className={labelCls}>Estimated Hours</label>
              <input
                id="est-hours"
                type="number"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                min="0"
                step="0.5"
                className={inputCls}
                placeholder="2.5"
              />
            </div>
          </div>
        </SectionCard>

        {/* Scheduling */}
        <SectionCard step={2} title="Scheduling">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sched-date" className={labelCls}>Date</label>
              <input
                id="sched-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="sched-time" className={labelCls}>Time</label>
              <input
                id="sched-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label htmlFor="property" className={labelCls}>Property</label>
            <select
              id="property"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className={inputCls}
            >
              <option value="">Select a property…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.city}, {p.state}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="recurrence" className={labelCls}>Repeats</label>
            <select
              id="recurrence"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className={inputCls}
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
            {recurrence !== "none" && !scheduledDate && (
              <p className={`${hintCls} text-amber-dark`}>
                Set a start date so we know when to schedule the first occurrence.
              </p>
            )}
          </div>
        </SectionCard>

        {/* Assign Workers */}
        {workers.length > 0 && (
          <SectionCard step={3} title="Assign Workers">
            <p className={hintCls}>
              {assignedWorkers.length === 0
                ? "Select one or more workers for this job."
                : `${assignedWorkers.length} worker${assignedWorkers.length !== 1 ? "s" : ""} selected`}
            </p>
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Select workers">
              {workers.map((w) => {
                const selected = assignedWorkers.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWorker(w.id)}
                    aria-pressed={selected}
                    aria-label={`${selected ? "Remove" : "Assign"} ${w.full_name}`}
                    className={[
                      "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all",
                      selected
                        ? "border-amber bg-amber/8 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all",
                        selected
                          ? "border-amber bg-amber"
                          : "border-gray-300",
                      ].join(" ")}
                    >
                      {selected && <Check className="h-3 w-3 text-forge" aria-hidden="true" />}
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-steel">
                      <span className="text-white text-xs font-700">{w.full_name[0]}</span>
                    </div>
                    <span className="text-sm font-500 text-forge">{w.full_name}</span>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 border-l-4 border-l-red-500 px-4 py-3 text-sm text-red-800"
          >
            <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[10px] font-700">!</span>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Link
            href="/owner/jobs"
            className="action-button-secondary px-5"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber hover:bg-amber-dark disabled:opacity-50 disabled:pointer-events-none text-forge font-display font-700 py-2.5 text-base transition-all shadow-sm hover:shadow-card-md active:scale-[0.99] min-h-[48px]"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-forge/30 border-t-forge animate-spin" />
                Creating…
              </>
            ) : (
              "Create Job"
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
