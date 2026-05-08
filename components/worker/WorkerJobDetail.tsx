"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { formatDate, formatDateTime, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";
import JobChecklist from "@/components/jobs/JobChecklist";
import { useToast } from "@/components/ui/ToastContainer";
import PhotoLightbox from "@/components/ui/PhotoLightbox";
import { isNative, takePhoto } from "@/lib/camera";

interface Props {
  job: any;
  photos: any[];
  notes: any[];
  checklist: any[];
  profile: any;
}

export default function WorkerJobDetail({ job, photos: initialPhotos, notes: initialNotes, checklist, profile }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { addToast } = useToast();

  const [photos, setPhotos] = useState(initialPhotos);
  const [notes, setNotes] = useState(initialNotes);
  const [noteText, setNoteText] = useState("");
  const [photoType, setPhotoType] = useState<"before" | "during" | "after" | "general">("general");
  const [photoCaption, setPhotoCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<any[]>([]);
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");
  const [showHoursPrompt, setShowHoursPrompt] = useState(false);
  const [hoursWorked, setHoursWorked] = useState("");
  const [clocking, setClocking] = useState<"in" | "out" | null>(null);
  const [clockedInEntry, setClockedInEntry] = useState<{ id: string; clocked_in_at: string } | null>(null);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [queuedPhotos, setQueuedPhotos] = useState<any[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const statusCfg = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
  const beforePhotos = photos.filter((p) => p.type === "before").length;
  const afterPhotos  = photos.filter((p) => p.type === "after").length;
  const missingChecklist = checklist.some((item) => !item.done);
  const completionBlocks = [
    { ok: !missingChecklist, label: "All checklist items done" },
    { ok: beforePhotos > 0, label: "Before photo" },
    { ok: afterPhotos > 0, label: "After photo" },
    { ok: !clockedInEntry, label: "Clocked out" },
  ];
  const canComplete = completionBlocks.every((b) => b.ok);

  // Status transitions available to workers
  const statusTransitions: Record<string, { label: string; next: string }[]> = {
    scheduled:   [{ label: "Start Job", next: "in_progress" }],
    in_progress: [{ label: "Mark Complete", next: "completed" }],
    pending:     [{ label: "Start Job", next: "in_progress" }],
  };

  const transitions = statusTransitions[job.status] || [];

  useEffect(() => {
    fetch("/api/timesheets/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.entry) setClockedInEntry(data.entry);
      })
      .catch(() => {});

    // Load any queued photo uploads
    if (typeof window !== "undefined") {
      const rawPhotos = localStorage.getItem("photoQueue");
      if (rawPhotos) {
        try { setQueuedPhotos(JSON.parse(rawPhotos)); } catch { setQueuedPhotos([]); }
      }
    }

    // Attempt to flush any queued clock actions when online
    const flushQueue = async () => {
      if (typeof window === "undefined") return;
      const raw = localStorage.getItem("clockQueue");
      if (!raw) return;
      let queue: { dir: "in" | "out"; ts: number }[] = [];
      try { queue = JSON.parse(raw); } catch { queue = []; }
      if (!queue.length) return;
      setSyncingQueue(true);
      const remaining: typeof queue = [];
      for (const item of queue) {
        const res = await fetch(`/api/timesheets/clock-${item.dir}`, { method: "POST" });
        if (!res.ok) {
          remaining.push(item); // keep for later
        }
      }
      if (remaining.length) {
        localStorage.setItem("clockQueue", JSON.stringify(remaining));
      } else {
        localStorage.removeItem("clockQueue");
      }
      setSyncingQueue(false);
    };

    flushQueue();

    const onlineHandler = () => flushQueue();
    window.addEventListener("online", onlineHandler);
      return () => window.removeEventListener("online", onlineHandler);
  }, []);

  const handleClock = async (dir: "in" | "out"): Promise<boolean> => {
    setClocking(dir); setError("");
    const res = await fetch(`/api/timesheets/clock-${dir}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // If likely network issue, queue it for retry
      if (typeof window !== "undefined") {
        const offline = !navigator.onLine || res.status === 500;
        if (offline) {
          const raw = localStorage.getItem("clockQueue");
          const queue: { dir: "in" | "out"; ts: number }[] = raw ? JSON.parse(raw) : [];
          queue.push({ dir, ts: Date.now() });
          localStorage.setItem("clockQueue", JSON.stringify(queue));
          addToast("Offline – clock action queued", "error");
          setError("Offline – queued to sync when back online.");
          setClocking(null);
          return false;
        }
      }
      addToast(data.error || `Failed to clock ${dir}`, "error");
      setError(data.error || `Failed to clock ${dir}.`);
      setClocking(null);
      return false;
    }
    addToast(dir === "in" ? "Clocked in" : "Clocked out", "success");
    if (dir === "in") setClockedInEntry(data.entry || null);
    if (dir === "out") setClockedInEntry(null);
    setClocking(null);
    router.refresh();
    return true;
  };

  const handleStatusUpdate = async (nextStatus: string) => {
    // If starting a job, ensure we clock in first
    if (nextStatus === "in_progress" && !clockedInEntry) {
      const ok = await handleClock("in");
      if (!ok) return;
    }
    // For "complete", show hours prompt first
    if (nextStatus === "completed") {
      setShowHoursPrompt(true);
      return;
    }
    await commitStatusUpdate(nextStatus, null);
  };

  const commitStatusUpdate = async (nextStatus: string, hours: number | null) => {
    setUpdatingStatus(true);
    setError("");

    const { error: err } = await supabase
      .from("jobs")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", job.id);

    if (err) {
      addToast("Failed to update status", "error");
      setError("Failed to update status. Try again.");
      setUpdatingStatus(false);
      return;
    }

    // Save actual hours if provided
    if (hours != null && hours > 0) {
      fetch(`/api/jobs/${job.id}/hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual_hours: hours }),
      });
    }

    // Notify PM when job is completed (fire and forget)
    if (nextStatus === "completed") {
      fetch("/api/jobs/notify-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
    }

    addToast(nextStatus === "completed" ? "Job marked complete" : "Job status updated", "success");
    setShowHoursPrompt(false);
    router.refresh();
    setUpdatingStatus(false);
  };

  const uploadFile = async (file: File) => {
    const doUpload = async () => {
      const ext = file.name.split(".").pop();
      const filename = `${job.tenant_id}/${job.id}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("job-photos")
        .upload(filename, file);

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from("job-photos")
        .getPublicUrl(filename);

      const { data: photo, error: photoErr } = await supabase
        .from("job_photos")
        .insert({
          job_id: job.id,
          tenant_id: job.tenant_id,
          url: publicUrl,
          caption: photoCaption || null,
          uploaded_by: profile.id,
          type: photoType,
        })
        .select("*, profiles(full_name)")
        .single();

      if (photoErr) throw photoErr;
      if (photo) {
        addToast("Photo uploaded", "success");
        setPhotos((prev) => [...prev, photo]);
        setPhotoCaption("");
        if (fileRef.current) fileRef.current.value = "";
      }
    };

    setUploading(true); setError("");
    try {
      await doUpload();
    } catch (err) {
      // If offline or storage error, queue the file (metadata only; user must re-select file later)
      if (typeof window !== "undefined" && (!navigator.onLine)) {
        const raw = localStorage.getItem("photoQueue");
        const queue = raw ? JSON.parse(raw) : [];
        queue.push({ jobId: job.id, tenantId: job.tenant_id, type: photoType, caption: photoCaption, ts: Date.now() });
        localStorage.setItem("photoQueue", JSON.stringify(queue));
        setUploadQueue(queue);
        setError("Offline – photo queued. Re-select when back online.");
      } else {
        addToast("Photo upload failed", "error");
        setError("Photo upload failed. Check connection/storage.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleCameraCapture = async () => {
    const file = await takePhoto();
    if (file) uploadFile(file);
  };

  const handleDeletePhoto = async (photoId: string, url: string) => {
    setError("");
    const res = await fetch(`/api/jobs/${job.id}/photos?url=${encodeURIComponent(url)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      addToast(data.error || "Failed to delete photo", "error");
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    addToast("Photo deleted", "success");
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    setError("");

    const { data: note, error: noteErr } = await supabase
      .from("job_notes")
      .insert({
        job_id: job.id,
        tenant_id: job.tenant_id,
        text: noteText.trim(),
        created_by: profile.id,
      })
      .select("*, profiles(full_name)")
      .single();

    if (!noteErr && note) {
      addToast("Note added", "success");
      setNotes((prev) => [...prev, note]);
      setNoteText("");
    } else {
      addToast("Failed to add note", "error");
      setError("Failed to add note.");
    }
    setAddingNote(false);
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      {/* Back */}
      <Link href="/worker" className="text-mist text-sm hover:text-forge transition-colors inline-flex items-center gap-1 mb-4">
        ← Back to jobs
      </Link>

      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display font-800 text-2xl text-forge">{job.title}</h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
          <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
          {job.scheduled_date && (
            <span className="text-xs text-mist">{formatDate(job.scheduled_date)}{job.scheduled_time && ` · ${job.scheduled_time}`}</span>
          )}
        </div>
        </div>

      {/* Clock in/out panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-2">
            <button
              onClick={() => handleClock("in")}
              disabled={!!clockedInEntry || clocking === "in"}
              className="px-3 py-2 rounded-lg text-sm font-700 bg-green-600 text-white disabled:opacity-60"
            >
              {clocking === "in" ? "Clocking in…" : clockedInEntry ? "Clocked in" : "Clock in"}
            </button>
            <button
              onClick={() => handleClock("out")}
              disabled={!clockedInEntry || clocking === "out"}
              className="px-3 py-2 rounded-lg text-sm font-700 border border-gray-300 text-steel hover:border-red-300 hover:text-red-600 disabled:opacity-60"
            >
              {clocking === "out" ? "Clocking out…" : "Clock out"}
            </button>
          </div>
          {clockedInEntry && (
            <p className="text-xs text-mist">
              Clocked in at {formatDateTime(clockedInEntry.clocked_in_at)}
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>

      {/* Completion readiness */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-2">
        <p className="text-xs text-mist uppercase tracking-wide font-700">Ready to complete</p>
        <div className="space-y-1">
          {completionBlocks.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-sm">
              <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-white text-[11px] ${b.ok ? "bg-green-500" : "bg-gray-300"}`}>
                {b.ok ? "✓" : "!"}
              </span>
              <span className={`text-${b.ok ? "steel" : "mist"}`}>{b.label}</span>
            </div>
          ))}
        </div>
        {!canComplete && (
          <p className="text-xs text-amber-700 mt-1">Complete the missing items above to finish this job.</p>
        )}
      </div>

      {/* Queued uploads notice */}
      {queuedPhotos.length > 0 && (
        <div className="bg-yellow-50 border border-amber/40 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-700 font-700">Queued photos ({queuedPhotos.length})</p>
          <p className="text-xs text-amber-700 mt-1">Re-select and upload when you’re back online.</p>
        </div>
      )}
      {/* Property */}
      {job.properties && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <p className="text-xs text-mist uppercase tracking-wider font-600 mb-1">Location</p>
          <p className="font-600 text-forge">{job.properties.name}</p>
          <p className="text-sm text-mist">{job.properties.address}</p>
          <p className="text-sm text-mist">{job.properties.city}, {job.properties.state}</p>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(job.properties.address + " " + job.properties.city)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber hover:underline mt-2 inline-block"
          >
            Open in Maps →
          </a>
        </div>
      )}

      {/* Description */}
      {job.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <p className="text-xs text-mist uppercase tracking-wider font-600 mb-2">Job Details</p>
          <p className="text-sm text-steel leading-relaxed">{job.description}</p>
        </div>
      )}

      {/* Hours prompt modal */}
      {showHoursPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="hours-dialog-title">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 id="hours-dialog-title" className="font-display font-800 text-xl text-forge mb-1">Mark Complete</h2>
            <p className="text-sm text-mist mb-4">How many hours did this job take?</p>
            <input
              type="number"
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value)}
              min="0"
              step="0.25"
              placeholder="e.g. 2.5"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowHoursPrompt(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => commitStatusUpdate("completed", hoursWorked ? parseFloat(hoursWorked) : null)}
                disabled={updatingStatus}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-display font-700 py-2.5 rounded-lg text-sm transition-colors"
              >
                {updatingStatus ? "Saving…" : "Complete Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist */}
      {checklist.length > 0 && (
        <section aria-labelledby="checklist-heading" className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h2 id="checklist-heading" className="font-display font-700 text-lg text-forge mb-3">
            Checklist
            <span className="ml-2 text-sm font-500 text-mist">
              ({checklist.filter((i: any) => i.done).length}/{checklist.length})
            </span>
          </h2>
          <JobChecklist jobId={job.id} items={checklist} canManage={false} />
        </section>
      )}

      {/* Status Actions */}
      {transitions.length > 0 && (
        <div className="mb-4 space-y-2">
          {transitions.map((t) => (
            <button
              key={t.next}
              onClick={() => handleStatusUpdate(t.next)}
              disabled={updatingStatus}
              className={`w-full font-display font-700 py-3.5 rounded-xl text-base transition-colors min-h-[44px] ${
                t.next === "completed"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-amber hover:bg-amber-dark text-forge"
              } disabled:opacity-50`}
            >
              {updatingStatus ? "Updating…" : t.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Photo Upload */}
      <section aria-labelledby="photos-heading" className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 id="photos-heading" className="font-display font-700 text-lg text-forge mb-3">
          Photos ({photos.length})
        </h2>

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <PhotoLightbox
            photos={photos.map((p: any) => ({ url: p.url, caption: p.caption, type: p.type }))}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onChange={setLightboxIndex}
          />
        )}

        {/* Existing photos */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {photos.map((photo, i) => (
              <div key={photo.id} className="relative">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="w-full focus:outline-none focus:ring-2 focus:ring-amber rounded-lg"
                  aria-label={`View ${photo.type} photo`}
                >
                  <Image
                    src={photo.thumbUrl || photo.url}
                    alt={photo.caption || `${photo.type} photo`}
                    width={320}
                    height={180}
                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(photo.id, photo.url)}
                  className="flex absolute top-1 right-1 bg-black text-white rounded-full w-10 h-10 items-center justify-center text-2xl shadow"
                  style={{ lineHeight: 1 }}
                  aria-label="Delete photo"
                >
                  ×
                </button>
                <p className="text-xs text-mist capitalize mt-0.5">{photo.type}</p>
              </div>
            ))}
          </div>
        )}

        {/* Upload form */}
        <div className="space-y-3">
          <div>
            <label htmlFor="photo-type" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">
              Photo Type
            </label>
            <select
              id="photo-type"
              value={photoType}
              onChange={(e) => setPhotoType(e.target.value as any)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-forge focus:border-amber"
            >
              <option value="before">Before</option>
              <option value="during">During</option>
              <option value="after">After</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label htmlFor="photo-caption" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">
              Caption (optional)
            </label>
            <input
              id="photo-caption"
              type="text"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              placeholder="Describe the photo…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber"
            />
          </div>
          <div>
            <label htmlFor="photo-file" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">
              Photo
            </label>
            {isNative() ? (
              <button
                type="button"
                onClick={handleCameraCapture}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-600 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                {uploading ? "Uploading…" : "Take or Choose Photo"}
              </button>
            ) : (
              <input
                id="photo-file"
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                disabled={uploading}
                className="w-full text-sm text-mist file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-amber file:text-forge file:font-600 file:text-sm hover:file:bg-amber-dark"
                aria-describedby="photo-help"
              />
            )}
            <p id="photo-help" className="text-xs text-mist mt-1">
              {uploading ? "Uploading…" : "Tap to take a photo or choose from gallery"}
            </p>
          </div>
        </div>
      </section>

      {/* Notes */}
      <section aria-labelledby="notes-heading" className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 id="notes-heading" className="font-display font-700 text-lg text-forge mb-3">
          Notes ({notes.length})
        </h2>

        {notes.length > 0 && (
          <div className="space-y-3 mb-4">
            {notes.map((note) => (
              <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-600 text-forge">{note.profiles?.full_name}</span>
                  <span className="text-xs text-mist">{formatDateTime(note.created_at)}</span>
                </div>
                <p className="text-sm text-steel">{note.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="note-text" className="block text-xs font-600 text-mist uppercase tracking-wider">
            Add a note
          </label>
          <textarea
            id="note-text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder="Issue found, materials used, anything important…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:border-amber"
          />
          <button
            onClick={handleAddNote}
            disabled={addingNote || !noteText.trim()}
            className="w-full bg-forge hover:bg-forge-light disabled:opacity-50 text-white font-display font-700 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]"
          >
            {addingNote ? "Adding…" : "Add Note"}
          </button>
        </div>
      </section>
    </div>
  );
}
