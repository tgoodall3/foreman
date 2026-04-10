"use client";

import { useState } from "react";
import { Profile } from "@/types";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastContainer";

export default function WorkersClient({ workers: initial, tenantId }: { workers: Profile[]; tenantId: string }) {
  const { addToast } = useToast();
  const [workers, setWorkers] = useState(initial);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreds, setShowCreds] = useState(false);
  const [hideTimer, setHideTimer] = useState<NodeJS.Timeout | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/workers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        fullName: inviteName,
        email: inviteEmail,
        phone: invitePhone,
        password: invitePassword,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to invite worker");
    } else {
      setWorkers((prev) => [data.profile, ...prev]);
      setSuccess(`${inviteName} added. Copy credentials now (hidden after 30s).`);
      setShowCreds(true);
      if (hideTimer) clearTimeout(hideTimer);
      setHideTimer(setTimeout(() => setShowCreds(false), 30000));
      setInviteName(""); setInviteEmail(""); setInvitePhone(""); setInvitePassword("");
      addToast("Worker invited successfully.", "success");
    }
    setInviting(false);
  };

  const toggleActive = async (worker: Profile) => {
    setToggling(worker.id);
    const res = await fetch("/api/workers/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId: worker.id, isActive: !worker.is_active }),
    });
    if (res.ok) {
      setWorkers((prev) => prev.map((w) => w.id === worker.id ? { ...w, is_active: !w.is_active } : w));
      addToast(
        `Worker ${worker.is_active ? "deactivated" : "activated"} successfully.`,
        "info"
      );
    }
    setToggling(null);
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display font-800 text-2xl sm:text-3xl text-forge">Workers</h1>
          <p className="text-mist text-sm mt-1">{workers.filter((w) => w.is_active).length} active</p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setSuccess(""); setError(""); }}
          className="w-full sm:w-auto bg-amber hover:bg-amber-dark text-forge font-display font-700 px-4 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]"
        >
          + Add Worker
        </button>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="invite-title">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-sm">
            <h2 id="invite-title" className="font-display font-700 text-xl text-forge mb-4">Add Worker</h2>
            <form onSubmit={handleInvite} noValidate className="space-y-3">
              <div>
                <label htmlFor="invite-name" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Full Name *</label>
                <input id="invite-name" type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" placeholder="John Smith" />
              </div>
              <div>
                <label htmlFor="invite-email" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Email *</label>
                <input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" placeholder="john@company.com" />
              </div>
              <div>
                <label htmlFor="invite-phone" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Phone</label>
                <input id="invite-phone" type="tel" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" placeholder="(555) 000-0000" />
              </div>
              <div>
                <label htmlFor="invite-password" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Temporary Password *</label>
                <input id="invite-password" type="text" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} required minLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber" placeholder="Min 8 characters" />
                <p className="text-xs text-mist mt-1">Share this with the worker so they can log in.</p>
              </div>
              {error && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              {success && (
                <div role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1">
                  <p>{success}</p>
                  {showCreds && (
                    <div className="flex items-center gap-2">
                      <code className="bg-white border border-green-200 rounded px-2 py-1 text-[11px] text-forge">{inviteEmail} / {invitePassword}</code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(`${inviteEmail} / ${invitePassword}`)}
                        className="text-amber font-700 hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="flex-1 border border-gray-300 text-forge font-display font-700 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                  {success ? "Close" : "Cancel"}
                </button>
                {!success && (
                  <button type="submit" disabled={inviting || !inviteName || !inviteEmail || invitePassword.length < 8}
                    className="flex-1 bg-forge hover:bg-forge-light disabled:opacity-50 text-white font-display font-700 py-2.5 rounded-lg text-sm transition-colors">
                    {inviting ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Adding…
                      </div>
                    ) : (
                      "Add Worker"
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workers list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {workers.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <p className="text-4xl mb-3">👷</p>
            <p className="font-display font-700 text-xl text-forge mb-1">No workers yet</p>
            <p className="text-mist text-sm mb-4">Add your first worker to start assigning jobs.</p>
            <button onClick={() => setShowInvite(true)} className="bg-amber text-forge font-display font-700 px-4 py-2 rounded-lg text-sm hover:bg-amber-dark transition-colors">
              Add Worker
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden sm:table w-full text-sm" aria-label="Workers list">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Worker</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Phone</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Added</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Status</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workers.map((worker) => (
                  <tr key={worker.id} className={worker.is_active ? "" : "opacity-50"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-steel rounded-full flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-700">{worker.full_name[0]}</span>
                        </div>
                        <div>
                          <p className="font-500 text-forge">{worker.full_name}</p>
                          <p className="text-xs text-mist">{worker.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-mist">{worker.phone || "—"}</td>
                    <td className="px-4 py-3 text-mist">{formatDate(worker.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${worker.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {worker.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(worker)}
                        disabled={toggling === worker.id}
                        className="text-xs text-mist hover:text-forge transition-colors disabled:opacity-50 flex items-center gap-1"
                        aria-label={`${worker.is_active ? "Deactivate" : "Activate"} ${worker.full_name}`}
                      >
                        {toggling === worker.id ? (
                          <>
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                            {worker.is_active ? "Deactivating…" : "Activating…"}
                          </>
                        ) : (
                          worker.is_active ? "Deactivate" : "Activate"
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {workers.map((worker) => (
                <div key={worker.id} className={`p-4 ${worker.is_active ? "" : "opacity-50"}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-steel rounded-full flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-700">{worker.full_name[0]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-600 text-forge truncate">{worker.full_name}</p>
                        <p className="text-sm text-mist truncate">{worker.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${worker.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {worker.is_active ? "Active" : "Inactive"}
                          </span>
                          <span className="text-xs text-mist">{formatDate(worker.created_at)}</span>
                        </div>
                        {worker.phone && <p className="text-xs text-mist mt-1">{worker.phone}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActive(worker)}
                      disabled={toggling === worker.id}
                      className="text-xs text-mist hover:text-forge transition-colors shrink-0 ml-2 disabled:opacity-50 flex items-center gap-1"
                      aria-label={`${worker.is_active ? "Deactivate" : "Activate"} ${worker.full_name}`}
                    >
                      {toggling === worker.id ? (
                        <>
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                          {worker.is_active ? "Deactivating…" : "Activating…"}
                        </>
                      ) : (
                        worker.is_active ? "Deactivate" : "Activate"
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
