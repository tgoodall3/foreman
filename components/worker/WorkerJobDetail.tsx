"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatDate, formatDateTime, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";
import JobChecklist from "@/components/jobs/JobChecklist";

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

  const [photos, setPhotos] = useState(initialPhotos);
  const [notes, setNotes] = useState(initialNotes);
  const [noteText, setNoteText] = useState("");
  const [photoType, setPhotoType] = useState<"before" | "during" | "after" | "general">("general");
  const [photoCaption, setPhotoCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");
  const [showHoursPrompt, setShowHoursPrompt] = useState(false);
  const [hoursWorked, setHoursWorked] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const statusCfg = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];

  // Status transitions available to workers
  const statusTransitions: Record<string, { label: string; next: string }[]> = {
    scheduled:   [{ label: "Start Job", next: "in_progress" }],
    in_progress: [{ label: "Mark Complete", next: "completed" }],
    pending:     [{ label: "Start Job", next: "in_progress" }],
  };

  const transitions = statusTransitions[job.status] || [];

  const handleStatusUpdate = async (nextStatus: string) => {
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

    setShowHoursPrompt(false);
    router.refresh();
    setUpdatingStatus(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const ext = file.name.split(".").pop();
    const filename = `${job.tenant_id}/${job.id}/${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("job-photos")
      .upload(filename, file);

    if (uploadErr) {
      setError("Photo upload failed. Check storage settings.");
      setUploading(false);
      return;
    }

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

    if (!photoErr && photo) {
      setPhotos((prev) => [...prev, photo]);
      setPhotoCaption("");
      if (fileRef.current) fileRef.current.value = "";
    }

    setUploading(false);
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
      setNotes((prev) => [...prev, note]);
      setNoteText("");
    } else {
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
            <span className="text-xs text-mist">📅 {formatDate(job.scheduled_date)}{job.scheduled_time && ` · ${job.scheduled_time}`}</span>
          )}
        </div>
      </div>

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

        {/* Existing photos */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {photos.map((photo) => (
              <div key={photo.id}>
                <a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`View ${photo.type} photo`}>
                  <img
                    src={photo.url}
                    alt={photo.caption || `${photo.type} photo`}
                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                  />
                </a>
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
