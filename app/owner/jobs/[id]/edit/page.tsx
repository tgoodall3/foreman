"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber";

const RECURRENCE_OPTIONS = [
  { value: "none",      label: "Does not repeat" },
  { value: "daily",     label: "Daily" },
  { value: "weekly",    label: "Weekly" },
  { value: "biweekly",  label: "Every 2 weeks" },
  { value: "monthly",   label: "Monthly" },
];

export default function EditJobPage() {
  const router   = useRouter();
  const params   = useParams<{ id: string }>();
  const supabase = createClient();

  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [priority, setPriority]         = useState("normal");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [propertyId, setPropertyId]     = useState("");
  const [recurrence, setRecurrence]     = useState("none");
  const [assignedWorkers, setAssignedWorkers] = useState<string[]>([]);
  const [originalWorkers, setOriginalWorkers] = useState<string[]>([]);
  const [status, setStatus]             = useState("pending");

  const [properties, setProperties]     = useState<any[]>([]);
  const [workers, setWorkers]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      if (!profile) return;

      const [{ data: job }, { data: props }, { data: wrks }] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", params.id).single(),
        supabase.from("properties").select("id, name, city, state").eq("tenant_id", profile.tenant_id).order("name"),
        supabase.from("profiles").select("id, full_name").eq("tenant_id", profile.tenant_id).eq("role", "worker").eq("is_active", true).order("full_name"),
      ]);

      if (!job) { router.push("/owner/jobs"); return; }

      setTitle(job.title ?? "");
      setDescription(job.description ?? "");
      setPriority(job.priority ?? "normal");
      setScheduledDate(job.scheduled_date ?? "");
      setScheduledTime(job.scheduled_time ?? "");
      setEstimatedHours(job.estimated_hours != null ? String(job.estimated_hours) : "");
      setPropertyId(job.property_id ?? "");
      setRecurrence(job.recurrence ?? "none");
      setAssignedWorkers(job.assigned_workers ?? []);
      setOriginalWorkers(job.assigned_workers ?? []);
      setStatus(job.status ?? "pending");
      setProperties(props ?? []);
      setWorkers(wrks ?? []);
      setLoading(false);
    };
    load();
  }, [params.id, supabase, router]);

  const toggleWorker = (id: string) =>
    setAssignedWorkers((prev) => prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true); setError("");

    const newStatus = scheduledDate && status === "pending" ? "scheduled" : status;

    const { error: err } = await supabase
      .from("jobs")
      .update({
        title:           title.trim(),
        description:     description.trim() || null,
        priority,
        status:          newStatus,
        scheduled_date:  scheduledDate || null,
        scheduled_time:  scheduledTime || null,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
        property_id:     propertyId || null,
        assigned_workers: assignedWorkers,
        recurrence,
        updated_at:      new Date().toISOString(),
      })
      .eq("id", params.id);

    if (err) { setError(err.message); setSaving(false); return; }

    // Auto-create draft invoice when job is marked complete (fire and forget)
    if (newStatus === "completed") {
      fetch(`/api/jobs/${params.id}/auto-invoice`, { method: "POST" });
    }

    // Notify newly added workers (best-effort)
    const added = assignedWorkers.filter((id) => !originalWorkers.includes(id));
    if (added.length > 0) {
      fetch("/api/jobs/notify-assigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: params.id, workerIds: added }),
      }).catch(() => {});
    }

    router.push(`/owner/jobs/${params.id}`);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-mist text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href={`/owner/jobs/${params.id}`} className="text-mist hover:text-forge text-sm transition-colors">Job</Link>
        <span className="text-mist">/</span>
        <span className="text-sm text-forge">Edit</span>
      </div>
      <h1 className="font-display font-800 text-3xl text-forge mb-6">Edit Job</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-display font-700 text-lg text-forge">Job Details</h2>
          <div>
            <label htmlFor="title" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Title *</label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inp} />
          </div>
          <div>
            <label htmlFor="description" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Description</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inp + " resize-none"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="priority" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Priority</label>
              <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={inp}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Status</label>
              <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="est-hours" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Est. Hours</label>
            <input id="est-hours" type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} min="0" step="0.5" className={inp} placeholder="2.5" />
          </div>
        </div>

        {/* Scheduling */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-display font-700 text-lg text-forge">Scheduling</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sched-date" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Date</label>
              <input id="sched-date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label htmlFor="sched-time" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Time</label>
              <input id="sched-time" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className={inp} />
            </div>
          </div>
          <div>
            <label htmlFor="property" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Property</label>
            <select id="property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={inp}>
              <option value="">— Select property —</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.city}, {p.state}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="recurrence" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Repeats</label>
            <select id="recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={inp}>
              {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Workers */}
        {workers.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-display font-700 text-lg text-forge mb-3">Assign Workers</h2>
            <div className="space-y-2" role="group" aria-label="Select workers">
              {workers.map((w) => (
                <label key={w.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignedWorkers.includes(w.id)}
                    onChange={() => toggleWorker(w.id)}
                    className="w-4 h-4 accent-amber"
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-steel rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-700">{w.full_name[0]}</span>
                    </div>
                    <span className="text-sm font-500 text-forge">{w.full_name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Link href={`/owner/jobs/${params.id}`} className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-600 hover:bg-gray-50 transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="flex-1 bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-2.5 rounded-lg text-base transition-colors min-h-[44px]"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
